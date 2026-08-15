import axios from 'axios'
import RequestConfig from '~/src/config/request.js'
import {
  ArticleInfoResponse,
  LongTextResponse,
  parseArticleInfoResponse,
  parseLongTextResponse,
  parseProfileInfoResponse,
  parseSearchProfileResponse,
  parseWeiboLoginResponse,
  ProfileInfoResponse,
  SearchProfileResponse,
} from '~/src/application/fetch/weibo_api_schema.js'
import {
  globalWeiboRequestLimiter,
  WeiboRequestLimiter,
} from '~/src/application/fetch/weibo_request_limiter.js'
import {
  isWeiboResponseCacheEligible,
  WeiboCachedFetchResult,
  WeiboResponseCache,
  WeiboResponseCacheMode,
} from '~/src/application/fetch/weibo_response_cache.js'

const WEIBO_API_ORIGIN = 'https://weibo.com'
const SEARCH_PROFILE_ENDPOINT = '/ajax/statuses/searchProfile'
const PROFILE_INFO_ENDPOINT = '/ajax/profile/info'
const LONG_TEXT_ENDPOINT = '/ajax/statuses/longtext'
const ARTICLE_DETAIL_ENDPOINT = 'https://card.weibo.com/article/m/aj/detail'
const LEGACY_ARTICLE_DETAIL_ENDPOINT = 'https://card.weibo.com/article/aj/articleshow'
const LOGIN_CONFIG_ENDPOINT = 'https://m.weibo.cn/api/config'

export type WeiboTransportRequest = {
  url: string
  params: Record<string, string | number>
  headers: Record<string, string>
  timeoutMs: number
}

export interface WeiboTransport {
  get(request: WeiboTransportRequest): Promise<unknown>
}

export type WeiboApiClientErrorKind = 'authentication' | 'network' | 'schema'

/**
 * Stable, credential-safe API boundary error. Never retain the Axios error or
 * response body because either can contain Cookie/header material.
 */
export class WeiboApiClientError extends Error {
  readonly kind: WeiboApiClientErrorKind
  readonly endpoint: string
  readonly statusCode?: number

  constructor(options: {
    kind: WeiboApiClientErrorKind
    endpoint: string
    message: string
    statusCode?: number
  }) {
    super(options.message)
    this.name = 'WeiboApiClientError'
    this.kind = options.kind
    this.endpoint = options.endpoint
    this.statusCode = options.statusCode
  }
}

export function isWeiboAuthenticationError(error: unknown): error is WeiboApiClientError {
  return error instanceof WeiboApiClientError && error.kind === 'authentication'
}

export type WeiboApiClientOptions = {
  cookie: string
  loginUid: string
  userAgent?: string
  timeoutMs?: number
  apiVersion?: string
  transport?: WeiboTransport
  limiter?: WeiboRequestLimiter
  cache?: WeiboResponseCache
  now?: () => number
}

export type WeiboApiCacheContext = {
  mode: WeiboResponseCacheMode
  batchStartedAtMs: number
  rangeEndAt: number
}

export type WeiboArticleRequest = {
  targetUid: string
  articleId: string
  cache?: WeiboApiCacheContext
}

class AxiosWeiboTransport implements WeiboTransport {
  async get(request: WeiboTransportRequest): Promise<unknown> {
    const response = await axios.get(request.url, {
      params: request.params,
      headers: request.headers,
      timeout: request.timeoutMs,
    })
    return response.data
  }
}

export async function resolveWeiboLoginUid(options: {
  cookie: string
  userAgent?: string
  timeoutMs?: number
  transport?: WeiboTransport
  limiter?: WeiboRequestLimiter
}): Promise<string> {
  const transport = options.transport ?? new AxiosWeiboTransport()
  const limiter = options.limiter ?? globalWeiboRequestLimiter
  const response = await limiter.schedule(() => requestTransportSafely(transport, {
    url: LOGIN_CONFIG_ENDPOINT,
    params: {},
    headers: {
      accept: 'application/json, text/plain, */*',
      cookie: options.cookie,
      'user-agent': options.userAgent ?? RequestConfig.ua,
      'x-requested-with': 'XMLHttpRequest',
    },
    timeoutMs: options.timeoutMs ?? RequestConfig.timeoutMs,
  }))
  return parseEndpointResponse(LOGIN_CONFIG_ENDPOINT, response, parseWeiboLoginResponse).data.uid
}

function assertUid(uid: string, label: string): string {
  if (/^\d{1,32}$/.test(uid) === false) {
    throw new TypeError(`${label}必须是数字字符串`)
  }
  return uid
}

function extractCookieValue(cookie: string, name: string): string {
  const prefix = `${name}=`
  const rawValue = cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length) ?? ''
  try {
    return decodeURIComponent(rawValue)
  } catch {
    return rawValue
  }
}

export default class WeiboApiClient {
  readonly loginUid: string
  readonly apiVersion: string
  private readonly cookie: string
  private readonly userAgent: string
  private readonly timeoutMs: number
  private readonly transport: WeiboTransport
  private readonly limiter: WeiboRequestLimiter
  private readonly cache: WeiboResponseCache
  private readonly now: () => number

  constructor(options: WeiboApiClientOptions) {
    this.loginUid = assertUid(options.loginUid, 'loginUid')
    this.cookie = options.cookie
    this.userAgent = options.userAgent ?? RequestConfig.ua
    this.timeoutMs = options.timeoutMs ?? RequestConfig.timeoutMs
    this.apiVersion = options.apiVersion ?? 'weibo-web-v1'
    this.transport = options.transport ?? new AxiosWeiboTransport()
    this.limiter = options.limiter ?? globalWeiboRequestLimiter
    this.cache = options.cache ?? new WeiboResponseCache()
    this.now = options.now ?? Date.now
  }

  async getProfileInfo(targetUid: string): Promise<WeiboCachedFetchResult<ProfileInfoResponse>> {
    const uid = assertUid(targetUid, 'targetUid')
    const response = await this.requestNetwork(PROFILE_INFO_ENDPOINT, uid, {
      uid,
      scene: 'profile',
    })
    return {
      data: parseEndpointResponse(PROFILE_INFO_ENDPOINT, response, parseProfileInfoResponse),
      source: 'network',
    }
  }

  async searchProfile(options: {
    targetUid: string
    page: number
    startAt: number
    endAt: number
    cache?: WeiboApiCacheContext
  }): Promise<WeiboCachedFetchResult<SearchProfileResponse>> {
    const targetUid = assertUid(options.targetUid, 'targetUid')
    if (Number.isSafeInteger(options.page) === false || options.page < 1) {
      throw new RangeError('page 必须是从 1 开始的安全整数')
    }
    if (
      Number.isSafeInteger(options.startAt) === false ||
      Number.isSafeInteger(options.endAt) === false ||
      options.startAt < 0 ||
      options.endAt < options.startAt
    ) {
      throw new RangeError('检索时间范围无效')
    }
    const params = {
      uid: targetUid,
      page: options.page,
      starttime: options.startAt,
      endtime: options.endAt,
      hasori: 1,
      hasret: 1,
      hastext: 1,
      haspic: 1,
      hasvideo: 1,
      hasmusic: 1,
    }
    const cacheRequest = {
      apiVersion: this.apiVersion,
      endpoint: SEARCH_PROFILE_ENDPOINT,
      loginUid: this.loginUid,
      targetUid,
      params,
    }
    const eligible = options.cache === undefined
      ? false
      : isWeiboResponseCacheEligible({
          batchStartedAtMs: options.cache.batchStartedAtMs,
          rangeEndAt: options.cache.rangeEndAt,
        })
    return this.cache.getOrFetch({
      mode: options.cache?.mode ?? 'refresh',
      eligible,
      request: cacheRequest,
      parser: (input) => parseEndpointResponse(
        SEARCH_PROFILE_ENDPOINT,
        input,
        parseSearchProfileResponse,
      ),
      fetcher: () => this.requestNetwork(SEARCH_PROFILE_ENDPOINT, targetUid, params),
    })
  }

  async getLongText(options: {
    targetUid: string
    mblogId: string
    cache?: WeiboApiCacheContext
  }): Promise<WeiboCachedFetchResult<LongTextResponse>> {
    const targetUid = assertUid(options.targetUid, 'targetUid')
    if (/^[a-zA-Z0-9_-]+$/.test(options.mblogId) === false) {
      throw new TypeError('mblogId 格式无效')
    }
    const params = { id: options.mblogId }
    const cacheRequest = {
      apiVersion: this.apiVersion,
      endpoint: LONG_TEXT_ENDPOINT,
      loginUid: this.loginUid,
      targetUid,
      params,
    }
    const eligible = options.cache === undefined
      ? false
      : isWeiboResponseCacheEligible({
          batchStartedAtMs: options.cache.batchStartedAtMs,
          rangeEndAt: options.cache.rangeEndAt,
        })
    return this.cache.getOrFetch({
      mode: options.cache?.mode ?? 'refresh',
      eligible,
      request: cacheRequest,
      parser: (input) => parseEndpointResponse(LONG_TEXT_ENDPOINT, input, parseLongTextResponse),
      fetcher: () => this.requestNetwork(LONG_TEXT_ENDPOINT, targetUid, params),
    })
  }

  getArticle(options: WeiboArticleRequest): Promise<WeiboCachedFetchResult<ArticleInfoResponse>>
  getArticle(
    targetUid: string,
    articleId: string,
    cache?: WeiboApiCacheContext,
  ): Promise<WeiboCachedFetchResult<ArticleInfoResponse>>
  async getArticle(
    optionsOrTargetUid: WeiboArticleRequest | string,
    articleId?: string,
    cache?: WeiboApiCacheContext,
  ): Promise<WeiboCachedFetchResult<ArticleInfoResponse>> {
    const options: WeiboArticleRequest = typeof optionsOrTargetUid === 'string'
      ? {
          targetUid: optionsOrTargetUid,
          articleId: articleId ?? '',
          cache,
        }
      : optionsOrTargetUid
    const targetUid = assertUid(options.targetUid, 'targetUid')
    if (/^\d{10,32}$/.test(options.articleId) === false) {
      throw new TypeError('articleId 格式无效')
    }
    const isLegacyArticle = options.articleId.startsWith('100160')
    const endpoint = isLegacyArticle ? LEGACY_ARTICLE_DETAIL_ENDPOINT : ARTICLE_DETAIL_ENDPOINT
    const stableParams: Record<string, string | number> = isLegacyArticle
      ? { cid: options.articleId }
      : { id: options.articleId }
    const networkParams: Record<string, string | number> = {
      ...stableParams,
      [isLegacyArticle ? '_' : '_t']: Math.floor(this.now() / 1000),
    }
    const cacheRequest = {
      apiVersion: this.apiVersion,
      endpoint,
      loginUid: this.loginUid,
      targetUid,
      params: stableParams,
    }
    const eligible = options.cache === undefined
      ? false
      : isWeiboResponseCacheEligible({
          batchStartedAtMs: options.cache.batchStartedAtMs,
          rangeEndAt: options.cache.rangeEndAt,
        })
    const referer = isLegacyArticle
      ? 'https://card.weibo.com/article/h5/s'
      : `https://card.weibo.com/article/m/show/id/${options.articleId}`
    return this.cache.getOrFetch({
      mode: options.cache?.mode ?? 'refresh',
      eligible,
      request: cacheRequest,
      parser: (input) => parseEndpointResponse(endpoint, input, parseArticleInfoResponse),
      fetcher: () => this.requestNetwork(endpoint, targetUid, networkParams, referer),
    })
  }

  private requestNetwork(
    endpoint: string,
    targetUid: string,
    params: Record<string, string | number>,
    referer?: string,
  ): Promise<unknown> {
    return this.limiter.schedule(() => requestTransportSafely(this.transport, {
      url: endpoint.startsWith('https://') ? endpoint : `${WEIBO_API_ORIGIN}${endpoint}`,
      params,
      headers: this.createHeaders(targetUid, referer),
      timeoutMs: this.timeoutMs,
    }))
  }

  private createHeaders(targetUid: string, referer?: string): Record<string, string> {
    const headers: Record<string, string> = {
      accept: 'application/json, text/plain, */*',
      cookie: this.cookie,
      referer: referer ?? `${WEIBO_API_ORIGIN}/u/${targetUid}`,
      'user-agent': this.userAgent,
      'x-requested-with': 'XMLHttpRequest',
    }
    const xsrfToken = extractCookieValue(this.cookie, 'XSRF-TOKEN')
    if (xsrfToken !== '') {
      headers['x-xsrf-token'] = xsrfToken
    }
    return headers
  }
}

async function requestTransportSafely(
  transport: WeiboTransport,
  request: WeiboTransportRequest,
): Promise<unknown> {
  try {
    return await transport.get(request)
  } catch (error) {
    if (error instanceof WeiboApiClientError) throw error
    const statusCode = readHttpStatus(error)
    const authenticationFailure = statusCode === 401 || statusCode === 403
    throw new WeiboApiClientError({
      kind: authenticationFailure ? 'authentication' : 'network',
      endpoint: new URL(request.url).pathname,
      statusCode,
      message: authenticationFailure
        ? '微博登录会话已失效或无权访问接口'
        : statusCode === undefined
          ? '微博接口网络请求失败'
          : `微博接口网络请求失败（HTTP ${statusCode}）`,
    })
  }
}

function parseEndpointResponse<T>(
  endpoint: string,
  input: unknown,
  parser: (input: unknown) => T,
): T {
  if (isAuthenticationFailurePayload(input)) {
    throw new WeiboApiClientError({
      kind: 'authentication',
      endpoint,
      message: '微博登录会话已失效，请重新登录',
    })
  }
  try {
    return parser(input)
  } catch {
    throw new WeiboApiClientError({
      kind: 'schema',
      endpoint,
      message: '微博接口响应格式或业务状态无效',
    })
  }
}

function readHttpStatus(error: unknown): number | undefined {
  if (error === null || typeof error !== 'object') return undefined
  const record = error as Record<string, unknown>
  const directStatus = record.status
  if (typeof directStatus === 'number' && Number.isInteger(directStatus)) return directStatus
  const response = record.response
  if (response !== null && typeof response === 'object') {
    const responseStatus = (response as Record<string, unknown>).status
    if (typeof responseStatus === 'number' && Number.isInteger(responseStatus)) return responseStatus
  }
  return undefined
}

function isAuthenticationFailurePayload(input: unknown): boolean {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) return false
  const record = input as Record<string, unknown>
  const data = record.data
  if (
    data !== null &&
    typeof data === 'object' &&
    Array.isArray(data) === false &&
    (data as Record<string, unknown>).login === false
  ) {
    return true
  }
  const message = [record.msg, record.message]
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
  return /(?:未登[录陸]|请.*登[录陸]|login|authentication|cookie.*(?:失效|过期))/i.test(message)
}

export {
  ARTICLE_DETAIL_ENDPOINT,
  LEGACY_ARTICLE_DETAIL_ENDPOINT,
  LOGIN_CONFIG_ENDPOINT,
  LONG_TEXT_ENDPOINT,
  PROFILE_INFO_ENDPOINT,
  SEARCH_PROFILE_ENDPOINT,
  WEIBO_API_ORIGIN,
}

export { extractWeiboArticleId } from '~/src/application/fetch/weibo_canonical_adapter.js'
