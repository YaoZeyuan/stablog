import fs from 'node:fs'
import path from 'node:path'
import createKnex, { type Knex } from 'knex'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import FetchTaskRepository, {
  FetchTaskRepositoryError,
  type CreateFetchTaskInput,
  type FetchTaskFailure,
} from '../../src/model/fetch_task_repository.js'
import { createTestSandbox, type TestSandbox } from '../helpers/sandbox.js'

const initSqlPath = path.resolve(process.cwd(), 'src/command/init.sql')

describe('可恢复抓取任务仓储', () => {
  let sandbox: TestSandbox
  let database: Knex
  let repository: FetchTaskRepository
  let clock = 1_000
  let idSequence = 0

  beforeEach(async () => {
    sandbox = createTestSandbox('fetch-task-repository')
    database = createDatabase(sandbox.databasePath)
    await initializeSchema(database)
    repository = createRepository(database)
  })

  afterEach(async () => {
    await database.destroy()
    sandbox.cleanup()
  })

  function createRepository(client: Knex): FetchTaskRepository {
    return new FetchTaskRepository(client, {
      now: () => ++clock,
      createId: (prefix) => `${prefix}-${++idSequence}`,
    })
  }

  async function createBatch(batchId = 'batch-1', runId = 'run-1') {
    return repository.createBatch({
      id: batchId,
      runId,
      config: { fetchStartDate: '2024-01-01', fetchEndDate: '2024-01-31' },
      loginUid: '90001',
      cacheReadMode: 'prefer_cache',
      requestIntervalSeconds: 10,
      fetchStartAt: 1_704_038_400,
      fetchEndAt: 1_706_716_799,
    })
  }

  async function createTarget(batchId = 'batch-1', targetId = 'target-1', targetUid = '10001') {
    return repository.createTarget({ id: targetId, batchId, targetUid, sequence: 0 })
  }

  function task(input: Partial<CreateFetchTaskInput> = {}): CreateFetchTaskInput {
    return {
      id: input.id,
      batchId: input.batchId ?? 'batch-1',
      targetId: input.targetId ?? 'target-1',
      parentTaskId: input.parentTaskId,
      taskType: input.taskType ?? 'page',
      rangeStartAt: input.rangeStartAt ?? 1_704_038_400,
      rangeEndAt: input.rangeEndAt ?? 1_704_643_199,
      pageNo: input.pageNo ?? 1,
      sequence: input.sequence ?? 0,
    }
  }

  it('增量初始化三张表，并以独立 batch id 保存批次快照和稳定任务 id', async () => {
    await database('total_mblog').insert({
      id: 'existing-mblog',
      author_uid: '10001',
      is_retweet: 0,
      is_article: 0,
      post_publish_at: 1,
      raw_json: '{}',
    })
    await initializeSchema(database)
    const tableRows = (await database('sqlite_master')
      .select('name')
      .where('type', 'table')
      .whereIn('name', ['fetch_batch', 'fetch_target', 'fetch_task'])
      .orderBy('name')) as Array<{ name: string }>
    expect(tableRows.map(({ name }) => name)).toEqual(['fetch_batch', 'fetch_target', 'fetch_task'])
    expect(await database('total_mblog').where('id', 'existing-mblog').first()).toBeDefined()

    const batch = await createBatch()
    const target = await createTarget()
    const [created] = await repository.createTasks([task({ id: 'page-stable' })])
    const [sameLogicalTask] = await repository.createTasks([task({ id: 'ignored-new-id' })])
    const sameTarget = await repository.createTarget({
      id: 'ignored-target-id',
      batchId: batch.id,
      targetUid: target.targetUid,
    })

    expect(batch).toMatchObject({
      id: 'batch-1',
      createdRunId: 'run-1',
      activeRunId: 'run-1',
      phase: 'planning',
      status: 'pending',
      config: { fetchStartDate: '2024-01-01', fetchEndDate: '2024-01-31' },
      loginUid: '90001',
      cacheReadMode: 'prefer_cache',
      requestIntervalSeconds: 10,
    })
    expect(batch.id).not.toBe(batch.createdRunId)
    expect(sameTarget.id).toBe(target.id)
    expect(created.id).toBe('page-stable')
    expect(sameLogicalTask.id).toBe('page-stable')

    const dashboard = await repository.getDashboard(batch.id)
    expect(dashboard).toMatchObject({
      targetCount: 1,
      taskCounts: { total: 1, pending: 1, completed: 0 },
      completedRatio: 0,
    })
    expect(path.dirname(sandbox.databasePath)).toContain(sandbox.rootPath)
  })

  it('只 claim 父任务已成功的任务，并以单条条件更新避免重复领取', async () => {
    await createBatch()
    await createTarget()
    const [yearProbe] = await repository.createTasks([
      task({
        id: 'year-probe',
        taskType: 'year_probe',
        pageNo: 0,
        rangeEndAt: 1_735_574_399,
      }),
    ])
    await repository.createTasks([
      task({ id: 'page-1', parentTaskId: yearProbe.id, pageNo: 1, sequence: 1 }),
      task({ id: 'page-2', parentTaskId: yearProbe.id, pageNo: 2, sequence: 2 }),
    ])

    const firstClaims = await Promise.all([
      repository.claimNextTask({ batchId: 'batch-1', runId: 'run-1' }),
      repository.claimNextTask({ batchId: 'batch-1', runId: 'run-1' }),
    ])
    expect(firstClaims.filter(Boolean).map((item) => item?.id)).toEqual(['year-probe'])
    expect(firstClaims.find((item) => item !== null)).toMatchObject({
      attemptCount: 1,
      claimedByRunId: 'run-1',
      status: 'running',
    })

    await repository.markTaskSucceeded({ taskId: yearProbe.id, totalCount: 51 })
    const pageClaims = await Promise.all([
      repository.claimNextTask({ batchId: 'batch-1', runId: 'run-1', taskTypes: ['page'] }),
      repository.claimNextTask({ batchId: 'batch-1', runId: 'run-1', taskTypes: ['page'] }),
    ])
    expect(new Set(pageClaims.map((item) => item?.id))).toEqual(new Set(['page-1', 'page-2']))
  })

  it('原子提交 probe 子任务与父任务，并在最终更新失败时回滚全部子任务', async () => {
    await createBatch()
    await createTarget()
    await repository.createTasks([task({
      id: 'year-probe-atomic',
      taskType: 'year_probe',
      pageNo: 0,
      rangeStartAt: 1_704_038_400,
      rangeEndAt: 1_735_574_399,
    })])
    expect(await repository.claimNextTask({ batchId: 'batch-1', runId: 'run-1' }))
      .toMatchObject({ id: 'year-probe-atomic', status: 'running' })
    const desiredChildren = [
      task({
        id: undefined,
        parentTaskId: 'year-probe-atomic',
        taskType: 'month_probe',
        pageNo: 0,
        rangeStartAt: 1_704_038_400,
        rangeEndAt: 1_706_716_799,
        sequence: 1,
      }),
      task({
        id: undefined,
        parentTaskId: 'year-probe-atomic',
        taskType: 'month_probe',
        pageNo: 0,
        rangeStartAt: 1_706_716_800,
        rangeEndAt: 1_709_222_399,
        sequence: 2,
      }),
    ]

    await database.raw(`CREATE TRIGGER fixture_fail_probe_completion
      BEFORE UPDATE OF status ON fetch_task
      WHEN OLD.id = 'year-probe-atomic' AND NEW.status = 'succeeded'
      BEGIN
        SELECT RAISE(ABORT, 'fixture parent completion failure');
      END`)
    try {
      await expect(repository.completeProbeTask({
        taskId: 'year-probe-atomic',
        totalCount: 2,
        cacheHits: 1,
        childTasks: desiredChildren,
      })).rejects.toThrow('fixture parent completion failure')
    } finally {
      await database.raw('DROP TRIGGER fixture_fail_probe_completion')
    }
    expect(await repository.getTask('year-probe-atomic')).toMatchObject({
      status: 'running',
      totalCount: null,
      cacheHits: 0,
    })
    expect(await database('fetch_task').where('parent_task_id', 'year-probe-atomic')).toEqual([])

    // Simulate the exact half-commit left by older builds. A never-started child
    // is replaced by the current plan inside the same completion transaction.
    await repository.createTasks([task({
      id: 'legacy-pristine-child',
      parentTaskId: 'year-probe-atomic',
      taskType: 'month_probe',
      pageNo: 0,
      rangeStartAt: 1_709_222_400,
      rangeEndAt: 1_711_900_799,
      sequence: 3,
    })])
    const completed = await repository.completeProbeTask({
      taskId: 'year-probe-atomic',
      totalCount: 2,
      cacheHits: 1,
      childTasks: desiredChildren,
    })
    expect(completed.task).toMatchObject({ status: 'succeeded', totalCount: 2, cacheHits: 1 })
    expect(completed.childTasks).toHaveLength(2)
    expect(await database('fetch_task').where('id', 'legacy-pristine-child').first()).toBeUndefined()
    expect(await database('fetch_task').where('parent_task_id', 'year-probe-atomic').count({ count: '*' }).first())
      .toMatchObject({ count: 2 })
  })

  it('拒绝清理已开始的 probe 后代并保留其有效进度', async () => {
    await createBatch()
    await createTarget()
    await repository.createTasks([task({
      id: 'year-probe-protected',
      taskType: 'year_probe',
      pageNo: 0,
      rangeStartAt: 1_704_038_400,
      rangeEndAt: 1_735_574_399,
    })])
    await repository.claimNextTask({ batchId: 'batch-1', runId: 'run-1' })
    await repository.createTasks([task({
      id: 'started-descendant',
      parentTaskId: 'year-probe-protected',
      taskType: 'month_probe',
      pageNo: 0,
      rangeStartAt: 1_704_038_400,
      rangeEndAt: 1_706_716_799,
    })])
    await database('fetch_task').where('id', 'started-descendant').update({
      status: 'succeeded',
      attempt_count: 1,
      total_count: 0,
      started_at: 2_000,
      finished_at: 2_001,
    })

    await expect(repository.completeProbeTask({
      taskId: 'year-probe-protected',
      totalCount: 0,
      childTasks: [],
    })).rejects.toThrow('拒绝覆盖有效任务进度')
    expect(await repository.getTask('year-probe-protected')).toMatchObject({ status: 'running' })
    expect(await repository.getTask('started-descendant')).toMatchObject({
      status: 'succeeded',
      attemptCount: 1,
    })
  })

  it('严格执行状态转换，并聚合 partial_success dashboard 与全部失败任务', async () => {
    await createBatch()
    await createTarget()
    await repository.createTasks([
      task({ id: 'page-ok', pageNo: 1 }),
      task({ id: 'page-failed', pageNo: 2 }),
      task({
        id: 'month-failed',
        taskType: 'month_probe',
        pageNo: 0,
        rangeStartAt: 1_706_716_800,
        rangeEndAt: 1_709_222_399,
        sequence: 3,
      }),
    ])

    await expect(repository.markTaskSucceeded({ taskId: 'page-ok' })).rejects.toBeInstanceOf(FetchTaskRepositoryError)
    const ok = await repository.claimNextTask({ batchId: 'batch-1', runId: 'run-1' })
    expect(ok?.id).toBe('page-ok')
    await expect(
      repository.markTaskSucceeded({ taskId: 'page-ok', totalCount: 1, cacheHits: -1 }),
    ).rejects.toBeInstanceOf(FetchTaskRepositoryError)
    await repository.markTaskSucceeded({ taskId: 'page-ok', totalCount: 1, cacheHits: 3 })

    const failure: FetchTaskFailure = {
      code: 'WEIBO_RESPONSE_INVALID',
      message: '接口响应校验失败',
      retryable: true,
      details: { field: 'data.total' },
    }
    const failedPage = await repository.claimNextTask({ batchId: 'batch-1', runId: 'run-1' })
    expect(failedPage?.id).toBe('page-failed')
    await repository.markTaskFailed({ taskId: 'page-failed', error: failure })
    const failedProbe = await repository.claimNextTask({ batchId: 'batch-1', runId: 'run-1' })
    expect(failedProbe?.id).toBe('month-failed')
    await repository.markTaskFailed({ taskId: 'month-failed', error: failure })

    const dashboard = await repository.getDashboard('batch-1')
    expect(dashboard.batch.status).toBe('partial_success')
    expect(dashboard.taskCounts).toMatchObject({
      total: 3,
      succeeded: 1,
      failed: 2,
      completed: 3,
      cacheHits: 3,
    })
    expect(dashboard.completedRatio).toBe(1)
    const targetFinishedAt = dashboard.targets[0].target.finishedAt

    const failedTasks = await repository.listFailedTasks('batch-1', { limit: 1 })
    expect(failedTasks).toMatchObject({ total: 2, limit: 1, offset: 0 })
    expect(failedTasks.items[0].task.lastError).toEqual(failure)
    const failedPages = await repository.listFailedPages('batch-1')
    expect(failedPages.total).toBe(1)
    expect(failedPages.items[0]).toMatchObject({
      targetUid: '10001',
      task: { id: 'page-failed', taskType: 'page' },
    })

    await repository.setBatchPhase({ batchId: 'batch-1', phase: 'generating' })
    const finished = await repository.finishBatch({ batchId: 'batch-1' })
    expect(finished).toMatchObject({ phase: 'done', status: 'partial_success' })
    expect(finished.finishedAt).not.toBeNull()
    expect((await repository.getDashboard('batch-1')).targets[0].target.finishedAt).toBe(targetFinishedAt)
  })

  it('重启后将 running 恢复为 failed，继续批次时换用新 runId 且保留尝试次数', async () => {
    await createBatch()
    await createTarget()
    await repository.createTasks([task({ id: 'recoverable-page' })])
    await repository.setBatchPhase({ batchId: 'batch-1', phase: 'fetching' })
    await repository.claimNextTask({ batchId: 'batch-1', runId: 'run-1' })

    const recovery = await repository.recoverRunningTasks({ batchId: 'batch-1' })
    expect(recovery.recoveredTaskIds).toEqual(['recoverable-page'])
    expect(await repository.getTask('recoverable-page')).toMatchObject({
      status: 'failed',
      attemptCount: 1,
      lastError: { code: 'FETCH_TASK_INTERRUPTED', retryable: true },
    })

    await database.destroy()
    database = createDatabase(sandbox.databasePath)
    await initializeSchema(database)
    repository = createRepository(database)

    const persisted = await repository.getDashboard('batch-1')
    expect(persisted.taskCounts.failed).toBe(1)
    expect(persisted.batch.createdRunId).toBe('run-1')

    const resumed = await repository.resumeBatch({ batchId: 'batch-1', runId: 'run-2' })
    expect(resumed.resetTaskIds).toEqual(['recoverable-page'])
    expect(await repository.getBatch('batch-1')).toMatchObject({
      createdRunId: 'run-1',
      activeRunId: 'run-2',
      status: 'pending',
    })
    const claimed = await repository.claimNextTask({ batchId: 'batch-1', runId: 'run-2' })
    expect(claimed).toMatchObject({
      id: 'recoverable-page',
      attemptCount: 2,
      claimedByRunId: 'run-2',
    })
    await repository.markTaskSucceeded({ taskId: 'recoverable-page', totalCount: 1 })
    await repository.setBatchPhase({ batchId: 'batch-1', phase: 'generating', runId: 'run-2' })
    expect(await repository.finishBatch({ batchId: 'batch-1' })).toMatchObject({
      phase: 'done',
      status: 'succeeded',
    })
  })

  it('拒绝用旧状态快照重新打开已由其他进程完成的成功批次', async () => {
    await createBatch()
    await createTarget()
    await repository.createTasks([task({ id: 'completed-before-stale-resume' })])
    const claimed = await repository.claimNextTask({ batchId: 'batch-1', runId: 'run-1' })
    await repository.markTaskSucceeded({ taskId: claimed!.id, totalCount: 0 })
    await repository.finishBatch({ batchId: 'batch-1', status: 'failed' })

    // Process A observed this failed snapshot before process B finished it.
    expect(await repository.getBatch('batch-1')).toMatchObject({ status: 'failed' })
    await repository.finishBatch({ batchId: 'batch-1', status: 'succeeded' })

    await expect(repository.resumeBatch({ batchId: 'batch-1', runId: 'run-stale-resume' }))
      .rejects.toThrow('成功批次 batch-1 不能继续或重试')
    expect(await repository.getBatch('batch-1')).toMatchObject({
      status: 'succeeded',
      activeRunId: 'run-1',
    })
  })

  it('拒绝重试被标记为成功批次中的异常失败任务', async () => {
    await createBatch()
    await createTarget()
    await repository.createTasks([task({ id: 'failed-in-succeeded-batch' })])
    const claimed = await repository.claimNextTask({ batchId: 'batch-1', runId: 'run-1' })
    await repository.markTaskFailed({
      taskId: claimed!.id,
      error: { code: 'FIXTURE_FAILURE', message: 'fixture failure', retryable: true },
    })
    await database('fetch_batch').where('id', 'batch-1').update({ status: 'succeeded' })

    await expect(repository.retryTaskIds({
      batchId: 'batch-1',
      taskIds: ['failed-in-succeeded-batch'],
      runId: 'run-stale-retry',
    })).rejects.toThrow('成功批次 batch-1 不能继续或重试')
    expect(await repository.getTask('failed-in-succeeded-batch')).toMatchObject({ status: 'failed' })
  })

  it('按 task ids 只重试本批次失败项，整批继续则重置剩余失败任务', async () => {
    await createBatch('batch-1', 'run-1')
    await createTarget('batch-1', 'target-1', '10001')
    await createBatch('batch-2', 'run-other')
    await createTarget('batch-2', 'target-2', '20002')
    expect(await repository.getLatestBatch()).toMatchObject({ id: 'batch-2', createdRunId: 'run-other' })
    await repository.createTasks([
      task({ id: 'batch-1-page-1', pageNo: 1 }),
      task({ id: 'batch-1-page-2', pageNo: 2 }),
      task({
        id: 'batch-1-probe',
        taskType: 'segment_probe',
        pageNo: 0,
        rangeStartAt: 1_706_716_800,
        rangeEndAt: 1_707_321_599,
        sequence: 3,
      }),
      task({
        id: 'batch-2-page',
        batchId: 'batch-2',
        targetId: 'target-2',
        pageNo: 1,
      }),
    ])

    for (const batchId of ['batch-1', 'batch-2']) {
      while (true) {
        const claimed = await repository.claimNextTask({ batchId, runId: `${batchId}-run` })
        if (claimed === null) break
        await repository.markTaskFailed({
          taskId: claimed.id,
          error: { code: 'REQUEST_FAILED', message: 'request failed', retryable: true },
        })
      }
    }
    const firstPage = await repository.listFailedTasks('batch-1', { limit: 1, offset: 1 })
    expect(firstPage).toMatchObject({ total: 3, limit: 1, offset: 1 })
    expect(firstPage.items).toHaveLength(1)

    await expect(repository.retryTaskIds({
      batchId: 'batch-1',
      taskIds: ['batch-1-page-1', 'batch-2-page', 'missing'],
      runId: 'run-invalid-retry',
    })).rejects.toBeInstanceOf(FetchTaskRepositoryError)
    expect(await repository.getTask('batch-1-page-1')).toMatchObject({ status: 'failed' })
    expect(await repository.getTask('batch-2-page')).toMatchObject({ status: 'failed' })

    const selected = await repository.retryTaskIds({
      batchId: 'batch-1',
      taskIds: ['batch-1-page-1', 'batch-1-page-1'],
      runId: 'run-selected-retry',
    })
    expect(selected.resetTaskIds).toEqual(['batch-1-page-1'])
    expect(await repository.getBatch('batch-1')).toMatchObject({ activeRunId: 'run-selected-retry' })

    const remaining = await repository.resumeBatch({ batchId: 'batch-1', runId: 'run-resume' })
    expect(new Set(remaining.resetTaskIds)).toEqual(new Set(['batch-1-page-2', 'batch-1-probe']))
    expect((await repository.listTasks('batch-1', { statuses: ['pending'] })).map(({ id }) => id)).toEqual([
      'batch-1-page-1',
      'batch-1-page-2',
      'batch-1-probe',
    ])
  })
})

function createDatabase(databasePath: string): Knex {
  return createKnex({
    client: 'better-sqlite3',
    connection: { filename: databasePath },
    useNullAsDefault: true,
    pool: {
      min: 1,
      max: 1,
      afterCreate(connection: unknown, done: (error: Error | null, connection: unknown) => void) {
        try {
          const sqliteConnection = connection as { pragma(statement: string): unknown }
          sqliteConnection.pragma('foreign_keys = ON')
          done(null, connection)
        } catch (error) {
          done(error as Error, connection)
        }
      },
    },
  })
}

async function initializeSchema(database: Knex): Promise<void> {
  const sqlContent = fs.readFileSync(initSqlPath, 'utf8')
  for (const statement of sqlContent.split(';')) {
    if (statement.trim() !== '') {
      await database.raw(statement.trim())
    }
  }
}
