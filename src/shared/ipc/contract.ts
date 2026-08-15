import fs from 'node:fs'
import path from 'node:path'
import { AppErrorCode, ApplicationError, ServiceLevel } from '~/src/shared/error/application_error.js'
import {
  assertRunnableCustomerTaskConfig,
  parseCustomerTaskConfig,
  CustomerTaskConfig,
} from '~/src/shared/config/task_config.js'

export type IpcTraceMetadata = {
  traceId?: string
}

export type StartCustomerTaskRequest = {
  config: CustomerTaskConfig
}

export type TaskCommandAck = {
  outcome: 'started' | 'already_running'
  batchId: string
  runId: string
}

export type TaskProgressCounts = {
  total: number
  pending: number
  running: number
  succeeded: number
  failed: number
  cacheHits: number
}

export type CustomerTaskDashboard = {
  activeRun: null | { batchId: string; runId: string }
  batch: null | {
    batchId: string
    status: 'pending' | 'running' | 'succeeded' | 'partial_success' | 'failed'
    resumable: boolean
    phase: 'planning' | 'fetching' | 'generating' | 'done'
    createdAt: number
    startedAt?: number
    finishedAt?: number
    estimatedRemainingSeconds: number | null
    current?: {
      uid: string
      screenName?: string
      year?: number
      month?: number
      segmentStartDate?: string
      segmentEndDate?: string
      page?: number
      pageCount?: number
    }
    counts: TaskProgressCounts
    users: Array<{
      uid: string
      screenName?: string
      status: 'pending' | 'running' | 'succeeded' | 'partial_success' | 'failed'
      counts: TaskProgressCounts
    }>
  }
}

export type CustomerTaskFailureSummary = {
  taskId: string
  taskType: 'year_probe' | 'month_probe' | 'segment_probe' | 'page' | 'long_text' | 'article'
  uid: string
  screenName?: string
  segmentStartDate?: string
  segmentEndDate?: string
  page?: number
  attempts: number
  errorCode?: string
  errorMessage?: string
  updatedAt?: number
}

export type PathConfigResponse = {
  configUri: string
  customerTaskConfigUri: string
  outputPath: string
  runtimeLogUri: string
}

export type WeiboLoginStatus = {
  isLogin: boolean
  uid: string
}

export type WeiboUserSummary = {
  screen_name: string
  statuses_count: number
  total_page_count: number
  followers_count: number
}

export type DataTransferExportRequest = {
  exportUri: string
  uid: string
  exportStartAt: number
  exportEndAt: number
}

export type DataTransferImportRequest = {
  importUri: string
}

export type IpcPathPolicy = {
  allowedFiles?: string[]
  allowedDirectories?: string[]
}

function invalidPayload(message: string): ApplicationError {
  return new ApplicationError({
    code: AppErrorCode.IPC_PAYLOAD_INVALID,
    message,
    serviceLevel: ServiceLevel.S0,
    stage: 'ipc',
    retryable: false,
  })
}

function canonicalizePath(targetPath: string): string {
  const resolved = path.resolve(targetPath)
  let existingPath = resolved
  const missingPartList: string[] = []
  while (fs.existsSync(existingPath) === false) {
    const parentPath = path.dirname(existingPath)
    if (parentPath === existingPath) {
      return resolved
    }
    missingPartList.unshift(path.basename(existingPath))
    existingPath = parentPath
  }
  return path.resolve(fs.realpathSync.native(existingPath), ...missingPartList)
}

function isWithinDirectory(targetPath: string, directoryPath: string): boolean {
  const relative = path.relative(directoryPath, targetPath)
  return relative === '' || (relative.startsWith('..') === false && path.isAbsolute(relative) === false)
}

/** Resolve existing symlinks before enforcing a renderer-accessible path policy. */
export function assertAllowedIpcPath(targetPath: string, policy: IpcPathPolicy): string {
  const canonicalTarget = canonicalizePath(targetPath)
  const allowedFileList = (policy.allowedFiles ?? []).map(canonicalizePath)
  const allowedDirectoryList = (policy.allowedDirectories ?? []).map(canonicalizePath)
  if (
    allowedFileList.includes(canonicalTarget) === false &&
    allowedDirectoryList.some((directoryPath) => isWithinDirectory(canonicalTarget, directoryPath)) === false
  ) {
    throw invalidPayload('拒绝访问稳部落授权数据目录之外的路径')
  }
  return canonicalTarget
}

function requireRecord(input: unknown, label: string): Record<string, unknown> {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw invalidPayload(`${label}必须是对象`)
  }
  return input as Record<string, unknown>
}

export function parseIpcTraceMetadata(input: unknown): IpcTraceMetadata {
  if (input === undefined) {
    return {}
  }
  const record = requireRecord(input, 'IPC metadata')
  if (record.traceId !== undefined && (typeof record.traceId !== 'string' || record.traceId.trim() === '')) {
    throw invalidPayload('traceId必须是非空字符串')
  }
  return { traceId: record.traceId as string | undefined }
}

export function parseStartCustomerTaskRequest(input: unknown): StartCustomerTaskRequest {
  const record = requireRecord(input, 'startCustomerTask请求')
  return { config: assertRunnableCustomerTaskConfig(parseCustomerTaskConfig(record.config)) }
}

function requireIdentifier(value: unknown, label: string): string {
  if (typeof value !== 'string' || /^[a-zA-Z0-9_-]{1,128}$/.test(value) === false) {
    throw invalidPayload(`${label}格式无效`)
  }
  return value
}

function requireNonNegativeInteger(value: unknown, label: string): number {
  if (typeof value !== 'number' || Number.isInteger(value) === false || value < 0) {
    throw invalidPayload(`${label}必须是非负整数`)
  }
  return value
}

export function parseContinueCustomerTaskRequest(input: unknown): { batchId: string } {
  const record = requireRecord(input, 'continueCustomerTask请求')
  return { batchId: requireIdentifier(record.batchId, 'batchId') }
}

export function parseRetryCustomerTaskItemsRequest(input: unknown): { batchId: string; taskIds?: string[] } {
  const record = requireRecord(input, 'retryCustomerTaskItems请求')
  let taskIds: string[] | undefined
  if (record.taskIds !== undefined) {
    if (Array.isArray(record.taskIds) === false || record.taskIds.length === 0 || record.taskIds.length > 100) {
      throw invalidPayload('taskIds必须是1~100项的数组')
    }
    taskIds = [...new Set(record.taskIds.map((value) => requireIdentifier(value, 'taskId')))]
  }
  return { batchId: requireIdentifier(record.batchId, 'batchId'), taskIds }
}

export function parseCustomerTaskDashboardRequest(input: unknown): { batchId?: string } {
  if (input === undefined || input === null) {
    return {}
  }
  const record = requireRecord(input, 'customerTaskDashboard请求')
  return { batchId: record.batchId === undefined ? undefined : requireIdentifier(record.batchId, 'batchId') }
}

export function parseCustomerTaskFailuresRequest(input: unknown): {
  batchId: string
  offset: number
  limit: number
} {
  const record = requireRecord(input, 'customerTaskFailures请求')
  const offset = record.offset === undefined ? 0 : requireNonNegativeInteger(record.offset, 'offset')
  const limit = record.limit === undefined ? 50 : requireNonNegativeInteger(record.limit, 'limit')
  if (limit < 1 || limit > 100) {
    throw invalidPayload('limit必须是1~100之间的整数')
  }
  return { batchId: requireIdentifier(record.batchId, 'batchId'), offset, limit }
}

export function parseClearWeiboRequestCacheRequest(input: unknown): { targetUid: string } {
  const record = requireRecord(input, 'clearWeiboRequestCache请求')
  if (typeof record.targetUid !== 'string' || /^\d{1,32}$/.test(record.targetUid) === false) {
    throw invalidPayload('targetUid必须是数字字符串')
  }
  return { targetUid: record.targetUid }
}

export function parseFileReadRequest(input: unknown): { uri: string } {
  const record = requireRecord(input, '文件读取请求')
  if (typeof record.uri !== 'string' || record.uri.trim() === '') {
    throw invalidPayload('文件读取路径必须是非空字符串')
  }
  return { uri: record.uri }
}

export function parseFileWriteRequest(input: unknown): { uri: string; content: string } {
  const record = requireRecord(input, '文件写入请求')
  if (typeof record.uri !== 'string' || record.uri.trim() === '' || typeof record.content !== 'string') {
    throw invalidPayload('文件写入请求必须包含有效的uri和content')
  }
  return { uri: record.uri, content: record.content }
}

export function parseResolveWeiboUidRequest(input: unknown): { rawInputUrl: string } {
  const record = requireRecord(input, '微博主页解析请求')
  if (typeof record.rawInputUrl !== 'string' || record.rawInputUrl.trim() === '' || record.rawInputUrl.length > 2048) {
    throw invalidPayload('微博主页地址必须是长度不超过 2048 的非空字符串')
  }
  let parsed: URL
  try {
    parsed = new URL(record.rawInputUrl.trim())
  } catch {
    throw invalidPayload('微博主页地址格式无效')
  }
  const hostname = parsed.hostname.toLowerCase()
  if (
    (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') ||
    (hostname !== 'weibo.com' && hostname !== 'www.weibo.com' && hostname !== 'm.weibo.cn')
  ) {
    throw invalidPayload('只允许解析 weibo.com 或 m.weibo.cn 的主页地址')
  }
  const pathname = parsed.pathname.replace(/\/+$/, '')
  if (
    /^\/(?:u|profile)\/\d+$/.test(pathname) === false &&
    /^\/n\/[^/]+$/.test(pathname) === false &&
    /^\/[^/]+$/.test(pathname) === false
  ) {
    throw invalidPayload('微博主页地址路径无效')
  }
  return { rawInputUrl: parsed.toString() }
}

export function parseWeiboUserInfoRequest(input: unknown): { uid: string } {
  const record = requireRecord(input, '微博用户信息请求')
  if (typeof record.uid !== 'string' || /^\d{1,32}$/.test(record.uid) === false) {
    throw invalidPayload('微博 uid 必须是数字字符串')
  }
  return { uid: record.uid }
}

function requireJsonPath(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '' || value.toLowerCase().endsWith('.json') === false) {
    throw invalidPayload(`${label}必须是 .json 文件路径`)
  }
  return value
}

export function parseDataTransferExportRequest(input: unknown): DataTransferExportRequest {
  const record = requireRecord(input, '数据导出请求')
  const exportUri = requireJsonPath(record.exportUri, 'exportUri')
  if (typeof record.uid !== 'string' || /^\d{1,32}$/.test(record.uid) === false) {
    throw invalidPayload('数据导出 uid 必须是数字字符串')
  }
  if (
    typeof record.exportStartAt !== 'number' || Number.isFinite(record.exportStartAt) === false ||
    typeof record.exportEndAt !== 'number' || Number.isFinite(record.exportEndAt) === false ||
    record.exportEndAt < record.exportStartAt
  ) {
    throw invalidPayload('数据导出时间范围无效')
  }
  return {
    exportUri,
    uid: record.uid,
    exportStartAt: record.exportStartAt,
    exportEndAt: record.exportEndAt,
  }
}

export function parseDataTransferImportRequest(input: unknown): DataTransferImportRequest {
  const record = requireRecord(input, '数据导入请求')
  return { importUri: requireJsonPath(record.importUri, 'importUri') }
}
