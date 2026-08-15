import fs from 'node:fs'
import json5 from 'json5'
import { AppErrorCode, ApplicationError, ServiceLevel } from '~/src/shared/error/application_error.js'

export const ImageQuality = {
  DEFAULT: 'default',
  NONE: 'none',
  RAW: 'raw',
  HD: 'hd',
} as const

export const PostOrder = {
  ASC: 'asc',
  DESC: 'desc',
} as const

export const VolumeSplit = {
  SINGLE: 'single',
  YEAR: 'year',
  MONTH: 'month',
  COUNT: 'count',
} as const

export const CacheReadMode = {
  PREFER_CACHE: 'prefer-cache',
  REFRESH: 'refresh',
} as const

export type CacheReadModeValue = (typeof CacheReadMode)[keyof typeof CacheReadMode]

export type TaskRecord = {
  uid: string
  rawInputText: string
  comment: string
}

export type CustomerTaskConfig = {
  configList: TaskRecord[]
  imageQuilty: (typeof ImageQuality)[keyof typeof ImageQuality]
  bookTitle: string
  comment: string
  postAtOrderBy: (typeof PostOrder)[keyof typeof PostOrder]
  fetchStartDate: string
  fetchEndDate: string
  requestIntervalSeconds: number
  cacheReadMode: CacheReadModeValue
  outputStartAtMs: number
  outputEndAtMs: number
  isSkipFetch: boolean
  isSkipGeneratePdf: boolean
  isRegenerateHtml2PdfImage: boolean
  isOnlyArticle: boolean
  isOnlyOriginal: boolean
  volumeSplitBy: (typeof VolumeSplit)[keyof typeof VolumeSplit]
  volumeSplitCount: number
}

const MIN_FETCH_DATE = '2009-09-01'
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

type UnknownRecord = Record<string, unknown>

function requireRecord(value: unknown, label: string): UnknownRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw invalidConfig(`${label}必须是对象`)
  }
  return value as UnknownRecord
}

function requireString(value: unknown, label: string, allowEmpty = true): string {
  if (typeof value !== 'string' || (!allowEmpty && value.trim() === '')) {
    throw invalidConfig(`${label}必须是${allowEmpty ? '' : '非空'}字符串`)
  }
  return value
}

function requireBoolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') {
    throw invalidConfig(`${label}必须是布尔值`)
  }
  return value
}

function requireFiniteNumber(value: unknown, label: string, minimum?: number): number {
  if (typeof value !== 'number' || Number.isFinite(value) === false || (minimum !== undefined && value < minimum)) {
    throw invalidConfig(`${label}必须是${minimum === undefined ? '' : `不小于 ${minimum} 的`}有限数值`)
  }
  return value
}

function requireInteger(value: unknown, label: string, minimum: number, maximum?: number): number {
  const result = requireFiniteNumber(value, label, minimum)
  if (Number.isInteger(result) === false || (maximum !== undefined && result > maximum)) {
    throw invalidConfig(`${label}必须是${minimum}~${maximum ?? '∞'}之间的整数`)
  }
  return result
}

function shanghaiDateString(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

function requireDateString(value: unknown, label: string): string {
  const result = requireString(value, label, false)
  if (DATE_PATTERN.test(result) === false) {
    throw invalidConfig(`${label}必须是YYYY-MM-DD格式`)
  }
  const parsed = new Date(`${result}T00:00:00+08:00`)
  if (Number.isNaN(parsed.getTime()) || shanghaiDateString(parsed) !== result) {
    throw invalidConfig(`${label}不是有效日期`)
  }
  return result
}

function requireEnum<T extends string>(value: unknown, values: readonly T[], label: string): T {
  if (typeof value !== 'string' || values.includes(value as T) === false) {
    throw invalidConfig(`${label}必须是 ${values.join('、')} 之一`)
  }
  return value as T
}

function invalidConfig(message: string, cause?: unknown): ApplicationError {
  return new ApplicationError({
    code: AppErrorCode.CONFIG_SCHEMA_INVALID,
    message,
    serviceLevel: ServiceLevel.S0,
    stage: 'config',
    retryable: false,
    cause,
  })
}

/**
 * 第一阶段的任务配置运行时 schema。旧配置不会静默补默认值，避免错误配置进入抓取链路。
 */
export function parseCustomerTaskConfig(input: unknown): CustomerTaskConfig {
  const record = requireRecord(input, '任务配置')
  if (Array.isArray(record.configList) === false) {
    throw invalidConfig('configList必须是数组')
  }
  const configList = record.configList.map((rawTask, index) => {
    const task = requireRecord(rawTask, `configList[${index}]`)
    return {
      uid: requireString(task.uid, `configList[${index}].uid`),
      rawInputText: requireString(task.rawInputText, `configList[${index}].rawInputText`),
      comment: requireString(task.comment, `configList[${index}].comment`),
    }
  })

  const fetchStartDate = requireDateString(record.fetchStartDate, 'fetchStartDate')
  const fetchEndDate = requireDateString(record.fetchEndDate, 'fetchEndDate')
  if (fetchStartDate < MIN_FETCH_DATE) {
    throw invalidConfig(`fetchStartDate不能早于${MIN_FETCH_DATE}`)
  }
  if (fetchEndDate < fetchStartDate) {
    throw invalidConfig('fetchEndDate不能早于fetchStartDate')
  }
  if (fetchEndDate > shanghaiDateString()) {
    throw invalidConfig('fetchEndDate不能晚于北京时间今天')
  }
  const outputStartAtMs = requireFiniteNumber(record.outputStartAtMs, 'outputStartAtMs', 0)
  const outputEndAtMs = requireFiniteNumber(record.outputEndAtMs, 'outputEndAtMs', 0)
  if (outputEndAtMs < outputStartAtMs) {
    throw invalidConfig('outputEndAtMs不能小于outputStartAtMs')
  }

  return {
    configList,
    imageQuilty: requireEnum(record.imageQuilty, Object.values(ImageQuality), 'imageQuilty'),
    bookTitle: requireString(record.bookTitle, 'bookTitle'),
    comment: requireString(record.comment, 'comment'),
    postAtOrderBy: requireEnum(record.postAtOrderBy, Object.values(PostOrder), 'postAtOrderBy'),
    fetchStartDate,
    fetchEndDate,
    requestIntervalSeconds: requireInteger(record.requestIntervalSeconds, 'requestIntervalSeconds', 10, 3600),
    cacheReadMode: requireEnum(record.cacheReadMode, Object.values(CacheReadMode), 'cacheReadMode'),
    outputStartAtMs,
    outputEndAtMs,
    isSkipFetch: requireBoolean(record.isSkipFetch, 'isSkipFetch'),
    isSkipGeneratePdf: requireBoolean(record.isSkipGeneratePdf, 'isSkipGeneratePdf'),
    isRegenerateHtml2PdfImage: requireBoolean(record.isRegenerateHtml2PdfImage, 'isRegenerateHtml2PdfImage'),
    isOnlyArticle: requireBoolean(record.isOnlyArticle, 'isOnlyArticle'),
    isOnlyOriginal: requireBoolean(record.isOnlyOriginal, 'isOnlyOriginal'),
    volumeSplitBy: requireEnum(record.volumeSplitBy, Object.values(VolumeSplit), 'volumeSplitBy'),
    volumeSplitCount: requireFiniteNumber(record.volumeSplitCount, 'volumeSplitCount', 1),
  }
}

export function assertRunnableCustomerTaskConfig(config: CustomerTaskConfig): CustomerTaskConfig {
  if (config.configList.length === 0) {
    throw invalidConfig('任务配置至少需要一个微博用户')
  }
  const uidSet = new Set<string>()
  config.configList.forEach((task, index) => {
    const uid = task.uid
    if (/^\d{1,32}$/.test(uid) === false) {
      throw invalidConfig(`configList[${index}].uid必须是数字字符串`)
    }
    if (uidSet.has(uid)) {
      throw invalidConfig(`configList[${index}].uid与前面的目标用户重复`)
    }
    uidSet.add(uid)
  })
  return config
}

export function createDefaultCustomerTaskConfig(now: Date = new Date()): CustomerTaskConfig {
  const today = shanghaiDateString(now)
  const outputStartAtMs = new Date(`${MIN_FETCH_DATE}T00:00:00+08:00`).getTime()
  const outputEndAtMs = new Date(`${today}T23:59:59+08:00`).getTime()
  return {
    configList: [{ uid: '', rawInputText: '', comment: '' }],
    imageQuilty: ImageQuality.DEFAULT,
    bookTitle: '',
    comment: '',
    postAtOrderBy: PostOrder.ASC,
    fetchStartDate: MIN_FETCH_DATE,
    fetchEndDate: today,
    requestIntervalSeconds: 10,
    cacheReadMode: CacheReadMode.PREFER_CACHE,
    outputStartAtMs,
    outputEndAtMs,
    isSkipFetch: false,
    isSkipGeneratePdf: false,
    isRegenerateHtml2PdfImage: false,
    isOnlyArticle: false,
    isOnlyOriginal: false,
    volumeSplitBy: VolumeSplit.SINGLE,
    volumeSplitCount: 10000,
  }
}

export function readCustomerTaskConfig(configPath: string): CustomerTaskConfig {
  let content: string
  try {
    content = fs.readFileSync(configPath, 'utf8')
  } catch (error) {
    throw invalidConfig(`无法读取任务配置：${configPath}`, error)
  }
  try {
    return parseCustomerTaskConfig(json5.parse(content))
  } catch (error) {
    if (error instanceof ApplicationError) {
      throw error
    }
    throw invalidConfig(`无法解析任务配置：${configPath}`, error)
  }
}

export function writeCustomerTaskConfig(configPath: string, input: unknown): CustomerTaskConfig {
  const config = parseCustomerTaskConfig(input)
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8')
  return config
}
