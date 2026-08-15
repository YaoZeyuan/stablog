import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DateRangeFetchAdapter } from '../../src/application/fetch/date_range_fetch_adapter.js'
import { createFetchBatch } from '../../src/application/fetch/fetch_batch_factory.js'
import {
  createFetchDatabaseClient,
  ensureFetchDatabaseSchema,
} from '../../src/application/fetch/fetch_database_schema.js'
import { OFFLINE_WEIBO_LOGIN_UID } from '../../src/application/fetch/fetch_session_policy.js'
import CustomerTaskRunManager from '../../src/application/fetch/customer_task_run_manager.js'
import type RunTaskWorkflow from '../../src/application/workflow/run_task/run_task_workflow.js'
import type { RunTaskWorkflowOptions } from '../../src/application/workflow/run_task/run_task_workflow.js'
import type { WorkflowStageInput } from '../../src/application/workflow/run_task/contracts.js'
import FetchTaskRepository from '../../src/model/fetch_task_repository.js'
import {
  CacheReadMode,
  ImageQuality,
  PostOrder,
  type CustomerTaskConfig,
  VolumeSplit,
} from '../../src/shared/config/task_config.js'
import { createExecutionSuccess } from '../../src/shared/runtime/execution_result.js'
import { createTestSandbox, type TestSandbox } from '../helpers/sandbox.js'

describe('offline skip-fetch and generate-only execution', () => {
  let sandbox: TestSandbox

  beforeEach(() => {
    sandbox = createTestSandbox('skip-fetch-offline')
  })

  afterEach(() => {
    sandbox.cleanup()
  })

  it('starts a skip-fetch manager run with an empty cookie and explicit offline identity', async () => {
    const workflowCalls: RunTaskWorkflowOptions[] = []
    const manager = createManager(sandbox, recordingWorkflow(workflowCalls))
    const config = { ...createConfig(), isSkipFetch: true }

    const ack = await manager.start(config, '', undefined, 'not-a-login-uid')
    expect(ack.outcome).toBe('started')
    await waitUntil(() => manager.isActive === false)

    expect(workflowCalls).toHaveLength(1)
    expect(workflowCalls[0].fetchSession).toEqual({
      cookie: '',
      loginUid: OFFLINE_WEIBO_LOGIN_UID,
    })
    const database = createFetchDatabaseClient(sandbox.databasePath)
    try {
      expect(await new FetchTaskRepository(database).getBatch(ack.batchId)).toMatchObject({
        loginUid: OFFLINE_WEIBO_LOGIN_UID,
      })
    } finally {
      await database.destroy()
    }
  })

  it('continues a generation-only failed batch without a cookie and keeps its frozen identity', async () => {
    const batchId = await createGenerationOnlyBatch(sandbox, '9000000001')
    const workflowCalls: RunTaskWorkflowOptions[] = []
    const manager = createManager(sandbox, recordingWorkflow(workflowCalls))

    const ack = await manager.continue(batchId, '')
    expect(ack.outcome).toBe('started')
    await waitUntil(() => manager.isActive === false)

    expect(workflowCalls).toHaveLength(1)
    expect(workflowCalls[0].fetchSession).toEqual({ cookie: '', loginUid: '9000000001' })
  })

  it('still rejects an empty cookie when an existing batch has pending fetch work', async () => {
    const batchId = await createPendingBatch(sandbox)
    const manager = createManager(sandbox, recordingWorkflow([]))

    await expect(manager.continue(batchId, '')).rejects.toMatchObject({
      message: '微博登录会话为空，请先登录',
    })
  })

  it('runs a new skip-fetch adapter batch without reading login config or creating an API client', async () => {
    const calls = { resolveLogin: 0, createClient: 0 }
    const adapter = createOfflineAssertingAdapter(calls)
    const input = createStageInput(sandbox, { ...createConfig(), isSkipFetch: true })

    const result = await adapter.execute(input)

    expect(result.status).toBe('success')
    expect(calls).toEqual({ resolveLogin: 0, createClient: 0 })
    expect(input.runtimeState.batchId).toBeTypeOf('string')
    const database = createFetchDatabaseClient(sandbox.databasePath)
    try {
      const repository = new FetchTaskRepository(database)
      const batch = await repository.getBatch(input.runtimeState.batchId!)
      const dashboard = await repository.getDashboard(batch.id)
      expect(batch.loginUid).toBe(OFFLINE_WEIBO_LOGIN_UID)
      expect(dashboard.taskCounts).toMatchObject({ pending: 0, running: 0, failed: 0, succeeded: 1 })
    } finally {
      await database.destroy()
    }
  })

  it('runs the adapter offline when only generation remains', async () => {
    const batchId = await createGenerationOnlyBatch(sandbox, '9000000001')
    const calls = { resolveLogin: 0, createClient: 0 }
    const adapter = createOfflineAssertingAdapter(calls)
    const input = createStageInput(sandbox, createConfig(), batchId)

    const result = await adapter.execute(input)

    expect(result.status).toBe('success')
    expect(calls).toEqual({ resolveLogin: 0, createClient: 0 })
  })

  it('requires adapter authentication when an existing batch still has fetch work', async () => {
    const batchId = await createPendingBatch(sandbox)
    const calls = { resolveLogin: 0, createClient: 0 }
    const adapter = createOfflineAssertingAdapter(calls)
    const input = createStageInput(sandbox, createConfig(), batchId)
    input.fetchSession = { cookie: '' }

    await expect(adapter.execute(input)).rejects.toMatchObject({
      message: '微博登录会话为空，请先在登录页完成登录',
    })
    expect(calls).toEqual({ resolveLogin: 0, createClient: 0 })
  })
})

function createOfflineAssertingAdapter(calls: { resolveLogin: number; createClient: number }) {
  return new DateRangeFetchAdapter({
    async resolveLoginUid() {
      calls.resolveLogin += 1
      throw new Error('offline execution must not resolve a login identity')
    },
    createApiClient() {
      calls.createClient += 1
      throw new Error('offline execution must not create an API client')
    },
  })
}

function createManager(
  currentSandbox: TestSandbox,
  workflowFactory: () => RunTaskWorkflow,
): CustomerTaskRunManager {
  return new CustomerTaskRunManager({
    databasePath: currentSandbox.databasePath,
    localConfigPath: currentSandbox.configPath,
    customerTaskConfigPath: currentSandbox.customerTaskConfigPath,
    cachePath: currentSandbox.cachePath,
    logPath: currentSandbox.logPath,
    outputPath: currentSandbox.outputPath,
    getRenderWindow: () => null,
    workflowFactory,
  })
}

function recordingWorkflow(calls: RunTaskWorkflowOptions[]): () => RunTaskWorkflow {
  return () => ({
    async run(options: RunTaskWorkflowOptions) {
      calls.push(options)
      return createExecutionSuccess(undefined, 0)
    },
  }) as unknown as RunTaskWorkflow
}

function createStageInput(
  currentSandbox: TestSandbox,
  config: CustomerTaskConfig,
  batchId?: string,
): WorkflowStageInput {
  return {
    context: Object.freeze({
      runId: 'run-offline-adapter',
      traceId: 'trace-offline-adapter',
      trigger: 'cli' as const,
      rootPath: currentSandbox.rootPath,
      resourcePath: currentSandbox.rootPath,
      configPath: currentSandbox.configPath,
      customerTaskConfigPath: currentSandbox.customerTaskConfigPath,
      databasePath: currentSandbox.databasePath,
      cachePath: currentSandbox.cachePath,
      logPath: currentSandbox.logPath,
      outputPath: currentSandbox.outputPath,
    }),
    config,
    action: 'run',
    willGenerate: true,
    runtimeState: batchId === undefined ? {} : { batchId },
    rebase: false,
    skipUpgradeCheck: true,
  }
}

async function createGenerationOnlyBatch(
  currentSandbox: TestSandbox,
  loginUid: string,
): Promise<string> {
  const database = createFetchDatabaseClient(currentSandbox.databasePath)
  try {
    await ensureFetchDatabaseSchema(database)
    const repository = new FetchTaskRepository(database)
    const created = await createFetchBatch({
      repository,
      config: createConfig(),
      loginUid,
      runId: 'run-create-generation-only',
      batchId: 'batch-generation-only',
      startedAtMs: Date.parse('2024-01-02T00:00:00+08:00'),
    })
    const root = await repository.claimNextTask({
      batchId: created.batch.id,
      runId: 'run-create-generation-only',
    })
    await repository.markTaskSucceeded({ taskId: root!.id, totalCount: 0 })
    await repository.finishBatch({ batchId: created.batch.id, status: 'failed' })
    return created.batch.id
  } finally {
    await database.destroy()
  }
}

async function createPendingBatch(currentSandbox: TestSandbox): Promise<string> {
  const database = createFetchDatabaseClient(currentSandbox.databasePath)
  try {
    await ensureFetchDatabaseSchema(database)
    return (await createFetchBatch({
      repository: new FetchTaskRepository(database),
      config: createConfig(),
      loginUid: '9000000001',
      runId: 'run-create-pending',
      batchId: 'batch-pending',
      startedAtMs: Date.parse('2024-01-02T00:00:00+08:00'),
    })).batch.id
  } finally {
    await database.destroy()
  }
}

function createConfig(): CustomerTaskConfig {
  return {
    configList: [{ uid: '1000000001', rawInputText: '1000000001', comment: '' }],
    imageQuilty: ImageQuality.DEFAULT,
    bookTitle: 'offline integration',
    comment: '',
    postAtOrderBy: PostOrder.ASC,
    fetchStartDate: '2024-01-01',
    fetchEndDate: '2024-01-01',
    requestIntervalSeconds: 10,
    cacheReadMode: CacheReadMode.PREFER_CACHE,
    outputStartAtMs: Date.parse('2024-01-01T00:00:00+08:00'),
    outputEndAtMs: Date.parse('2024-01-01T23:59:59+08:00'),
    isSkipFetch: false,
    isSkipGeneratePdf: true,
    isRegenerateHtml2PdfImage: false,
    isOnlyArticle: false,
    isOnlyOriginal: false,
    volumeSplitBy: VolumeSplit.SINGLE,
    volumeSplitCount: 1,
  }
}

async function waitUntil(predicate: () => boolean): Promise<void> {
  const deadline = Date.now() + 2_000
  while (predicate() === false) {
    if (Date.now() >= deadline) throw new Error('timed out waiting for background workflow')
    await new Promise<void>((resolve) => setImmediate(resolve))
  }
}
