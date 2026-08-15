import { describe, expect, it } from 'vitest'
import { AppErrorCode, ApplicationError, ServiceLevel } from '../../src/shared/error/application_error.js'
import {
  createExecutionFailure,
  createExecutionPartial,
  createExecutionSuccess,
  ExecutionStatus,
  isExecutionResult,
  mergeExecutionResults,
} from '../../src/shared/runtime/execution_result.js'

function failure(message: string) {
  return createExecutionFailure(new ApplicationError({
    code: AppErrorCode.FETCH_FAILED,
    message,
    serviceLevel: ServiceLevel.S2,
    stage: 'fetch',
    retryable: true,
  }), { entityType: 'page' })
}

describe('工作流执行结果契约', () => {
  it('聚合成功与局部失败并保留计数', () => {
    const failedItem = failure('第 2 页失败').failures[0]
    const result = mergeExecutionResults([
      createExecutionSuccess(undefined, 2),
      createExecutionPartial(undefined, 1, [failedItem]),
    ])
    expect(result).toMatchObject({
      status: ExecutionStatus.PARTIAL_SUCCESS,
      successCount: 3,
      failureCount: 1,
    })
    expect(isExecutionResult(result)).toBe(true)
  })

  it('任一不可恢复阶段失败使整体失败', () => {
    expect(mergeExecutionResults([createExecutionSuccess(undefined, 1), failure('失败')]).status)
      .toBe(ExecutionStatus.FAILURE)
  })

  it('拒绝没有失败摘要的局部成功状态', () => {
    expect(() => createExecutionPartial(undefined, 1, [])).toThrow('至少一个失败项')
  })
})
