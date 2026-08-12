import { ApplicationError, SerializedApplicationError } from '~/src/shared/error/application_error.js'

export const ExecutionStatus = {
  SUCCESS: 'success',
  PARTIAL_SUCCESS: 'partial_success',
  FAILURE: 'failure',
} as const

export type ExecutionStatusValue = (typeof ExecutionStatus)[keyof typeof ExecutionStatus]

export type ExecutionFailure = {
  taskType?: string
  entityType?: string
  entityId?: string
  error: SerializedApplicationError
}

export type ExecutionResult<T = unknown> = {
  status: ExecutionStatusValue
  value?: T
  successCount: number
  failureCount: number
  failures: ExecutionFailure[]
}

export function createExecutionSuccess<T = undefined>(value?: T, successCount = 0): ExecutionResult<T> {
  return {
    status: ExecutionStatus.SUCCESS,
    value,
    successCount,
    failureCount: 0,
    failures: [],
  }
}

export function createExecutionPartial<T = undefined>(
  value: T | undefined,
  successCount: number,
  failures: ExecutionFailure[],
): ExecutionResult<T> {
  if (failures.length === 0) {
    throw new TypeError('partial_success 必须包含至少一个失败项')
  }
  return {
    status: ExecutionStatus.PARTIAL_SUCCESS,
    value,
    successCount,
    failureCount: failures.length,
    failures,
  }
}

export function createExecutionFailure<T = never>(
  error: unknown,
  failure: Omit<ExecutionFailure, 'error'> = {},
): ExecutionResult<T> {
  return {
    status: ExecutionStatus.FAILURE,
    successCount: 0,
    failureCount: 1,
    failures: [{ ...failure, error: ApplicationError.from(error).toJSON() }],
  }
}

export function isExecutionResult(value: unknown): value is ExecutionResult<unknown> {
  if (value === null || typeof value !== 'object') {
    return false
  }
  const result = value as Partial<ExecutionResult<unknown>>
  return (
    Object.values(ExecutionStatus).includes(result.status as ExecutionStatusValue) &&
    Number.isInteger(result.successCount) &&
    Number(result.successCount) >= 0 &&
    Number.isInteger(result.failureCount) &&
    Number(result.failureCount) >= 0 &&
    Array.isArray(result.failures) &&
    result.failureCount === result.failures.length
  )
}

export function mergeExecutionResults(resultList: ExecutionResult[]): ExecutionResult {
  const failures = resultList.flatMap((result) => result.failures)
  const successCount = resultList.reduce((total, result) => total + result.successCount, 0)
  if (resultList.some((result) => result.status === ExecutionStatus.FAILURE)) {
    return {
      status: ExecutionStatus.FAILURE,
      successCount,
      failureCount: failures.length,
      failures,
    }
  }
  if (failures.length > 0) {
    return {
      status: ExecutionStatus.PARTIAL_SUCCESS,
      successCount,
      failureCount: failures.length,
      failures,
    }
  }
  return createExecutionSuccess(undefined, successCount)
}
