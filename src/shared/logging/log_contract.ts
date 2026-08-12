import {
  ApplicationError,
  ServiceLevelValue,
} from '~/src/shared/error/application_error.js'

export const LOG_SCHEMA_VERSION = 1 as const

export const LogStatus = {
  START: 'start',
  PROGRESS: 'progress',
  SUCCESS: 'success',
  PARTIAL_SUCCESS: 'partial_success',
  FAILURE: 'failure',
  SKIP: 'skip',
} as const

export const LogStage = {
  APP: 'app',
  CLI: 'cli',
  CONFIG: 'config',
  INIT: 'init',
  FETCH: 'fetch',
  PERSIST: 'persist',
  GENERATE: 'generate',
  RENDER: 'render',
  OUTPUT: 'output',
  IPC: 'ipc',
  DATABASE: 'database',
  RUNTIME: 'runtime',
} as const

export const LogLevel = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
} as const

export const LogSource = {
  BACKEND: 'backend',
  FRONTEND: 'frontend',
} as const

export const LogEventCode = {
  RUNTIME_GENERIC: 'runtime.generic',
  APP_START: 'app.start',
  APP_ERROR: 'app.error',
  CONFIG_CONTEXT_CREATED: 'config.context.created',
  CONFIG_READ_START: 'config.read.start',
  CONFIG_READ_SUCCESS: 'config.read.success',
  CONFIG_READ_FAILURE: 'config.read.failure',
  IPC_REQUEST_START: 'ipc.request.start',
  IPC_REQUEST_SUCCESS: 'ipc.request.success',
  IPC_REQUEST_PARTIAL_SUCCESS: 'ipc.request.partial_success',
  IPC_REQUEST_FAILURE: 'ipc.request.failure',
  WORKFLOW_START: 'workflow.start',
  WORKFLOW_SUCCESS: 'workflow.success',
  WORKFLOW_PARTIAL_SUCCESS: 'workflow.partial_success',
  WORKFLOW_FAILURE: 'workflow.failure',
  INIT_START: 'init.start',
  INIT_SUCCESS: 'init.success',
  INIT_FAILURE: 'init.failure',
  FETCH_START: 'fetch.start',
  FETCH_SUCCESS: 'fetch.success',
  FETCH_PARTIAL_SUCCESS: 'fetch.partial_success',
  FETCH_FAILURE: 'fetch.failure',
  FETCH_SKIP: 'fetch.skip',
  GENERATE_START: 'generate.start',
  GENERATE_SUCCESS: 'generate.success',
  GENERATE_PARTIAL_SUCCESS: 'generate.partial_success',
  GENERATE_FAILURE: 'generate.failure',
  PERSIST_START: 'persist.start',
  PERSIST_SUCCESS: 'persist.success',
  PERSIST_FAILURE: 'persist.failure',
  OUTPUT_CREATED: 'output.created',
  OUTPUT_FAILURE: 'output.failure',
} as const

export type LogStatusValue = (typeof LogStatus)[keyof typeof LogStatus]
export type LogStageValue = (typeof LogStage)[keyof typeof LogStage]
export type LogLevelValue = (typeof LogLevel)[keyof typeof LogLevel]
export type LogSourceValue = (typeof LogSource)[keyof typeof LogSource]
export type LogEventCodeValue = (typeof LogEventCode)[keyof typeof LogEventCode]

export type SerializedLogError = {
  name: string
  message: string
  stack?: string
  code?: string
  cause?: SerializedLogError
}

export type StructuredLogEntry = {
  traceId?: string
  runId?: string
  jobId?: string
  eventCode?: LogEventCodeValue | string
  source?: LogSourceValue
  stage?: LogStageValue | string
  status?: LogStatusValue
  level: LogLevelValue
  serviceLevel?: ServiceLevelValue
  taskType?: string
  entityType?: string
  entityId?: string
  durationMs?: number
  errorCode?: string
  error?: SerializedLogError
  details?: Record<string, unknown>
  message: string
}

export type StructuredLogRecord = StructuredLogEntry & {
  schemaVersion: typeof LOG_SCHEMA_VERSION
  triggerAt: string
  eventCode: string
  source: LogSourceValue
}

const SENSITIVE_KEY_SET = new Set([
  'authorization',
  'auth',
  'password',
  'passwd',
  'secret',
  'header',
  'headers',
  'requestheader',
  'requestheaders',
  'responseheader',
  'responseheaders',
])
const CONTENT_KEY_SET = new Set([
  'body',
  'rawbody',
  'responsebody',
  'responsedata',
  'rawresponse',
  'rawjson',
  'html',
  'content',
  'text',
])
const MAX_STRING_LENGTH = 512
const MAX_STACK_LENGTH = 4000
const MAX_ARRAY_LENGTH = 50
const MAX_OBJECT_KEYS = 100
const MAX_DEPTH = 8
const OPERATIONAL_PATH_KEY = /^(?:outputPath|targetPath|diagnosticPath)$/i

function normalizedKey(key?: string): string {
  return (key ?? '').replace(/[^a-z0-9]/gi, '').toLowerCase()
}

function isSensitiveKey(key?: string): boolean {
  const normalized = normalizedKey(key)
  return (
    SENSITIVE_KEY_SET.has(normalized) ||
    normalized.includes('cookie') ||
    normalized.endsWith('token')
  )
}

function summarizeString(rawValue: string, key?: string): string {
  if (isSensitiveKey(key) || CONTENT_KEY_SET.has(normalizedKey(key))) {
    return '[REDACTED]'
  }
  let value = rawValue
    .replace(
      /(["']?\b(?:cookie|authorization|set-cookie|access-token|refresh-token|token|password|secret|headers?|body|content|html|rawjson)["']?\s*[:=]\s*)(?:["'][^"'\r\n]*["']|(?:bearer\s+)?[^\s,;}\r\n]+)/gi,
      '$1[REDACTED]',
    )
    .replace(/\b(bearer)\s+[a-z0-9._~+\/-]+=*/gi, '$1 [REDACTED]')

  value = value.replace(/https?:\/\/[^\s"'<>]+/gi, (rawUrl) => {
    try {
      const url = new URL(rawUrl)
      return `${url.origin}${url.pathname}${url.search || url.hash ? '?[REDACTED]' : ''}`
    } catch {
      return rawUrl
    }
  })
  if (/^[a-zA-Z]:[\\/]/.test(value) && !OPERATIONAL_PATH_KEY.test(key ?? '')) {
    const parts = value.replace(/\\/g, '/').split('/')
    if (parts.length > 3) {
      value = `${parts[0]}/.../${parts.slice(-2).join('/')}`
    }
  }
  return value.length > MAX_STRING_LENGTH
    ? `${value.slice(0, MAX_STRING_LENGTH)}...[truncated:${value.length}]`
    : value
}

export function sanitizeLogValue(
  value: unknown,
  key?: string,
  depth = 0,
  seen = new WeakSet<object>(),
): unknown {
  if (isSensitiveKey(key) || CONTENT_KEY_SET.has(normalizedKey(key))) {
    return '[REDACTED]'
  }
  if (value === null || value === undefined || typeof value === 'boolean' || typeof value === 'number') {
    return value
  }
  if (typeof value === 'string') {
    return summarizeString(value, key)
  }
  if (typeof value === 'bigint') {
    return value.toString()
  }
  if (typeof value === 'function' || typeof value === 'symbol') {
    return `[${typeof value}]`
  }
  if (value instanceof Error) {
    return serializeLogError(value)
  }
  if (value instanceof Date) {
    return value.toISOString()
  }
  if (typeof value !== 'object') {
    return summarizeString(String(value), key)
  }
  if (depth >= MAX_DEPTH) {
    return '[MaxDepth]'
  }
  if (seen.has(value)) {
    return '[Circular]'
  }
  seen.add(value)
  if (Array.isArray(value)) {
    const result: unknown[] = value
      .slice(0, MAX_ARRAY_LENGTH)
      .map((item) => sanitizeLogValue(item, undefined, depth + 1, seen))
    if (value.length > MAX_ARRAY_LENGTH) {
      result.push(`[truncated:${value.length - MAX_ARRAY_LENGTH}]`)
    }
    return result
  }
  const record = value as Record<string, unknown>
  const keyList = Object.keys(record)
  const result: Record<string, unknown> = {}
  for (const currentKey of keyList.slice(0, MAX_OBJECT_KEYS)) {
    result[currentKey] = sanitizeLogValue(record[currentKey], currentKey, depth + 1, seen)
  }
  if (keyList.length > MAX_OBJECT_KEYS) {
    result.__truncatedKeys = keyList.length - MAX_OBJECT_KEYS
  }
  return result
}

function safeStringify(value: unknown): string {
  if (typeof value === 'string') {
    return value
  }
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

export function serializeLogError(
  error: unknown,
  depth = 0,
  seen = new WeakSet<object>(),
): SerializedLogError {
  if (error instanceof Error) {
    if (seen.has(error)) {
      return { name: 'CircularError', message: '[Circular]' }
    }
    if (depth >= MAX_DEPTH) {
      return { name: 'NestedError', message: '[MaxDepth]' }
    }
    seen.add(error)
    const code = (error as Error & { code?: unknown }).code
    const cause = error instanceof ApplicationError
      ? error.cause
      : (error as Error & { cause?: unknown }).cause
    return {
      name: summarizeString(error.name || 'Error'),
      message: summarizeString(error.message),
      stack: error.stack ? summarizeString(error.stack.slice(0, MAX_STACK_LENGTH)) : undefined,
      code: typeof code === 'string' ? summarizeString(code) : undefined,
      cause: cause === undefined || cause === error ? undefined : serializeLogError(cause, depth + 1, seen),
    }
  }
  return {
    name: 'NonError',
    message: summarizeString(safeStringify(sanitizeLogValue(error))),
  }
}

export function createStructuredLogRecord(
  entry: StructuredLogEntry,
  triggerAt = new Date().toISOString(),
): StructuredLogRecord {
  const sanitized = sanitizeLogValue(entry) as StructuredLogEntry
  return {
    ...sanitized,
    level: entry.level,
    message: summarizeString(entry.message),
    error: entry.error
      ? sanitizeLogValue(entry.error, 'error') as SerializedLogError
      : undefined,
    schemaVersion: LOG_SCHEMA_VERSION,
    triggerAt,
    eventCode: sanitized.eventCode ?? (
      sanitized.stage && sanitized.status
        ? `${sanitized.stage}.${sanitized.status}`
        : LogEventCode.RUNTIME_GENERIC
    ),
    source: sanitized.source ?? LogSource.BACKEND,
  }
}
