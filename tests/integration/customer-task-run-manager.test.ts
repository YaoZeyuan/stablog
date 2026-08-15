import fs from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CustomerTaskRunManager from '../../src/application/fetch/customer_task_run_manager.js'
import { createFetchBatch } from '../../src/application/fetch/fetch_batch_factory.js'
import {
  createFetchDatabaseClient,
  ensureFetchDatabaseSchema,
} from '../../src/application/fetch/fetch_database_schema.js'
import type RunTaskWorkflow from '../../src/application/workflow/run_task/run_task_workflow.js'
import type { RunTaskWorkflowOptions } from '../../src/application/workflow/run_task/run_task_workflow.js'
import {
  BackupExecutionLeaseHandle,
  BackupExecutionLeaseRepository,
  ensureBackupExecutionLeaseSchema,
  resolveBackupExecutionLeaseDatabasePath,
} from '../../src/application/workflow/backup_execution_lease.js'
import FetchTaskRepository from '../../src/model/fetch_task_repository.js'
import {
  CacheReadMode,
  ImageQuality,
  PostOrder,
  type CustomerTaskConfig,
  VolumeSplit,
} from '../../src/shared/config/task_config.js'
import {
  AppErrorCode,
  ApplicationError,
  ServiceLevel,
} from '../../src/shared/error/application_error.js'
import {
  createExecutionFailure,
  createExecutionSuccess,
} from '../../src/shared/runtime/execution_result.js'
import { createTestSandbox, type TestSandbox } from '../helpers/sandbox.js'

describe('customer task run manager recovery', () => {
  let sandbox: TestSandbox

  beforeEach(() => {
    sandbox = createTestSandbox('customer-task-run-manager')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    sandbox.cleanup()
  })

  it('recovers a task left running by a workflow failure without requiring an app restart', async () => {
    const workflow = {
      async run(options: RunTaskWorkflowOptions) {
        const database = createFetchDatabaseClient(options.databasePath!)
        try {
          await ensureFetchDatabaseSchema(database)
          const repository = new FetchTaskRepository(database)
          const claimed = await repository.claimNextTask({
            batchId: options.batchId!,
            runId: options.runId!,
          })
          expect(claimed?.status).toBe('running')
        } finally {
          await database.destroy()
        }
        return createExecutionFailure(new ApplicationError({
          code: AppErrorCode.FETCH_FAILED,
          message: 'fixture workflow failure after claim',
          serviceLevel: ServiceLevel.S1,
          stage: 'fetch',
          retryable: true,
        }))
      },
    } as unknown as RunTaskWorkflow
    const manager = createManager(sandbox, () => workflow)

    const ack = await manager.start(createConfig(), 'fixture-cookie', undefined, '9000000001')
    expect(ack.outcome).toBe('started')
    await waitUntil(() => manager.isActive === false)

    const dashboard = await manager.getDashboard(ack.batchId)
    expect(dashboard.batch).toMatchObject({
      status: 'failed',
      resumable: true,
      counts: { pending: 0, running: 0, failed: 1 },
    })
  })

  it('keeps a generate-stage failure resumable after all fetch tasks succeeded', async () => {
    const database = createFetchDatabaseClient(sandbox.databasePath)
    let batchId: string
    try {
      await ensureFetchDatabaseSchema(database)
      const repository = new FetchTaskRepository(database)
      const created = await createFetchBatch({
        repository,
        config: createConfig(),
        loginUid: '9000000001',
        runId: 'run-create',
        batchId: 'batch-generate-failure',
        startedAtMs: Date.parse('2024-01-02T00:00:00+08:00'),
      })
      batchId = created.batch.id
      const root = await repository.claimNextTask({
        batchId,
        runId: 'run-create',
      })
      expect(root).not.toBeNull()
      await repository.markTaskSucceeded({ taskId: root!.id, totalCount: 0 })
      await repository.finishBatch({ batchId, status: 'failed' })
    } finally {
      await database.destroy()
    }

    const manager = createManager(sandbox)
    const dashboard = await manager.getDashboard(batchId!)
    expect(dashboard.batch).toMatchObject({
      status: 'failed',
      resumable: true,
      counts: { pending: 0, running: 0, succeeded: 1, failed: 0 },
    })

    const resumedDatabase = createFetchDatabaseClient(sandbox.databasePath)
    try {
      const repository = new FetchTaskRepository(resumedDatabase)
      const resumed = await repository.resumeBatch({
        batchId: batchId!,
        runId: 'run-generate-resume',
      })
      expect(resumed.resetTaskIds).toEqual([])
      expect(await repository.getBatch(batchId!)).toMatchObject({ status: 'running' })
    } finally {
      await resumedDatabase.destroy()
    }
  })

  it('rolls back the whole planned batch when target or root creation fails', async () => {
    const database = createFetchDatabaseClient(sandbox.databasePath)
    try {
      await ensureFetchDatabaseSchema(database)
      let idSequence = 0
      const repository = new FetchTaskRepository(database, {
        createId(prefix) {
          idSequence += 1
          if (idSequence === 4) throw new Error('fixture planning failure')
          return `${prefix}-${idSequence}`
        },
      })
      const config = createConfig()
      config.configList.push({ uid: '1000000002', rawInputText: '1000000002', comment: '' })

      await expect(createFetchBatch({
        repository,
        config,
        loginUid: '9000000001',
        runId: 'run-planning-failure',
        batchId: 'batch-planning-failure',
        startedAtMs: Date.parse('2024-01-02T00:00:00+08:00'),
      })).rejects.toThrow('fixture planning failure')

      expect(await database('fetch_batch').count<{ count: number }>({ count: '*' }).first())
        .toMatchObject({ count: 0 })
      expect(await database('fetch_target').count<{ count: number }>({ count: '*' }).first())
        .toMatchObject({ count: 0 })
      expect(await database('fetch_task').count<{ count: number }>({ count: '*' }).first())
        .toMatchObject({ count: 0 })
    } finally {
      await database.destroy()
    }
  })

  it('rejects task creation, resume reads, and config writes while another process owns the SQLite lease', async () => {
    const initializedDatabase = createFetchDatabaseClient(sandbox.databasePath)
    await ensureFetchDatabaseSchema(initializedDatabase)
    await initializedDatabase.destroy()
    const originalConfig = '{"fixture":"unchanged"}\n'
    fs.writeFileSync(sandbox.customerTaskConfigPath, originalConfig, 'utf8')
    const externalLease = await BackupExecutionLeaseHandle.acquire(
      sandbox.databasePath,
      'run-external-cli',
      { ownerKind: 'cli-workflow' },
    )
    const manager = createManager(sandbox)
    try {
      // Lease conflict wins before cookie validation or any login API call.
      await expect(manager.start(createConfig(), ''))
        .rejects.toMatchObject({ stage: 'workflow-lease', retryable: true })

      await expect(manager.runMaintenance(async () => {
        fs.writeFileSync(sandbox.customerTaskConfigPath, '{"fixture":"saved"}\n', 'utf8')
      }, 'save config conflict')).rejects.toMatchObject({ stage: 'workflow-lease' })
      await expect(manager.runMaintenance(async () => {
        fs.writeFileSync(sandbox.customerTaskConfigPath, '{"fixture":"reset"}\n', 'utf8')
      }, 'reset config conflict')).rejects.toMatchObject({ stage: 'workflow-lease' })
      expect(fs.readFileSync(sandbox.customerTaskConfigPath, 'utf8')).toBe(originalConfig)

      const database = createFetchDatabaseClient(sandbox.databasePath)
      try {
        expect(await database('fetch_batch').count<{ count: number }>({ count: '*' }).first())
          .toMatchObject({ count: 0 })
      } finally {
        await database.destroy()
      }

      // A rebase owner can temporarily remove the business DB. Continue/retry
      // must lose on the coordination lease before schema ensure/read recreates it.
      fs.rmSync(sandbox.databasePath)
      await expect(manager.continue('batch-during-rebase', ''))
        .rejects.toMatchObject({ stage: 'workflow-lease', retryable: true })
      expect(fs.existsSync(sandbox.databasePath)).toBe(false)
    } finally {
      await externalLease.release()
    }
  })

  it('recovers a running task before continuing a batch with a new runId', async () => {
    const database = createFetchDatabaseClient(sandbox.databasePath)
    let batchId: string
    let taskId: string
    try {
      await ensureFetchDatabaseSchema(database)
      const repository = new FetchTaskRepository(database)
      const created = await createFetchBatch({
        repository,
        config: createConfig(),
        loginUid: '9000000001',
        runId: 'run-crashed',
        batchId: 'batch-crashed',
        startedAtMs: Date.parse('2024-01-02T00:00:00+08:00'),
      })
      batchId = created.batch.id
      const claimed = await repository.claimNextTask({ batchId, runId: 'run-crashed' })
      taskId = claimed!.id
    } finally {
      await database.destroy()
    }

    const workflow = {
      async run() {
        return createExecutionSuccess(undefined, 1)
      },
    } as unknown as RunTaskWorkflow
    const manager = createManager(sandbox, () => workflow)
    const ack = await manager.continue(
      batchId!,
      'fixture-cookie',
      undefined,
      '9000000001',
    )
    expect(ack.outcome).toBe('started')
    await waitUntil(() => manager.isActive === false)

    const resumedDatabase = createFetchDatabaseClient(sandbox.databasePath)
    try {
      const recovered = await new FetchTaskRepository(resumedDatabase).getTask(taskId!)
      expect(recovered).toMatchObject({ status: 'pending', attemptCount: 1 })
    } finally {
      await resumedDatabase.destroy()
    }
  })

  it('recovers an external running batch during dashboard polling after its owner dies', async () => {
    let now = Date.now()
    const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => now)
    const database = createFetchDatabaseClient(sandbox.databasePath)
    let batchId: string
    try {
      await ensureFetchDatabaseSchema(database)
      const repository = new FetchTaskRepository(database)
      const created = await createFetchBatch({
        repository,
        config: createConfig(),
        loginUid: '9000000001',
        runId: 'run-external-crashed',
        batchId: 'batch-external-crashed',
        startedAtMs: Date.parse('2024-01-02T00:00:00+08:00'),
      })
      batchId = created.batch.id
      expect(await repository.claimNextTask({
        batchId,
        runId: 'run-external-crashed',
      })).toMatchObject({ status: 'running' })
    } finally {
      await database.destroy()
    }

    const leaseDatabase = createFetchDatabaseClient(
      resolveBackupExecutionLeaseDatabasePath(sandbox.databasePath),
    )
    try {
      await ensureBackupExecutionLeaseSchema(leaseDatabase)
      await new BackupExecutionLeaseRepository(leaseDatabase).acquire({
        runId: 'run-external-crashed',
        ownerKind: 'cli-workflow',
        ownerPid: process.pid,
      })
    } finally {
      await leaseDatabase.destroy()
    }

    const manager = createManager(sandbox)
    expect(await manager.getDashboard(batchId!)).toMatchObject({
      activeRun: null,
      batch: { status: 'running', resumable: false },
    })
    // The first probe observes the still-live CLI owner and leaves its task alone.
    await expect(manager.runMaintenance(async () => undefined, 'fixture maintenance conflict'))
      .rejects.toMatchObject({ stage: 'workflow-lease' })

    const crashedLeaseDatabase = createFetchDatabaseClient(
      resolveBackupExecutionLeaseDatabasePath(sandbox.databasePath),
    )
    try {
      await crashedLeaseDatabase('workflow_execution_lease')
        .where({ run_id: 'run-external-crashed' })
        .update({ owner_pid: 999_999_999 })
    } finally {
      await crashedLeaseDatabase.destroy()
    }
    now += 5_001
    expect(await manager.getDashboard(batchId!)).toMatchObject({
      activeRun: null,
      batch: { status: 'running', resumable: false },
    })

    await waitUntilAsync(async () => {
      const probeDatabase = createFetchDatabaseClient(sandbox.databasePath)
      try {
        return (await new FetchTaskRepository(probeDatabase).getBatch(batchId!)).status === 'failed'
      } finally {
        await probeDatabase.destroy()
      }
    })
    // This also waits for the background probe's lease release before sandbox cleanup.
    await manager.runMaintenance(async () => undefined, 'fixture maintenance conflict')
    expect(await manager.getDashboard(batchId!)).toMatchObject({
      activeRun: null,
      batch: {
        status: 'failed',
        resumable: true,
        counts: { pending: 0, running: 0, failed: 1 },
      },
    })
    nowSpy.mockRestore()
  })
})

function createManager(
  sandbox: TestSandbox,
  workflowFactory?: () => RunTaskWorkflow,
): CustomerTaskRunManager {
  return new CustomerTaskRunManager({
    databasePath: sandbox.databasePath,
    localConfigPath: sandbox.configPath,
    customerTaskConfigPath: sandbox.customerTaskConfigPath,
    cachePath: sandbox.cachePath,
    logPath: sandbox.logPath,
    outputPath: sandbox.outputPath,
    getRenderWindow: () => null,
    workflowFactory,
  })
}

function createConfig(): CustomerTaskConfig {
  return {
    configList: [{ uid: '1000000001', rawInputText: '1000000001', comment: '' }],
    imageQuilty: ImageQuality.DEFAULT,
    bookTitle: 'manager integration',
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

async function waitUntilAsync(predicate: () => Promise<boolean>): Promise<void> {
  const deadline = Date.now() + 2_000
  while (await predicate() === false) {
    if (Date.now() >= deadline) throw new Error('timed out waiting for dashboard recovery')
    await new Promise<void>((resolve) => setImmediate(resolve))
  }
}
