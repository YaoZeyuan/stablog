export const ServiceLevel = {
  S0: 'S0',
  S1: 'S1',
  S2: 'S2',
  S3: 'S3',
} as const

export type ServiceLevelValue = (typeof ServiceLevel)[keyof typeof ServiceLevel]

export const AppErrorCode = {
  CONFIG_SCHEMA_INVALID: 'CONFIG_SCHEMA_INVALID',
  IPC_PAYLOAD_INVALID: 'IPC_PAYLOAD_INVALID',
  WORKFLOW_FAILED: 'WORKFLOW_FAILED',
  INITIALIZATION_FAILED: 'INITIALIZATION_FAILED',
  FETCH_FAILED: 'FETCH_FAILED',
  GENERATE_FAILED: 'GENERATE_FAILED',
  DATABASE_FAILED: 'DATABASE_FAILED',
  FILE_SYSTEM_FAILED: 'FILE_SYSTEM_FAILED',
  LOG_WRITE_FAILED: 'LOG_WRITE_FAILED',
  DIAGNOSTIC_FAILED: 'DIAGNOSTIC_FAILED',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const

export type AppErrorCodeValue = (typeof AppErrorCode)[keyof typeof AppErrorCode]

export const ApplicationFailureKind = {
  STARTUP: 'startup',
  DATABASE: 'database',
  FILE_SYSTEM: 'file_system',
  LOG_WRITE: 'log_write',
  DIAGNOSTIC: 'diagnostic',
} as const

export type ApplicationFailureKindValue =
  (typeof ApplicationFailureKind)[keyof typeof ApplicationFailureKind]

export type ApplicationErrorOptions = {
  code: AppErrorCodeValue | string
  message: string
  serviceLevel: ServiceLevelValue
  stage: string
  retryable: boolean
  cause?: unknown
  details?: Record<string, unknown>
}

export type ApplicationErrorClassificationOptions = {
  message?: string
  stage?: string
  retryable?: boolean
  details?: Record<string, unknown>
}

export type SerializedApplicationError = {
  name: 'ApplicationError'
  code: string
  message: string
  serviceLevel: ServiceLevelValue
  stage: string
  retryable: boolean
  stack?: string
  details?: Record<string, unknown>
  cause?: {
    name: string
    message: string
    code?: string
    stack?: string
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && Array.isArray(value) === false
}

function isServiceLevel(value: unknown): value is ServiceLevelValue {
  return Object.values(ServiceLevel).includes(value as ServiceLevelValue)
}

function serializeCause(cause: unknown): SerializedApplicationError['cause'] {
  if (cause === undefined) {
    return undefined
  }
  if (cause instanceof Error) {
    const code = (cause as Error & { code?: unknown }).code
    return {
      name: cause.name || 'Error',
      message: cause.message,
      code: typeof code === 'string' ? code : undefined,
      stack: cause.stack,
    }
  }
  return {
    name: 'NonError',
    message: safeStringify(cause),
  }
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

/**
 * 业务边界使用的稳定错误。serviceLevel 描述影响，retryable 描述调用方能否原样重试。
 */
export class ApplicationError extends Error {
  readonly code: string
  readonly serviceLevel: ServiceLevelValue
  readonly stage: string
  readonly retryable: boolean
  readonly cause?: unknown
  readonly details?: Record<string, unknown>

  constructor(options: ApplicationErrorOptions) {
    super(options.message, options.cause === undefined ? undefined : { cause: options.cause })
    this.name = 'ApplicationError'
    this.code = options.code
    this.serviceLevel = options.serviceLevel
    this.stage = options.stage
    this.retryable = options.retryable
    this.cause = options.cause
    this.details = options.details
  }

  static from(error: unknown, defaults: Partial<ApplicationErrorOptions> = {}): ApplicationError {
    if (error instanceof ApplicationError) {
      return error
    }
    if (isRecord(error) && error.name === 'ApplicationError') {
      try {
        return ApplicationError.fromSerialized(error as SerializedApplicationError)
      } catch {
        // Invalid external records are wrapped below rather than trusted.
      }
    }
    const errorMessage = error instanceof Error ? error.message : safeStringify(error)
    return new ApplicationError({
      code: defaults.code ?? AppErrorCode.UNKNOWN_ERROR,
      message: defaults.message ?? errorMessage,
      serviceLevel: defaults.serviceLevel ?? ServiceLevel.S1,
      stage: defaults.stage ?? 'runtime',
      retryable: defaults.retryable ?? false,
      cause: defaults.cause ?? error,
      details: defaults.details,
    })
  }

  static fromSerialized(error: SerializedApplicationError): ApplicationError {
    if (
      !isRecord(error) ||
      error.name !== 'ApplicationError' ||
      typeof error.code !== 'string' ||
      typeof error.message !== 'string' ||
      !isServiceLevel(error.serviceLevel) ||
      typeof error.stage !== 'string' ||
      typeof error.retryable !== 'boolean'
    ) {
      throw new TypeError('SerializedApplicationError schema 无效')
    }
    const result = new ApplicationError({
      code: error.code,
      message: error.message,
      serviceLevel: error.serviceLevel,
      stage: error.stage,
      retryable: error.retryable,
      cause: error.cause === undefined ? undefined : Object.assign(new Error(error.cause.message), error.cause),
      details: isRecord(error.details) ? error.details : undefined,
    })
    if (typeof error.stack === 'string') {
      result.stack = error.stack
    }
    return result
  }

  toJSON(): SerializedApplicationError {
    return {
      name: 'ApplicationError',
      code: this.code,
      message: this.message,
      serviceLevel: this.serviceLevel,
      stage: this.stage,
      retryable: this.retryable,
      stack: this.stack,
      details: this.details,
      cause: serializeCause(this.cause),
    }
  }
}

type ErrorClassification = Pick<
  ApplicationErrorOptions,
  'code' | 'serviceLevel' | 'stage' | 'retryable'
>

const ERROR_CLASSIFICATION: Record<ApplicationFailureKindValue, ErrorClassification> = {
  [ApplicationFailureKind.STARTUP]: {
    code: AppErrorCode.INITIALIZATION_FAILED,
    serviceLevel: ServiceLevel.S0,
    stage: 'app',
    retryable: false,
  },
  [ApplicationFailureKind.DATABASE]: {
    code: AppErrorCode.DATABASE_FAILED,
    serviceLevel: ServiceLevel.S0,
    stage: 'database',
    retryable: true,
  },
  [ApplicationFailureKind.FILE_SYSTEM]: {
    code: AppErrorCode.FILE_SYSTEM_FAILED,
    serviceLevel: ServiceLevel.S2,
    stage: 'filesystem',
    retryable: false,
  },
  [ApplicationFailureKind.LOG_WRITE]: {
    code: AppErrorCode.LOG_WRITE_FAILED,
    serviceLevel: ServiceLevel.S3,
    stage: 'logging',
    retryable: false,
  },
  [ApplicationFailureKind.DIAGNOSTIC]: {
    code: AppErrorCode.DIAGNOSTIC_FAILED,
    serviceLevel: ServiceLevel.S3,
    stage: 'diagnostic',
    retryable: false,
  },
}

/**
 * 将基础设施边界的原始异常稳定映射到错误码和服务等级。
 * 即使原始异常已经是 ApplicationError，也会按当前边界重新分类并把它保留为 cause。
 */
export function classifyApplicationError(
  error: unknown,
  kind: ApplicationFailureKindValue,
  options: ApplicationErrorClassificationOptions = {},
): ApplicationError {
  const classification = ERROR_CLASSIFICATION[kind]
  const fallbackMessage = error instanceof Error ? error.message : safeStringify(error)
  return new ApplicationError({
    ...classification,
    message: options.message ?? fallbackMessage,
    stage: options.stage ?? classification.stage,
    retryable: options.retryable ?? classification.retryable,
    cause: error,
    details: options.details,
  })
}
