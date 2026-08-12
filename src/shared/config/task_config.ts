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
  enableAutoConfig: boolean
  postAtOrderBy: (typeof PostOrder)[keyof typeof PostOrder]
  fetchStartAtPageNo: number
  fetchEndAtPageNo: number
  outputStartAtMs: number
  outputEndAtMs: number
  onlyRetry: boolean
  isSkipFetch: boolean
  isSkipGeneratePdf: boolean
  isRegenerateHtml2PdfImage: boolean
  isOnlyArticle: boolean
  isOnlyOriginal: boolean
  volumeSplitBy: (typeof VolumeSplit)[keyof typeof VolumeSplit]
  volumeSplitCount: number
}

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

  const fetchStartAtPageNo = requireFiniteNumber(record.fetchStartAtPageNo, 'fetchStartAtPageNo', 0)
  const fetchEndAtPageNo = requireFiniteNumber(record.fetchEndAtPageNo, 'fetchEndAtPageNo', 0)
  if (fetchEndAtPageNo < fetchStartAtPageNo) {
    throw invalidConfig('fetchEndAtPageNo不能小于fetchStartAtPageNo')
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
    enableAutoConfig: requireBoolean(record.enableAutoConfig, 'enableAutoConfig'),
    postAtOrderBy: requireEnum(record.postAtOrderBy, Object.values(PostOrder), 'postAtOrderBy'),
    fetchStartAtPageNo,
    fetchEndAtPageNo,
    outputStartAtMs,
    outputEndAtMs,
    onlyRetry: requireBoolean(record.onlyRetry, 'onlyRetry'),
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
  config.configList.forEach((task, index) => {
    if (task.uid.trim() === '') {
      throw invalidConfig(`configList[${index}].uid必须在启动任务前填写`)
    }
  })
  return config
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
