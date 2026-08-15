import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone.js'
import utc from 'dayjs/plugin/utc.js'
import type { BrowserWindow } from 'electron'
import { resolveWeiboLoginUid } from '~/src/api/weibo_api_client.js'
import { createFetchBatch } from '~/src/application/fetch/fetch_batch_factory.js'
import {
  createFetchDatabaseClient,
  ensureFetchDatabaseSchema,
} from '~/src/application/fetch/fetch_database_schema.js'
import { WEIBO_TIME_ZONE } from '~/src/application/fetch/date_range_planner.js'
import {
  OFFLINE_WEIBO_LOGIN_UID,
  requiresWeiboFetchSession,
} from '~/src/application/fetch/fetch_session_policy.js'
import { globalWeiboRequestLimiter } from '~/src/application/fetch/weibo_request_limiter.js'
import { WeiboResponseCache } from '~/src/application/fetch/weibo_response_cache.js'
import RunTaskWorkflow from '~/src/application/workflow/run_task/run_task_workflow.js'
import {
  BackupExecutionLeaseHandle,
  DEFAULT_EXECUTION_LEASE_STALE_AFTER_MS,
} from '~/src/application/workflow/backup_execution_lease.js'
import FetchTaskRepository, {
  FetchBatchDto,
  FetchTaskDto,
} from '~/src/model/fetch_task_repository.js'
import {
  AppErrorCode,
  ApplicationError,
  ServiceLevel,
} from '~/src/shared/error/application_error.js'
import {
  assertRunnableCustomerTaskConfig,
  CustomerTaskConfig,
  parseCustomerTaskConfig,
  writeCustomerTaskConfig,
} from '~/src/shared/config/task_config.js'
import {
  CustomerTaskDashboard,
  CustomerTaskFailureSummary,
  TaskCommandAck,
  TaskProgressCounts,
} from '~/src/shared/ipc/contract.js'
import { ExecutionStatus } from '~/src/shared/runtime/execution_result.js'
import { createRunId } from '~/src/shared/runtime/run_context.js'

dayjs.extend(utc)
dayjs.extend(timezone)

const scheduledRecoveryTimers = new Map<string, ReturnType<typeof setTimeout>>()
const DASHBOARD_RECOVERY_PROBE_INTERVAL_MS = 5_000

type ActiveRun = {
  batchId: string
  runId: string
}

export type CustomerTaskRunManagerOptions = {
  databasePath: string
  localConfigPath: string
  customerTaskConfigPath: string
  cachePath: string
  logPath: string
  outputPath: string
  getRenderWindow(): BrowserWindow | null
  workflowFactory?: () => RunTaskWorkflow
  onCompleted?: (outputPath: string) => Promise<void> | void
}

export default class CustomerTaskRunManager {
  private activeRun: ActiveRun | null = null
  private preparing: Promise<TaskCommandAck> | null = null
  private maintenanceActive = false
  private dashboardRecoveryProbe: Promise<void> | null = null
  private nextDashboardRecoveryProbeAt = 0
  private readonly workflowFactory: () => RunTaskWorkflow

  constructor(private readonly options: CustomerTaskRunManagerOptions) {
    this.workflowFactory = options.workflowFactory ?? (() => new RunTaskWorkflow())
  }

  get isActive(): boolean {
    return this.activeRun !== null || this.preparing !== null
  }

  async recoverInterruptedTasks(): Promise<number> {
    const lease = await tryAcquireRecoveryLease(this.options.databasePath)
    if (lease === null) return 0
    try {
      return await this.withRepository(async (repository, database) => {
        const interruptedBatches = await database<{ id: string }>('fetch_batch')
          .select('id')
          .where('status', 'running')
        const result = await repository.recoverRunningTasks()
        for (const { id } of interruptedBatches) {
          await repository.finishBatch({ batchId: id, status: 'failed' })
        }
        return result.recoveredTaskIds.length
      })
    } finally {
      await lease.release()
    }
  }

  start(
    configInput: CustomerTaskConfig,
    cookie: string,
    traceId?: string,
    knownLoginUid?: string,
  ): Promise<TaskCommandAck> {
    const config = assertRunnableCustomerTaskConfig(parseCustomerTaskConfig(configInput))
    return this.prepareOnce(async () => {
      const runId = createRunId()
      const executionLease = await BackupExecutionLeaseHandle.acquire(
        this.options.databasePath,
        runId,
        { ownerKind: 'gui-manager' },
      )
      try {
        globalWeiboRequestLimiter.setRequestIntervalMs(config.requestIntervalSeconds * 1000)
        const needsWeiboSession = requiresWeiboFetchSession({
          isSkipFetch: config.isSkipFetch,
        })
        const loginUid = needsWeiboSession
          ? await this.requireLoginUid(cookie, knownLoginUid)
          : OFFLINE_WEIBO_LOGIN_UID
        // Persist the workflow input before creating durable work. If this write
        // fails, no orphan batch is left behind with nothing able to execute it.
        writeCustomerTaskConfig(this.options.customerTaskConfigPath, config)
        const created = await this.withRepository((repository) => createFetchBatch({
          repository,
          config,
          loginUid,
          runId,
        }))
        return this.launch({
          batchId: created.batch.id,
          runId,
          traceId,
          cookie: needsWeiboSession ? cookie : '',
          loginUid,
          executionLease,
        })
      } catch (error) {
        await executionLease.release()
        throw error
      }
    })
  }

  continue(
    batchId: string,
    cookie: string,
    traceId?: string,
    knownLoginUid?: string,
  ): Promise<TaskCommandAck> {
    return this.prepareExisting(batchId, cookie, traceId, knownLoginUid, async (repository, runId) => {
      await repository.resumeBatch({ batchId, runId })
    })
  }

  retry(
    batchId: string,
    taskIds: string[] | undefined,
    cookie: string,
    traceId?: string,
    knownLoginUid?: string,
  ): Promise<TaskCommandAck> {
    if (taskIds !== undefined && taskIds.length === 0) {
      throw this.invalidOperation('至少选择一个失败任务后才能重试')
    }
    return this.prepareExisting(batchId, cookie, traceId, knownLoginUid, async (repository, runId) => {
      if (taskIds === undefined) {
        const result = await repository.resumeBatch({ batchId, runId })
        if (result.resetTaskIds.length === 0) {
          throw this.invalidOperation('该批次没有可重试的失败任务')
        }
        return
      }
      const result = await repository.retryTaskIds({ batchId, taskIds, runId })
      if (result.resetTaskIds.length !== new Set(taskIds).size) {
        throw this.invalidOperation('部分任务不存在、不是失败状态或不属于该批次')
      }
    })
  }

  async getDashboard(batchId?: string): Promise<CustomerTaskDashboard> {
    const result = await this.withRepository(async (repository, database) => {
      const selectedBatchId = batchId ?? this.activeRun?.batchId ?? (await repository.getLatestBatch())?.id
      if (selectedBatchId === undefined) {
        return { activeRun: this.activeRun, batch: null }
      }
      const dashboard = await repository.getDashboard(selectedBatchId)
      const screenNameMap = await readScreenNames(
        database,
        dashboard.targets.map(({ target }) => target.targetUid),
      )
      const runningTask = (await repository.listTasks(selectedBatchId, { statuses: ['running'] }))[0]
      const current = runningTask === undefined
        ? undefined
        : await mapCurrentTask(repository, runningTask, screenNameMap)
      const counts = mapCounts(dashboard.taskCounts)
      const remainingRequestCount = counts.pending + counts.running
      return {
        activeRun: this.activeRun,
        batch: {
          batchId: dashboard.batch.id,
          status: dashboard.batch.status,
          resumable: this.activeRun?.batchId !== selectedBatchId &&
            (dashboard.batch.status === 'failed' || counts.failed > 0 || counts.pending > 0),
          phase: dashboard.batch.phase,
          createdAt: dashboard.batch.createdAt,
          startedAt: dashboard.batch.startedAt ?? undefined,
          finishedAt: dashboard.batch.finishedAt ?? undefined,
          estimatedRemainingSeconds: Math.ceil(
            remainingRequestCount * dashboard.batch.requestIntervalSeconds * 1.5,
          ),
          current,
          counts,
          users: dashboard.targets.map(({ target, taskCounts }) => ({
            uid: target.targetUid,
            screenName: screenNameMap.get(target.targetUid),
            status: target.status,
            counts: mapCounts(taskCounts),
          })),
        },
      }
    })
    if (result.activeRun === null && result.batch?.status === 'running') {
      this.scheduleDashboardRecoveryProbe(result.batch.batchId)
    }
    return result
  }

  async listFailures(
    batchId: string,
    options: { offset: number; limit: number },
  ): Promise<{ items: CustomerTaskFailureSummary[]; total: number }> {
    return this.withRepository(async (repository, database) => {
      const page = await repository.listFailedTasks(batchId, options)
      const screenNameMap = await readScreenNames(
        database,
        page.items.map(({ targetUid }) => targetUid),
      )
      return {
        total: page.total,
        items: page.items.map(({ task, targetUid }) => ({
          taskId: task.id,
          taskType: task.taskType,
          uid: targetUid,
          screenName: screenNameMap.get(targetUid),
          segmentStartDate: formatDate(task.rangeStartAt),
          segmentEndDate: formatDate(task.rangeEndAt),
          page: task.taskType === 'page' ? task.pageNo : undefined,
          attempts: task.attemptCount,
          errorCode: task.lastError?.code,
          errorMessage: task.lastError?.message,
          updatedAt: task.updatedAt,
        })),
      }
    })
  }

  async clearResponseCache(targetUid: string, cookie: string, knownLoginUid?: string): Promise<void> {
    await this.runMaintenance(async () => {
      const loginUid = await this.requireLoginUid(cookie, knownLoginUid)
      await new WeiboResponseCache(this.options.cachePath).clearIdentityTarget({
        apiVersion: 'weibo-web-v1',
        targetUid,
        loginUid,
      })
    }, '活动任务期间不能清理微博请求缓存')
  }

  async runMaintenance<T>(operation: () => Promise<T>, conflictMessage: string): Promise<T> {
    const recoveryProbe = this.dashboardRecoveryProbe
    if (recoveryProbe !== null) await recoveryProbe
    if (this.isActive || this.maintenanceActive) {
      throw this.invalidOperation(conflictMessage)
    }
    this.maintenanceActive = true
    let executionLease: BackupExecutionLeaseHandle | undefined
    try {
      executionLease = await BackupExecutionLeaseHandle.acquire(
        this.options.databasePath,
        createRunId(),
        { ownerKind: 'gui-maintenance' },
      )
      return await operation()
    } finally {
      try {
        await executionLease?.release()
      } finally {
        this.maintenanceActive = false
      }
    }
  }

  private prepareExisting(
    batchId: string,
    cookie: string,
    traceId: string | undefined,
    knownLoginUid: string | undefined,
    prepare: (repository: FetchTaskRepository, runId: string) => Promise<void>,
  ): Promise<TaskCommandAck> {
    return this.prepareOnce(async () => {
      const runId = createRunId()
      const executionLease = await BackupExecutionLeaseHandle.acquire(
        this.options.databasePath,
        runId,
        { ownerKind: 'gui-manager' },
      )
      try {
        const { batch, taskCounts } = await this.withRepository(async (repository) => {
          const currentBatch = await repository.getBatch(batchId)
          if (currentBatch.status === 'succeeded') {
            throw this.invalidOperation('成功批次没有待继续或重试的任务')
          }
          return {
            batch: currentBatch,
            taskCounts: (await repository.getDashboard(batchId)).taskCounts,
          }
        })
        globalWeiboRequestLimiter.setRequestIntervalMs(batch.requestIntervalSeconds * 1000)
        const config = assertRunnableCustomerTaskConfig(parseCustomerTaskConfig(batch.config))
        const needsWeiboSession = requiresWeiboFetchSession({
          isSkipFetch: config.isSkipFetch,
          taskCounts,
        })
        const loginUid = needsWeiboSession
          ? await this.requireLoginUid(cookie, knownLoginUid)
          : batch.loginUid
        if (needsWeiboSession && loginUid !== batch.loginUid) {
          throw this.invalidOperation('当前微博登录身份与批次创建身份不一致')
        }
        // Do not reopen/reset durable tasks until the workflow snapshot can be
        // written successfully; otherwise a failed local write strands pending work.
        writeCustomerTaskConfig(this.options.customerTaskConfigPath, config)
        await this.withRepository(async (repository) => {
          // A crashed process can leave this batch running even though its PID
          // lease is now immediately reclaimable. Normalize those tasks before
          // continue/retry applies its own failed -> pending selection.
          await repository.recoverRunningTasks({ batchId })
          await prepare(repository, runId)
        })
        return this.launch({
          batchId,
          runId,
          traceId,
          cookie: needsWeiboSession ? cookie : '',
          loginUid,
          executionLease,
        })
      } catch (error) {
        await executionLease.release()
        throw error
      }
    })
  }

  private async prepareOnce(factory: () => Promise<TaskCommandAck>): Promise<TaskCommandAck> {
    const recoveryProbe = this.dashboardRecoveryProbe
    if (recoveryProbe !== null) {
      await recoveryProbe
    }
    if (this.maintenanceActive) {
      throw this.invalidOperation('会话或缓存维护期间不能启动任务')
    }
    if (this.activeRun !== null) {
      return { outcome: 'already_running', ...this.activeRun }
    }
    if (this.preparing !== null) {
      const current = await this.preparing
      return { ...current, outcome: 'already_running' }
    }
    const preparation = factory()
    this.preparing = preparation
    try {
      return await preparation
    } finally {
      if (this.preparing === preparation) this.preparing = null
    }
  }

  private scheduleDashboardRecoveryProbe(batchId: string): void {
    const now = Date.now()
    if (
      this.dashboardRecoveryProbe !== null ||
      this.activeRun !== null ||
      this.preparing !== null ||
      this.maintenanceActive ||
      now < this.nextDashboardRecoveryProbeAt
    ) {
      return
    }
    this.nextDashboardRecoveryProbeAt = now + DASHBOARD_RECOVERY_PROBE_INTERVAL_MS

    let trackedProbe: Promise<void>
    trackedProbe = Promise.resolve()
      .then(async () => {
        const lease = await tryAcquireRecoveryLease(this.options.databasePath)
        if (lease === null) return
        try {
          await this.withRepository(async (repository) => {
            const batch = await repository.getBatch(batchId)
            if (batch.status !== 'running') return
            await repository.recoverRunningTasks({ batchId })
            await repository.finishBatch({ batchId, status: 'failed' })
          })
        } finally {
          await lease.release()
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (this.dashboardRecoveryProbe === trackedProbe) {
          this.dashboardRecoveryProbe = null
        }
      })
    this.dashboardRecoveryProbe = trackedProbe
  }

  private launch(input: ActiveRun & {
    traceId?: string
    cookie: string
    loginUid: string
    executionLease: BackupExecutionLeaseHandle
  }): TaskCommandAck {
    this.activeRun = { batchId: input.batchId, runId: input.runId }
    setImmediate(() => {
      void this.executeBackground(input)
    })
    return { outcome: 'started', batchId: input.batchId, runId: input.runId }
  }

  private async executeBackground(input: ActiveRun & {
    traceId?: string
    cookie: string
    loginUid: string
    executionLease: BackupExecutionLeaseHandle
  }): Promise<void> {
    try {
      input.executionLease.assertHealthy()
      const result = await this.workflowFactory().run({
        trigger: 'gui',
        runId: input.runId,
        traceId: input.traceId,
        configPath: this.options.customerTaskConfigPath,
        localConfigPath: this.options.localConfigPath,
        databasePath: this.options.databasePath,
        cachePath: this.options.cachePath,
        logPath: this.options.logPath,
        outputPath: this.options.outputPath,
        batchId: input.batchId,
        fetchSession: { cookie: input.cookie, loginUid: input.loginUid },
        executionLeaseManagedExternally: true,
        renderWindow: this.options.getRenderWindow(),
        skipUpgradeCheck: true,
      })
      if (result.status === ExecutionStatus.FAILURE) {
        await this.finishFailedBatch(input.batchId)
        return
      }
      input.executionLease.assertHealthy()
      try {
        await this.options.onCompleted?.(result.value?.context.outputPath ?? this.options.outputPath)
      } catch {
        // Opening/revealing generated output is best-effort and must not turn a
        // successfully completed durable batch into a failed one.
      }
    } catch {
      await this.finishFailedBatch(input.batchId)
    } finally {
      try {
        await input.executionLease.release()
      } finally {
        if (this.activeRun?.runId === input.runId) this.activeRun = null
        globalWeiboRequestLimiter.setRequestIntervalMs(10_000)
      }
    }
  }

  private finishFailedBatch(batchId: string): Promise<void> {
    return this.withRepository(async (repository) => {
      // A workflow can fail after claiming a task but before its local catch
      // persists the task failure (for example, if SQLite itself throws).
      // Recover it immediately so the same process can continue the batch;
      // startup recovery remains the fallback for a hard process exit.
      await repository.recoverRunningTasks({ batchId })
      await repository.finishBatch({ batchId, status: 'failed' })
    }).catch(() => undefined)
  }

  private async requireLoginUid(cookie: string, knownLoginUid?: string): Promise<string> {
    if (cookie.trim() === '') {
      throw this.invalidOperation('微博登录会话为空，请先登录')
    }
    if (knownLoginUid !== undefined) {
      if (/^\d{1,32}$/.test(knownLoginUid) === false) {
        throw this.invalidOperation('微博登录身份格式无效')
      }
      return knownLoginUid
    }
    return resolveWeiboLoginUid({ cookie })
  }

  private async withRepository<T>(
    handler: (repository: FetchTaskRepository, database: ReturnType<typeof createFetchDatabaseClient>) => Promise<T>,
  ): Promise<T> {
    const database = createFetchDatabaseClient(this.options.databasePath)
    try {
      await ensureFetchDatabaseSchema(database)
      return await handler(new FetchTaskRepository(database), database)
    } finally {
      await database.destroy()
    }
  }

  private invalidOperation(message: string): ApplicationError {
    return new ApplicationError({
      code: AppErrorCode.WORKFLOW_FAILED,
      message,
      serviceLevel: ServiceLevel.S1,
      stage: 'workflow',
      retryable: false,
    })
  }
}

function mapCounts(counts: {
  total: number
  pending: number
  running: number
  succeeded: number
  failed: number
  cacheHits: number
}): TaskProgressCounts {
  return {
    total: counts.total,
    pending: counts.pending,
    running: counts.running,
    succeeded: counts.succeeded,
    failed: counts.failed,
    cacheHits: counts.cacheHits,
  }
}

async function readScreenNames(
  database: ReturnType<typeof createFetchDatabaseClient>,
  uidList: string[],
): Promise<Map<string, string>> {
  const uniqueUidList = [...new Set(uidList)]
  if (uniqueUidList.length === 0) return new Map()
  const rows = await database<{ author_uid: string; raw_json: string }>('total_user')
    .select('author_uid', 'raw_json')
    .whereIn('author_uid', uniqueUidList)
  const result = new Map<string, string>()
  for (const row of rows) {
    try {
      const value = JSON.parse(row.raw_json) as { screen_name?: unknown }
      if (typeof value.screen_name === 'string') result.set(row.author_uid, value.screen_name)
    } catch {
      // Corrupt legacy user rows do not prevent progress inspection.
    }
  }
  return result
}

async function mapCurrentTask(
  repository: FetchTaskRepository,
  task: FetchTaskDto,
  screenNameMap: Map<string, string>,
): Promise<NonNullable<NonNullable<CustomerTaskDashboard['batch']>['current']>> {
  const target = await repository.getTarget(task.targetId)
  const start = dayjs.unix(task.rangeStartAt).tz(WEIBO_TIME_ZONE)
  let pageCount: number | undefined
  if (task.taskType === 'page' && task.parentTaskId !== null) {
    const parent = await repository.getTask(task.parentTaskId)
    pageCount = parent.totalCount === null ? undefined : Math.ceil(parent.totalCount / 50)
  }
  return {
    uid: target.targetUid,
    screenName: screenNameMap.get(target.targetUid),
    year: start.year(),
    month: start.month() + 1,
    segmentStartDate: formatDate(task.rangeStartAt),
    segmentEndDate: formatDate(task.rangeEndAt),
    page: task.taskType === 'page' ? task.pageNo : undefined,
    pageCount,
  }
}

function formatDate(epochSeconds: number): string {
  return dayjs.unix(epochSeconds).tz(WEIBO_TIME_ZONE).format('YYYY-MM-DD')
}

/** Startup hook: interrupted running tasks become explicit, manually resumable failures. */
export async function recoverInterruptedFetchTasks(databasePath: string): Promise<number> {
  const lease = await tryAcquireRecoveryLease(databasePath)
  if (lease === null) return 0
  const database = createFetchDatabaseClient(databasePath)
  try {
    await ensureFetchDatabaseSchema(database)
    const repository = new FetchTaskRepository(database)
    const interruptedBatches = await database<{ id: string }>('fetch_batch')
      .select('id')
      .where('status', 'running')
    const result = await repository.recoverRunningTasks()
    for (const { id } of interruptedBatches) {
      await repository.finishBatch({ batchId: id, status: 'failed' })
    }
    return result.recoveredTaskIds.length
  } finally {
    await database.destroy()
    await lease.release()
  }
}

async function tryAcquireRecoveryLease(databasePath: string): Promise<BackupExecutionLeaseHandle | null> {
  try {
    return await BackupExecutionLeaseHandle.acquire(databasePath, createRunId(), {
      ownerKind: 'startup-recovery',
    })
  } catch (error) {
    if (
      error instanceof ApplicationError &&
      error.code === AppErrorCode.WORKFLOW_FAILED &&
      error.stage === 'workflow-lease'
    ) {
      if (error.details?.holderOwnerPid === 0) {
        const heartbeatAt = error.details.heartbeatAt
        const retryAfterMs = typeof heartbeatAt === 'number'
          ? Math.max(1_000, heartbeatAt + DEFAULT_EXECUTION_LEASE_STALE_AFTER_MS - Date.now() + 100)
          : DEFAULT_EXECUTION_LEASE_STALE_AFTER_MS
        scheduleInterruptedFetchRecovery(databasePath, retryAfterMs)
      }
      return null
    }
    throw error
  }
}

function scheduleInterruptedFetchRecovery(databasePath: string, retryAfterMs: number): void {
  const key = databasePath.toLowerCase()
  if (scheduledRecoveryTimers.has(key)) return
  const timer = setTimeout(() => {
    scheduledRecoveryTimers.delete(key)
    void recoverInterruptedFetchTasks(databasePath).catch(() => undefined)
  }, retryAfterMs)
  timer.unref?.()
  scheduledRecoveryTimers.set(key, timer)
}
