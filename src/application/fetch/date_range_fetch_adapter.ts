import fs from 'node:fs'
import json5 from 'json5'
import WeiboApiClient, {
  resolveWeiboLoginUid,
  WeiboApiClientOptions,
} from '~/src/api/weibo_api_client.js'
import { createFetchBatch } from '~/src/application/fetch/fetch_batch_factory.js'
import {
  createFetchDatabaseClient,
  ensureFetchDatabaseSchema,
} from '~/src/application/fetch/fetch_database_schema.js'
import DateRangeFetchService from '~/src/application/fetch/date_range_fetch_service.js'
import {
  OFFLINE_WEIBO_LOGIN_UID,
  requiresWeiboFetchSession,
} from '~/src/application/fetch/fetch_session_policy.js'
import { globalWeiboRequestLimiter } from '~/src/application/fetch/weibo_request_limiter.js'
import { WeiboResponseCache } from '~/src/application/fetch/weibo_response_cache.js'
import { LegacyGenerateAdapter } from '~/src/application/legacy/legacy_workflow_adapters.js'
import type {
  WorkflowStageAdapter,
  WorkflowStageInput,
} from '~/src/application/workflow/run_task/contracts.js'
import FetchTaskRepository from '~/src/model/fetch_task_repository.js'
import {
  AppErrorCode,
  ApplicationError,
  ServiceLevel,
} from '~/src/shared/error/application_error.js'
import {
  assertRunnableCustomerTaskConfig,
  parseCustomerTaskConfig,
} from '~/src/shared/config/task_config.js'
import {
  createExecutionPartial,
  createExecutionSuccess,
  ExecutionResult,
  ExecutionStatus,
} from '~/src/shared/runtime/execution_result.js'

type DateRangeFetchAdapterDependencies = {
  resolveLoginUid: typeof resolveWeiboLoginUid
  createApiClient(options: WeiboApiClientOptions): WeiboApiClient
}

const defaultDependencies: DateRangeFetchAdapterDependencies = {
  resolveLoginUid: resolveWeiboLoginUid,
  createApiClient: (options) => new WeiboApiClient(options),
}

export class DateRangeFetchAdapter implements WorkflowStageAdapter {
  private readonly dependencies: DateRangeFetchAdapterDependencies

  constructor(dependencies: Partial<DateRangeFetchAdapterDependencies> = {}) {
    this.dependencies = { ...defaultDependencies, ...dependencies }
  }

  async execute(input: WorkflowStageInput): Promise<ExecutionResult> {
    if (input.config === undefined) {
      throw new ApplicationError({
        code: AppErrorCode.CONFIG_SCHEMA_INVALID,
        message: '抓取阶段缺少任务配置',
        serviceLevel: ServiceLevel.S0,
        stage: 'fetch',
        retryable: false,
      })
    }

    const database = createFetchDatabaseClient(input.context.databasePath)
    try {
      await ensureFetchDatabaseSchema(database)
      const repository = new FetchTaskRepository(database)
      let batch = input.runtimeState.batchId === undefined
        ? undefined
        : await repository.getBatch(input.runtimeState.batchId)
      const config = batch === undefined
        ? assertRunnableCustomerTaskConfig(input.config)
        : assertRunnableCustomerTaskConfig(parseCustomerTaskConfig(batch.config))
      globalWeiboRequestLimiter.setRequestIntervalMs(config.requestIntervalSeconds * 1000)

      const taskCounts = batch === undefined
        ? undefined
        : (await repository.getDashboard(batch.id)).taskCounts
      const needsWeiboSession = requiresWeiboFetchSession({
        isSkipFetch: config.isSkipFetch,
        taskCounts,
      })
      let cookie = ''
      let loginUid = batch?.loginUid ?? OFFLINE_WEIBO_LOGIN_UID
      let apiClient: WeiboApiClient | undefined

      if (needsWeiboSession) {
        cookie = input.fetchSession?.cookie ?? readRequestCookie(input.context.configPath)
        if (cookie.trim() === '') {
          throw new ApplicationError({
            code: AppErrorCode.FETCH_FAILED,
            message: '微博登录会话为空，请先在登录页完成登录',
            serviceLevel: ServiceLevel.S0,
            stage: 'fetch',
            retryable: false,
          })
        }
        loginUid = input.fetchSession?.loginUid ?? await this.dependencies.resolveLoginUid({ cookie })
        if (batch !== undefined && batch.loginUid !== loginUid) {
          throw new ApplicationError({
            code: AppErrorCode.FETCH_FAILED,
            message: '当前微博登录身份与批次创建身份不一致，不能继续该批次',
            serviceLevel: ServiceLevel.S0,
            stage: 'fetch',
            retryable: false,
          })
        }
        apiClient = this.dependencies.createApiClient({
          cookie,
          loginUid,
          limiter: globalWeiboRequestLimiter,
          cache: new WeiboResponseCache(input.context.cachePath),
        })
      }

      if (batch === undefined) {
        batch = (await createFetchBatch({
          repository,
          config,
          loginUid,
          runId: input.context.runId,
        })).batch
        input.runtimeState.batchId = batch.id
      }

      let summary
      try {
        summary = await new DateRangeFetchService({
          database,
          repository,
          apiClient,
          batch,
          config,
          runId: input.context.runId,
        }).execute()
      } catch (error) {
        // A fatal fetch error (for example, an unavailable target profile)
        // must also close batches invoked outside the GUI run manager. Recover
        // any task left running by the failing boundary first, otherwise CLI
        // callers could only repair the batch by restarting the application.
        await repository.recoverRunningTasks({ batchId: batch.id }).catch(() => undefined)
        await repository.finishBatch({ batchId: batch.id, status: 'failed' }).catch(() => undefined)
        throw error
      }

      if (input.willGenerate === false) {
        await repository.finishBatch({ batchId: batch.id })
      }
      return summary.failures.length === 0
        ? createExecutionSuccess(summary, summary.savedMblogCount)
        : createExecutionPartial(summary, summary.savedMblogCount, summary.failures)
    } finally {
      await database.destroy()
    }
  }
}

/** Adds persistent batch phase/final-state handling around the existing generator. */
export class DateRangeGenerateAdapter implements WorkflowStageAdapter {
  constructor(private readonly delegate: WorkflowStageAdapter = new LegacyGenerateAdapter()) {}

  async execute(input: WorkflowStageInput): Promise<ExecutionResult> {
    const batchId = input.runtimeState.batchId
    if (batchId === undefined) {
      return this.delegate.execute(input)
    }

    const database = createFetchDatabaseClient(input.context.databasePath)
    const repository = new FetchTaskRepository(database)
    try {
      await ensureFetchDatabaseSchema(database)
      await repository.setBatchPhase({
        batchId,
        phase: 'generating',
        runId: input.context.runId,
      })
      const result = await this.delegate.execute(input)
      const dashboard = await repository.getDashboard(batchId)
      const status = result.status === ExecutionStatus.FAILURE
        ? 'failed'
        : result.status === ExecutionStatus.PARTIAL_SUCCESS || dashboard.taskCounts.failed > 0
          ? 'partial_success'
          : 'succeeded'
      await repository.finishBatch({ batchId, status })
      return result
    } catch (error) {
      await repository.finishBatch({ batchId, status: 'failed' }).catch(() => undefined)
      throw error
    } finally {
      await database.destroy()
    }
  }
}

function readRequestCookie(configPath: string): string {
  let input: unknown
  try {
    input = json5.parse(fs.readFileSync(configPath, 'utf8'))
  } catch (error) {
    throw new ApplicationError({
      code: AppErrorCode.CONFIG_SCHEMA_INVALID,
      message: `无法读取本地微博会话配置：${configPath}`,
      serviceLevel: ServiceLevel.S0,
      stage: 'config',
      retryable: false,
      cause: error,
    })
  }
  const request = input !== null && typeof input === 'object' && !Array.isArray(input)
    ? (input as Record<string, unknown>).request
    : undefined
  const cookie = request !== null && typeof request === 'object' && !Array.isArray(request)
    ? (request as Record<string, unknown>).cookie
    : undefined
  return typeof cookie === 'string' ? cookie : ''
}
