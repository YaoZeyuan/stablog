import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone.js'
import utc from 'dayjs/plugin/utc.js'
import PathConfig from '~/src/config/path.js'
import { WEIBO_TIME_ZONE } from '~/src/application/fetch/date_range_planner.js'

dayjs.extend(utc)
dayjs.extend(timezone)

export const WEIBO_RESPONSE_CACHE_SCHEMA_VERSION = 1 as const
export const WEIBO_RESPONSE_CACHE_DIRECTORY = 'weibo-http'

export type WeiboResponseCacheMode = 'prefer-cache' | 'refresh'

export type WeiboResponseCacheRequest = {
  apiVersion: string
  endpoint: string
  loginUid: string
  targetUid: string
  params: Record<string, unknown>
}

export type WeiboResponseCacheEligibility = {
  batchStartedAtMs: number
  rangeEndAt: number
}

export type WeiboResponseSource = 'cache' | 'network'

export type WeiboCachedFetchResult<T> = {
  data: T
  source: WeiboResponseSource
}

type CacheEnvelope = {
  schemaVersion: typeof WEIBO_RESPONSE_CACHE_SCHEMA_VERSION
  keyHash: string
  cachedAt: string
  request: WeiboResponseCacheRequest
  response: unknown
}

type CacheParser<T> = (input: unknown) => T

const sensitiveKeyPattern = /(?:authorization|cookie|password|secret|token|headers?)/i

function assertSafeSegment(value: string, label: string): string {
  if (/^[a-zA-Z0-9._-]+$/.test(value) === false || value === '.' || value === '..') {
    throw new TypeError(`${label}包含非法路径字符`)
  }
  return value
}

function canonicalize(value: unknown, key?: string): unknown {
  if (key !== undefined && sensitiveKeyPattern.test(key)) {
    throw new TypeError(`缓存请求签名不得包含敏感字段：${key}`)
  }
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'number') {
    if (Number.isFinite(value) === false) throw new TypeError('缓存请求参数必须是有限数值')
    return value
  }
  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item))
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    const result: Record<string, unknown> = {}
    for (const currentKey of Object.keys(record).sort()) {
      if (record[currentKey] !== undefined) {
        result[currentKey] = canonicalize(record[currentKey], currentKey)
      }
    }
    return result
  }
  throw new TypeError(`缓存请求参数不支持 ${typeof value} 类型`)
}

function sanitizeCacheValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeCacheValue)
  }
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>
    const result: Record<string, unknown> = {}
    for (const [key, child] of Object.entries(record)) {
      if (sensitiveKeyPattern.test(key) === false && child !== undefined) {
        result[key] = sanitizeCacheValue(child)
      }
    }
    return result
  }
  return value
}

function canonicalRequest(request: WeiboResponseCacheRequest): WeiboResponseCacheRequest {
  if (request.endpoint.includes('?') || request.endpoint.includes('#')) {
    throw new TypeError('缓存 endpoint 不得包含查询参数或片段，请放入 params')
  }
  return {
    apiVersion: assertSafeSegment(request.apiVersion, 'apiVersion'),
    endpoint: request.endpoint,
    loginUid: assertSafeSegment(request.loginUid, 'loginUid'),
    targetUid: assertSafeSegment(request.targetUid, 'targetUid'),
    params: canonicalize(request.params) as Record<string, unknown>,
  }
}

function stableStringify(value: unknown): string {
  return JSON.stringify(canonicalize(value))
}

export function isWeiboResponseCacheEligible(input: WeiboResponseCacheEligibility): boolean {
  if (
    Number.isSafeInteger(input.batchStartedAtMs) === false ||
    input.batchStartedAtMs < 0 ||
    Number.isSafeInteger(input.rangeEndAt) === false ||
    input.rangeEndAt < 0
  ) {
    throw new TypeError('缓存时间参数无效')
  }
  const cutoff = dayjs(input.batchStartedAtMs)
    .tz(WEIBO_TIME_ZONE)
    .subtract(1, 'month')
  return input.rangeEndAt < cutoff.unix()
}

export class WeiboResponseCache {
  private readonly cacheRoot: string

  constructor(cacheRoot = PathConfig.cachePath) {
    this.cacheRoot = path.resolve(cacheRoot, WEIBO_RESPONSE_CACHE_DIRECTORY)
  }

  getCachePath(request: WeiboResponseCacheRequest): string {
    const canonical = canonicalRequest(request)
    const keyHash = crypto.createHash('sha256').update(stableStringify(canonical)).digest('hex')
    return path.resolve(
      this.cacheRoot,
      canonical.apiVersion,
      canonical.targetUid,
      canonical.loginUid,
      `${keyHash}.json`,
    )
  }

  async read<T>(request: WeiboResponseCacheRequest, parser: CacheParser<T>): Promise<T | undefined> {
    const canonical = canonicalRequest(request)
    const cachePath = this.getCachePath(canonical)
    const expectedHash = path.basename(cachePath, '.json')
    try {
      const raw = await fs.readFile(cachePath, 'utf8')
      const envelope = JSON.parse(raw) as Partial<CacheEnvelope>
      if (
        envelope.schemaVersion !== WEIBO_RESPONSE_CACHE_SCHEMA_VERSION ||
        envelope.keyHash !== expectedHash ||
        envelope.request === undefined ||
        stableStringify(envelope.request) !== stableStringify(canonical) ||
        envelope.response === undefined
      ) {
        return undefined
      }
      return parser(envelope.response)
    } catch {
      return undefined
    }
  }

  async write<T>(
    request: WeiboResponseCacheRequest,
    response: unknown,
    parser: CacheParser<T>,
  ): Promise<T> {
    const parsed = parser(response)
    await this.writeValidated(request, parsed)
    return parsed
  }

  async getOrFetch<T>(options: {
    mode: WeiboResponseCacheMode
    eligible: boolean
    request: WeiboResponseCacheRequest
    parser: CacheParser<T>
    fetcher: () => Promise<unknown>
  }): Promise<WeiboCachedFetchResult<T>> {
    if (options.eligible && options.mode === 'prefer-cache') {
      const cached = await this.read(options.request, options.parser)
      if (cached !== undefined) {
        return { data: cached, source: 'cache' }
      }
    }

    const response = await options.fetcher()
    const parsed = options.parser(response)
    if (options.eligible) {
      await this.writeValidated(options.request, parsed)
    }
    return { data: parsed, source: 'network' }
  }

  async clearIdentityTarget(options: {
    apiVersion: string
    targetUid: string
    loginUid: string
  }): Promise<void> {
    const targetPath = path.resolve(
      this.cacheRoot,
      assertSafeSegment(options.apiVersion, 'apiVersion'),
      assertSafeSegment(options.targetUid, 'targetUid'),
      assertSafeSegment(options.loginUid, 'loginUid'),
    )
    const relative = path.relative(this.cacheRoot, targetPath)
    if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error('拒绝清理微博响应缓存根目录之外的路径')
    }
    await fs.rm(targetPath, { recursive: true, force: true })
  }

  private async writeValidated(request: WeiboResponseCacheRequest, response: unknown): Promise<void> {
    const canonical = canonicalRequest(request)
    const cachePath = this.getCachePath(canonical)
    const keyHash = path.basename(cachePath, '.json')
    const envelope: CacheEnvelope = {
      schemaVersion: WEIBO_RESPONSE_CACHE_SCHEMA_VERSION,
      keyHash,
      cachedAt: new Date().toISOString(),
      request: canonical,
      response: sanitizeCacheValue(response),
    }
    await fs.mkdir(path.dirname(cachePath), { recursive: true })
    const temporaryPath = `${cachePath}.${process.pid}.${crypto.randomUUID()}.tmp`
    try {
      await fs.writeFile(temporaryPath, `${JSON.stringify(envelope)}\n`, {
        encoding: 'utf8',
        flag: 'wx',
      })
      await fs.rename(temporaryPath, cachePath)
    } catch (error) {
      await fs.rm(temporaryPath, { force: true }).catch(() => undefined)
      throw error
    }
  }
}
