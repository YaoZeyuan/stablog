import { describe, expect, it } from 'vitest'
import path from 'node:path'
import { AppErrorCode, ApplicationError, ServiceLevel } from '../../src/shared/error/application_error.js'
import {
  assertAllowedIpcPath,
  parseDataTransferExportRequest,
  parseDataTransferImportRequest,
  parseFileReadRequest,
  parseFileWriteRequest,
  parseIpcTraceMetadata,
  parseContinueCustomerTaskRequest,
  parseRetryCustomerTaskItemsRequest,
  parseCustomerTaskDashboardRequest,
  parseCustomerTaskFailuresRequest,
  parseClearWeiboRequestCacheRequest,
  parseResolveWeiboUidRequest,
  parseStartCustomerTaskRequest,
  parseWeiboUserInfoRequest,
} from '../../src/shared/ipc/contract.js'
import { createIpcFailure, createIpcSuccess, unwrapIpcResult } from '../../src/shared/ipc/result.js'

function validTaskConfig(): Record<string, unknown> {
  return {
    configList: [{ uid: '10001', rawInputText: '', comment: '' }],
    imageQuilty: 'none',
    bookTitle: '',
    comment: '',
    postAtOrderBy: 'desc',
    fetchStartDate: '2020-01-01',
    fetchEndDate: '2020-01-02',
    requestIntervalSeconds: 10,
    cacheReadMode: 'prefer-cache',
    outputStartAtMs: 0,
    outputEndAtMs: 1,
    isSkipFetch: false,
    isSkipGeneratePdf: false,
    isRegenerateHtml2PdfImage: false,
    isOnlyArticle: false,
    isOnlyOriginal: false,
    volumeSplitBy: 'single',
    volumeSplitCount: 1,
  }
}

describe('进程通信数据结构与结果封包', () => {
  it('校验链路标识、任务与文件请求', () => {
    expect(parseIpcTraceMetadata({ traceId: 'trace-1' })).toEqual({ traceId: 'trace-1' })
    expect(parseStartCustomerTaskRequest({ config: validTaskConfig() }).config.configList[0].uid).toBe('10001')
    expect(parseFileReadRequest({ uri: 'config.json' })).toEqual({ uri: 'config.json' })
    expect(parseFileWriteRequest({ uri: 'config.json', content: '{}' })).toEqual({
      uri: 'config.json',
      content: '{}',
    })
  })

  it('校验可恢复任务、失败分页与缓存清理请求', () => {
    expect(parseContinueCustomerTaskRequest({ batchId: 'batch-1' })).toEqual({ batchId: 'batch-1' })
    expect(parseRetryCustomerTaskItemsRequest({
      batchId: 'batch-1',
      taskIds: ['task-1', 'task-1', 'task-2'],
    })).toEqual({ batchId: 'batch-1', taskIds: ['task-1', 'task-2'] })
    expect(parseCustomerTaskDashboardRequest({})).toEqual({})
    expect(parseCustomerTaskFailuresRequest({ batchId: 'batch-1' }))
      .toEqual({ batchId: 'batch-1', offset: 0, limit: 50 })
    expect(parseClearWeiboRequestCacheRequest({ targetUid: '10001' }))
      .toEqual({ targetUid: '10001' })
    expect(() => parseRetryCustomerTaskItemsRequest({ batchId: 'batch-1', taskIds: [] }))
      .toThrowError(ApplicationError)
    expect(() => parseCustomerTaskFailuresRequest({ batchId: 'batch-1', limit: 101 }))
      .toThrowError(ApplicationError)
    expect(() => parseClearWeiboRequestCacheRequest({ targetUid: '../10001' }))
      .toThrowError(ApplicationError)
  })

  it('拒绝不完整请求并标记进程通信错误码', () => {
    try {
      parseFileWriteRequest({ uri: 'config.json' })
      throw new Error('预期请求校验失败')
    } catch (error) {
      expect(error).toMatchObject({ code: AppErrorCode.IPC_PAYLOAD_INVALID, stage: 'ipc' })
    }
  })

  it('只接受固定微博主页与数字用户编号', () => {
    expect(parseResolveWeiboUidRequest({ rawInputUrl: 'https://weibo.com/u/12345' }))
      .toEqual({ rawInputUrl: 'https://weibo.com/u/12345' })
    expect(parseWeiboUserInfoRequest({ uid: '12345' })).toEqual({ uid: '12345' })
    expect(() => parseResolveWeiboUidRequest({ rawInputUrl: 'https://example.com/u/12345' }))
      .toThrowError(ApplicationError)
    expect(() => parseResolveWeiboUidRequest({ rawInputUrl: 'https://weibo.com/ajax/statuses' }))
      .toThrowError(ApplicationError)
    expect(() => parseWeiboUserInfoRequest({ uid: '../123' })).toThrowError(ApplicationError)
  })

  it('校验数据导入导出的结构化数据文件路径与范围', () => {
    expect(parseDataTransferExportRequest({
      exportUri: 'D:/backup.json',
      uid: '12345',
      exportStartAt: 1,
      exportEndAt: 2,
    })).toMatchObject({ exportUri: 'D:/backup.json', uid: '12345' })
    expect(parseDataTransferImportRequest({ importUri: 'D:/backup.json' }))
      .toEqual({ importUri: 'D:/backup.json' })
    expect(() => parseDataTransferImportRequest({ importUri: 'D:/backup.txt' }))
      .toThrowError(ApplicationError)
    expect(() => parseDataTransferExportRequest({
      exportUri: 'D:/backup.json', uid: '12345', exportStartAt: 2, exportEndAt: 1,
    })).toThrowError(ApplicationError)
  })

  it('文件策略不因父目录授权而放开应用根', () => {
    const root = process.cwd()
    const allowedConfig = `${root}/customer_task_config.json`
    const allowedLogDirectory = `${root}/log`
    expect(assertAllowedIpcPath(allowedConfig, { allowedFiles: [allowedConfig] })).toBe(path.resolve(allowedConfig))
    expect(assertAllowedIpcPath(`${allowedLogDirectory}/runtime.log`, {
      allowedDirectories: [allowedLogDirectory],
    })).toContain('runtime.log')
    expect(() => assertAllowedIpcPath(`${root}/package.json`, {
      allowedFiles: [allowedConfig],
      allowedDirectories: [allowedLogDirectory],
    })).toThrowError(ApplicationError)
  })

  it('成功值与结构化错误均可跨边界还原', () => {
    expect(unwrapIpcResult(createIpcSuccess({ accepted: true }))).toEqual({ accepted: true })
    const failure = createIpcFailure(new ApplicationError({
      code: AppErrorCode.WORKFLOW_FAILED,
      message: '执行失败',
      serviceLevel: ServiceLevel.S1,
      stage: 'workflow',
      retryable: true,
    }))
    expect(() => unwrapIpcResult(failure)).toThrowError(ApplicationError)
    expect(failure).toMatchObject({
      ok: false,
      error: { code: AppErrorCode.WORKFLOW_FAILED, retryable: true },
    })
  })
})
