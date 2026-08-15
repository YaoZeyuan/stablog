import { randomUUID } from 'node:crypto'
import type { Knex } from 'knex'

export const FETCH_TASK_TYPE_LIST = ['year_probe', 'month_probe', 'segment_probe', 'page'] as const

export const FETCH_TASK_STATUS_LIST = ['pending', 'running', 'succeeded', 'failed'] as const
export const FETCH_BATCH_STATUS_LIST = [...FETCH_TASK_STATUS_LIST, 'partial_success'] as const
export const FETCH_BATCH_PHASE_LIST = ['planning', 'fetching', 'generating', 'done'] as const
export const FETCH_CACHE_READ_MODE_LIST = ['prefer_cache', 'bypass_cache'] as const

export type FetchTaskType = (typeof FETCH_TASK_TYPE_LIST)[number]
export type FetchTaskStatus = (typeof FETCH_TASK_STATUS_LIST)[number]
export type FetchBatchStatus = (typeof FETCH_BATCH_STATUS_LIST)[number]
export type FetchBatchPhase = (typeof FETCH_BATCH_PHASE_LIST)[number]
export type FetchCacheReadMode = (typeof FETCH_CACHE_READ_MODE_LIST)[number]

export type FetchBatchDto = {
  id: string
  createdRunId: string
  activeRunId: string
  phase: FetchBatchPhase
  status: FetchBatchStatus
  config: unknown
  loginUid: string
  cacheReadMode: FetchCacheReadMode
  requestIntervalSeconds: number
  fetchStartAt: number
  fetchEndAt: number
  createdAt: number
  updatedAt: number
  startedAt: number | null
  finishedAt: number | null
}

export type FetchTargetDto = {
  id: string
  batchId: string
  targetUid: string
  sequence: number
  status: FetchBatchStatus
  createdAt: number
  updatedAt: number
  startedAt: number | null
  finishedAt: number | null
}

export type FetchTaskFailure = {
  code: string
  message: string
  retryable: boolean
  details?: unknown
}

export type FetchTaskDto = {
  id: string
  batchId: string
  targetId: string
  parentTaskId: string | null
  taskType: FetchTaskType
  rangeStartAt: number
  rangeEndAt: number
  pageNo: number
  sequence: number
  status: FetchTaskStatus
  attemptCount: number
  totalCount: number | null
  cacheHits: number
  claimedByRunId: string | null
  lastError: FetchTaskFailure | null
  createdAt: number
  updatedAt: number
  startedAt: number | null
  finishedAt: number | null
}

export type FetchTaskCounts = Record<FetchTaskStatus, number> & {
  total: number
  completed: number
  cacheHits: number
}

export type FetchTargetDashboardDto = {
  target: FetchTargetDto
  taskCounts: FetchTaskCounts
  failedPageCount: number
}

export type FetchDashboardDto = {
  batch: FetchBatchDto
  taskCounts: FetchTaskCounts
  targetCount: number
  completedRatio: number
  targets: FetchTargetDashboardDto[]
}

export type FailedFetchTaskDto = {
  task: FetchTaskDto
  targetUid: string
}

export type FailedFetchTaskPageDto = {
  total: number
  limit: number
  offset: number
  items: FailedFetchTaskDto[]
}

export type CreateFetchBatchInput = {
  id?: string
  runId: string
  config: unknown
  loginUid: string
  cacheReadMode: FetchCacheReadMode
  requestIntervalSeconds: number
  fetchStartAt: number
  fetchEndAt: number
}

export type CreateFetchTargetInput = {
  id?: string
  batchId: string
  targetUid: string
  sequence?: number
}

export type CreateFetchTaskInput = {
  id?: string
  batchId: string
  targetId: string
  parentTaskId?: string | null
  taskType: FetchTaskType
  rangeStartAt: number
  rangeEndAt: number
  pageNo?: number
  sequence?: number
}

export type CompleteFetchProbeTaskInput = {
  taskId: string
  totalCount: number
  cacheHits?: number
  childTasks: CreateFetchTaskInput[]
}

export type ClaimFetchTaskInput = {
  batchId: string
  runId: string
  targetId?: string
  taskTypes?: FetchTaskType[]
}

export type ListFetchTasksFilter = {
  targetId?: string
  statuses?: FetchTaskStatus[]
  taskTypes?: FetchTaskType[]
}

export type FetchTaskRepositoryOptions = {
  now?: () => number
  createId?: (prefix: 'batch' | 'target' | 'task') => string
}

type FetchBatchRow = {
  id: string
  created_run_id: string
  active_run_id: string
  phase: FetchBatchPhase
  status: FetchBatchStatus
  config_json: string
  login_uid: string
  cache_read_mode: FetchCacheReadMode
  request_interval_seconds: number
  fetch_start_at: number
  fetch_end_at: number
  created_at: number
  updated_at: number
  started_at: number | null
  finished_at: number | null
}

type FetchTargetRow = {
  id: string
  batch_id: string
  target_uid: string
  sequence: number
  status: FetchBatchStatus
  created_at: number
  updated_at: number
  started_at: number | null
  finished_at: number | null
}

type FetchTaskRow = {
  id: string
  batch_id: string
  target_id: string
  parent_task_id: string | null
  task_type: FetchTaskType
  range_start_at: number
  range_end_at: number
  page_no: number
  sequence: number
  status: FetchTaskStatus
  attempt_count: number
  total_count: number | null
  cache_hits: number
  claimed_by_run_id: string | null
  last_error_json: string | null
  created_at: number
  updated_at: number
  started_at: number | null
  finished_at: number | null
}

type StatusCountRow = {
  status: FetchTaskStatus
  count: number | string
  cache_hits?: number | string
}

type TargetStatusCountRow = StatusCountRow & {
  target_id: string
}

export class FetchTaskRepositoryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FetchTaskRepositoryError'
  }
}

export default class FetchTaskRepository {
  private readonly now: () => number
  private readonly createId: (prefix: 'batch' | 'target' | 'task') => string

  constructor(
    private readonly database: Knex,
    options: FetchTaskRepositoryOptions = {},
  ) {
    this.now = options.now ?? Date.now
    this.createId = options.createId ?? ((prefix) => `${prefix}-${randomUUID()}`)
  }

  /**
   * Run a multi-step repository operation on one database transaction while
   * preserving the injected clock/id factories used by deterministic tests.
   */
  runInTransaction<T>(
    handler: (repository: FetchTaskRepository) => Promise<T>,
  ): Promise<T> {
    return this.database.transaction((transaction) => handler(new FetchTaskRepository(
      transaction,
      { now: this.now, createId: this.createId },
    )))
  }

  async createBatch(input: CreateFetchBatchInput): Promise<FetchBatchDto> {
    requireNonEmpty(input.runId, 'runId')
    requireNonEmpty(input.loginUid, 'loginUid')
    requireOneOf(input.cacheReadMode, FETCH_CACHE_READ_MODE_LIST, 'cacheReadMode')
    requirePositiveFinite(input.requestIntervalSeconds, 'requestIntervalSeconds')
    requireEpoch(input.fetchStartAt, 'fetchStartAt')
    requireEpoch(input.fetchEndAt, 'fetchEndAt')
    if (input.fetchEndAt < input.fetchStartAt) {
      throw new FetchTaskRepositoryError('fetchEndAt不能小于fetchStartAt')
    }

    const now = this.now()
    const row: FetchBatchRow = {
      id: input.id ?? this.createId('batch'),
      created_run_id: input.runId,
      active_run_id: input.runId,
      phase: 'planning',
      status: 'pending',
      config_json: serializeJson(input.config, 'config'),
      login_uid: input.loginUid,
      cache_read_mode: input.cacheReadMode,
      request_interval_seconds: input.requestIntervalSeconds,
      fetch_start_at: input.fetchStartAt,
      fetch_end_at: input.fetchEndAt,
      created_at: now,
      updated_at: now,
      started_at: null,
      finished_at: null,
    }
    await this.database<FetchBatchRow>('fetch_batch').insert(row)
    return mapBatch(row)
  }

  async getBatch(batchId: string): Promise<FetchBatchDto> {
    const row = await this.requireBatch(this.database, batchId)
    return mapBatch(row)
  }

  async getLatestBatch(): Promise<FetchBatchDto | null> {
    const row = await this.database<FetchBatchRow>('fetch_batch')
      .orderBy('created_at', 'desc')
      .orderByRaw('rowid DESC')
      .first()
    return row === undefined ? null : mapBatch(row)
  }

  async createTarget(input: CreateFetchTargetInput): Promise<FetchTargetDto> {
    requireNonEmpty(input.batchId, 'batchId')
    requireNonEmpty(input.targetUid, 'targetUid')
    requireNonNegativeInteger(input.sequence ?? 0, 'sequence')

    return this.database.transaction(async (transaction) => {
      await this.requireBatch(transaction, input.batchId)
      const existing = await transaction<FetchTargetRow>('fetch_target')
        .where({ batch_id: input.batchId, target_uid: input.targetUid })
        .first()
      if (existing !== undefined) {
        return mapTarget(existing)
      }

      const now = this.now()
      const row: FetchTargetRow = {
        id: input.id ?? this.createId('target'),
        batch_id: input.batchId,
        target_uid: input.targetUid,
        sequence: input.sequence ?? 0,
        status: 'pending',
        created_at: now,
        updated_at: now,
        started_at: null,
        finished_at: null,
      }
      await transaction<FetchTargetRow>('fetch_target').insert(row)
      await this.refreshBatchStatus(transaction, input.batchId, now)
      return mapTarget(row)
    })
  }

  async getTarget(targetId: string): Promise<FetchTargetDto> {
    const row = await this.requireTarget(this.database, targetId)
    return mapTarget(row)
  }

  async createTasks(inputList: CreateFetchTaskInput[]): Promise<FetchTaskDto[]> {
    if (inputList.length === 0) {
      return []
    }
    inputList.forEach(validateCreateTaskInput)

    return this.database.transaction(async (transaction) => {
      const result: FetchTaskDto[] = []
      const affectedTargetIdSet = new Set<string>()
      const affectedBatchIdSet = new Set<string>()

      for (const input of inputList) {
        const target = await this.requireTarget(transaction, input.targetId)
        if (target.batch_id !== input.batchId) {
          throw new FetchTaskRepositoryError(`目标 ${input.targetId} 不属于批次 ${input.batchId}`)
        }
        if (input.parentTaskId !== undefined && input.parentTaskId !== null) {
          const parent = await this.requireTask(transaction, input.parentTaskId)
          if (parent.batch_id !== input.batchId || parent.target_id !== input.targetId) {
            throw new FetchTaskRepositoryError(`父任务 ${input.parentTaskId} 不属于同一批次和目标`)
          }
        }

        const now = this.now()
        const pageNo = input.taskType === 'page' ? input.pageNo! : 0
        const row: FetchTaskRow = {
          id: input.id ?? this.createId('task'),
          batch_id: input.batchId,
          target_id: input.targetId,
          parent_task_id: input.parentTaskId ?? null,
          task_type: input.taskType,
          range_start_at: input.rangeStartAt,
          range_end_at: input.rangeEndAt,
          page_no: pageNo,
          sequence: input.sequence ?? 0,
          status: 'pending',
          attempt_count: 0,
          total_count: null,
          cache_hits: 0,
          claimed_by_run_id: null,
          last_error_json: null,
          created_at: now,
          updated_at: now,
          started_at: null,
          finished_at: null,
        }
        const inserted = await transaction<FetchTaskRow>('fetch_task')
          .insert(row)
          .onConflict(['target_id', 'task_type', 'range_start_at', 'range_end_at', 'page_no'])
          .ignore()
          .returning('*')
        const stored =
          inserted[0] ??
          (await transaction<FetchTaskRow>('fetch_task')
            .where({
              target_id: row.target_id,
              task_type: row.task_type,
              range_start_at: row.range_start_at,
              range_end_at: row.range_end_at,
              page_no: row.page_no,
            })
            .first())
        if (stored === undefined) {
          throw new FetchTaskRepositoryError('任务创建后无法读取')
        }
        result.push(mapTask(stored))
        affectedTargetIdSet.add(input.targetId)
        affectedBatchIdSet.add(input.batchId)
      }

      const now = this.now()
      for (const targetId of affectedTargetIdSet) {
        await this.refreshTargetStatus(transaction, targetId, now)
      }
      for (const batchId of affectedBatchIdSet) {
        await this.refreshBatchStatus(transaction, batchId, now)
      }
      return result
    })
  }

  /**
   * Persist one probe result as a single recovery boundary. Historical versions
   * could commit children before marking their parent succeeded; a retried
   * running parent may therefore have a pristine pending subtree. Such a tree
   * is safe to replace, while any descendant that has ever run is preserved and
   * causes an explicit failure instead of destructive reconciliation.
   */
  async completeProbeTask(
    input: CompleteFetchProbeTaskInput,
  ): Promise<{ task: FetchTaskDto; childTasks: FetchTaskDto[] }> {
    requireNonEmpty(input.taskId, 'taskId')
    requireNonNegativeInteger(input.totalCount, 'totalCount')
    requireNonNegativeInteger(input.cacheHits ?? 0, 'cacheHits')
    input.childTasks.forEach(validateCreateTaskInput)
    const childKeySet = new Set<string>()
    for (const child of input.childTasks) {
      const key = `${child.taskType}:${child.rangeStartAt}:${child.rangeEndAt}:${child.pageNo ?? 0}`
      if (childKeySet.has(key)) {
        throw new FetchTaskRepositoryError('探测任务包含重复子任务')
      }
      childKeySet.add(key)
    }

    return this.database.transaction(async (transaction) => {
      const parent = await this.requireTask(transaction, input.taskId)
      if (parent.status !== 'running') {
        throw new FetchTaskRepositoryError(
          `任务 ${input.taskId} 当前状态为 ${parent.status}，不能完成探测任务`,
        )
      }
      const expectedChildType = childTaskTypeFor(parent.task_type)
      if (expectedChildType === null) {
        throw new FetchTaskRepositoryError('分页任务不能创建探测子任务')
      }
      if (input.totalCount === 0 && input.childTasks.length !== 0) {
        throw new FetchTaskRepositoryError('总数为0的探测任务不能创建子任务')
      }
      if (input.totalCount > 0 && input.childTasks.length === 0) {
        throw new FetchTaskRepositoryError('总数大于0的探测任务必须创建子任务')
      }
      for (const child of input.childTasks) {
        if (
          child.batchId !== parent.batch_id ||
          child.targetId !== parent.target_id ||
          child.parentTaskId !== parent.id ||
          child.taskType !== expectedChildType ||
          child.rangeStartAt < parent.range_start_at ||
          child.rangeEndAt > parent.range_end_at
        ) {
          throw new FetchTaskRepositoryError('探测子任务与父任务的批次、目标、层级或范围不一致')
        }
      }

      const staleSubtreeLevels = await this.listDescendantTaskRows(transaction, parent.id)
      const staleRows = staleSubtreeLevels.flat()
      if (staleRows.some((row) => isPristinePendingTask(row) === false)) {
        throw new FetchTaskRepositoryError('探测任务存在已开始的后代，拒绝覆盖有效任务进度')
      }
      for (const level of [...staleSubtreeLevels].reverse()) {
        await transaction<FetchTaskRow>('fetch_task')
          .whereIn('id', level.map(({ id }) => id))
          .delete()
      }

      const transactionRepository = new FetchTaskRepository(transaction, {
        now: this.now,
        createId: this.createId,
      })
      const childTasks = input.childTasks.length === 0
        ? []
        : await transactionRepository.createTasks(input.childTasks)
      const task = await transactionRepository.markTaskSucceeded({
        taskId: parent.id,
        totalCount: input.totalCount,
        cacheHits: input.cacheHits ?? 0,
      })
      return { task, childTasks }
    })
  }

  async getTask(taskId: string): Promise<FetchTaskDto> {
    return mapTask(await this.requireTask(this.database, taskId))
  }

  async listTasks(batchId: string, filter: ListFetchTasksFilter = {}): Promise<FetchTaskDto[]> {
    const query = this.database<FetchTaskRow>('fetch_task')
      .where('batch_id', batchId)
      .orderBy([
        { column: 'target_id', order: 'asc' },
        { column: 'sequence', order: 'asc' },
        { column: 'range_start_at', order: 'asc' },
        { column: 'page_no', order: 'asc' },
        { column: 'id', order: 'asc' },
      ])
    if (filter.targetId !== undefined) {
      query.where('target_id', filter.targetId)
    }
    if (filter.statuses !== undefined && filter.statuses.length > 0) {
      query.whereIn('status', filter.statuses)
    }
    if (filter.taskTypes !== undefined && filter.taskTypes.length > 0) {
      query.whereIn('task_type', filter.taskTypes)
    }
    return (await query).map(mapTask)
  }

  async claimNextTask(input: ClaimFetchTaskInput): Promise<FetchTaskDto | null> {
    requireNonEmpty(input.batchId, 'batchId')
    requireNonEmpty(input.runId, 'runId')
    input.taskTypes?.forEach((taskType) => requireOneOf(taskType, FETCH_TASK_TYPE_LIST, 'taskType'))

    return this.database.transaction(async (transaction) => {
      await this.requireBatch(transaction, input.batchId)
      const candidate = transaction
        .select('task.id')
        .from<FetchTaskRow>({ task: 'fetch_task' })
        .innerJoin({ target: 'fetch_target' }, 'target.id', 'task.target_id')
        .leftJoin({ parent: 'fetch_task' }, 'parent.id', 'task.parent_task_id')
        .where('task.batch_id', input.batchId)
        .where('task.status', 'pending')
        .where((builder) => {
          builder.whereNull('task.parent_task_id').orWhere('parent.status', 'succeeded')
        })
        .orderBy([
          { column: 'target.sequence', order: 'asc' },
          { column: 'task.sequence', order: 'asc' },
          { column: 'task.range_start_at', order: 'asc' },
          { column: 'task.page_no', order: 'asc' },
          { column: 'task.id', order: 'asc' },
        ])
        .limit(1)
      if (input.targetId !== undefined) {
        candidate.where('task.target_id', input.targetId)
      }
      if (input.taskTypes !== undefined && input.taskTypes.length > 0) {
        candidate.whereIn('task.task_type', input.taskTypes)
      }

      const now = this.now()
      const claimed = await transaction<FetchTaskRow>('fetch_task')
        .where('status', 'pending')
        .whereIn('id', candidate)
        .update({
          status: 'running',
          attempt_count: transaction.raw('attempt_count + 1'),
          claimed_by_run_id: input.runId,
          last_error_json: null,
          started_at: now,
          finished_at: null,
          updated_at: now,
        })
        .returning('*')
      const row = claimed[0]
      if (row === undefined) {
        return null
      }

      await transaction<FetchTargetRow>('fetch_target')
        .where('id', row.target_id)
        .update({
          status: 'running',
          started_at: transaction.raw('COALESCE(started_at, ?)', [now]),
          finished_at: null,
          updated_at: now,
        })
      await transaction<FetchBatchRow>('fetch_batch')
        .where('id', input.batchId)
        .update({
          active_run_id: input.runId,
          status: 'running',
          started_at: transaction.raw('COALESCE(started_at, ?)', [now]),
          finished_at: null,
          updated_at: now,
        })
      return mapTask(row)
    })
  }

  async markTaskSucceeded(input: {
    taskId: string
    totalCount?: number | null
    cacheHits?: number
  }): Promise<FetchTaskDto> {
    if (input.totalCount !== undefined && input.totalCount !== null) {
      requireNonNegativeInteger(input.totalCount, 'totalCount')
    }
    if (input.cacheHits !== undefined) {
      requireNonNegativeInteger(input.cacheHits, 'cacheHits')
    }
    return this.completeTask(input.taskId, 'succeeded', {
      total_count: input.totalCount ?? null,
      cache_hits: input.cacheHits ?? 0,
      last_error_json: null,
    })
  }

  async markTaskFailed(input: { taskId: string; error: FetchTaskFailure }): Promise<FetchTaskDto> {
    validateFailure(input.error)
    return this.completeTask(input.taskId, 'failed', {
      last_error_json: serializeJson(input.error, 'error'),
    })
  }

  async setBatchPhase(input: {
    batchId: string
    phase: Exclude<FetchBatchPhase, 'done'>
    runId?: string
  }): Promise<FetchBatchDto> {
    requireOneOf(input.phase, ['planning', 'fetching', 'generating'] as const, 'phase')
    if (input.runId !== undefined) {
      requireNonEmpty(input.runId, 'runId')
    }
    const now = this.now()
    const update: Record<string, unknown> = {
      phase: input.phase,
      status: 'running',
      started_at: this.database.raw('COALESCE(started_at, ?)', [now]),
      finished_at: null,
      updated_at: now,
    }
    if (input.runId !== undefined) {
      update.active_run_id = input.runId
    }
    const rows = await this.database<FetchBatchRow>('fetch_batch')
      .where('id', input.batchId)
      .update(update)
      .returning('*')
    if (rows[0] === undefined) {
      throw new FetchTaskRepositoryError(`抓取批次不存在：${input.batchId}`)
    }
    return mapBatch(rows[0])
  }

  async finishBatch(input: {
    batchId: string
    status?: Extract<FetchBatchStatus, 'succeeded' | 'partial_success' | 'failed'>
  }): Promise<FetchBatchDto> {
    return this.database.transaction(async (transaction) => {
      await this.requireBatch(transaction, input.batchId)
      const now = this.now()
      const targetIdRows = await transaction<Pick<FetchTargetRow, 'id'>>('fetch_target')
        .select('id')
        .where('batch_id', input.batchId)
      for (const { id } of targetIdRows) {
        await this.refreshTargetStatus(transaction, id, now)
      }
      const targetRows = await transaction<Pick<FetchTargetRow, 'status'>>('fetch_target')
        .select('status')
        .where('batch_id', input.batchId)
      const aggregateStatus = aggregateStatuses(targetRows.map(({ status }) => status))
      const status = input.status ?? aggregateStatus
      if (status === 'pending' || status === 'running') {
        throw new FetchTaskRepositoryError('仍有未完成任务，不能结束抓取批次')
      }
      const rows = await transaction<FetchBatchRow>('fetch_batch')
        .where('id', input.batchId)
        .update({
          phase: 'done',
          status,
          finished_at: now,
          updated_at: now,
        })
        .returning('*')
      return mapBatch(rows[0])
    })
  }

  async getDashboard(batchId: string): Promise<FetchDashboardDto> {
    const batch = await this.getBatch(batchId)
    const targetRows = await this.database<FetchTargetRow>('fetch_target')
      .where('batch_id', batchId)
      .orderBy([
        { column: 'sequence', order: 'asc' },
        { column: 'id', order: 'asc' },
      ])
    const countRows = (await this.database('fetch_task')
      .select('target_id', 'status')
      .count({ count: '*' })
      .sum({ cache_hits: 'cache_hits' })
      .where('batch_id', batchId)
      .groupBy('target_id', 'status')) as TargetStatusCountRow[]
    const failedPageRows = (await this.database('fetch_task')
      .select('target_id')
      .count({ count: '*' })
      .where({ batch_id: batchId, task_type: 'page', status: 'failed' })
      .groupBy('target_id')) as Array<{ target_id: string; count: number | string }>
    const failedPageMap = new Map(failedPageRows.map((row) => [row.target_id, Number(row.count)]))
    const targets = targetRows.map((row) => ({
      target: mapTarget(row),
      taskCounts: countsFromRows(countRows.filter((count) => count.target_id === row.id)),
      failedPageCount: failedPageMap.get(row.id) ?? 0,
    }))
    const taskCounts = addCounts(targets.map(({ taskCounts }) => taskCounts))
    return {
      batch,
      taskCounts,
      targetCount: targets.length,
      completedRatio: taskCounts.total === 0 ? 0 : taskCounts.completed / taskCounts.total,
      targets,
    }
  }

  async listFailedTasks(
    batchId: string,
    options: { limit?: number; offset?: number; taskTypes?: FetchTaskType[] } = {},
  ): Promise<FailedFetchTaskPageDto> {
    const limit = options.limit ?? 100
    const offset = options.offset ?? 0
    requirePositiveInteger(limit, 'limit')
    requireNonNegativeInteger(offset, 'offset')
    if (limit > 500) {
      throw new FetchTaskRepositoryError('limit不能大于500')
    }
    options.taskTypes?.forEach((taskType) => requireOneOf(taskType, FETCH_TASK_TYPE_LIST, 'taskType'))

    const baseFilter = (query: Knex.QueryBuilder) => {
      query.where('task.batch_id', batchId).where('task.status', 'failed')
      if (options.taskTypes !== undefined && options.taskTypes.length > 0) {
        query.whereIn('task.task_type', options.taskTypes)
      }
    }
    const countQuery = this.database({ task: 'fetch_task' }).count<{ count: number | string }[]>({ count: '*' })
    baseFilter(countQuery)
    const total = Number((await countQuery)[0]?.count ?? 0)

    const itemQuery = this.database({ task: 'fetch_task' })
      .innerJoin({ target: 'fetch_target' }, 'target.id', 'task.target_id')
      .select('task.*', 'target.target_uid')
      .orderBy([
        { column: 'target.sequence', order: 'asc' },
        { column: 'task.range_start_at', order: 'asc' },
        { column: 'task.page_no', order: 'asc' },
        { column: 'task.id', order: 'asc' },
      ])
      .limit(limit)
      .offset(offset)
    baseFilter(itemQuery)
    const rows = (await itemQuery) as Array<FetchTaskRow & { target_uid: string }>
    return {
      total,
      limit,
      offset,
      items: rows.map((row) => ({ task: mapTask(row), targetUid: row.target_uid })),
    }
  }

  listFailedPages(batchId: string, options: { limit?: number; offset?: number } = {}): Promise<FailedFetchTaskPageDto> {
    return this.listFailedTasks(batchId, { ...options, taskTypes: ['page'] })
  }

  async recoverRunningTasks(
    input: {
      batchId?: string
      reason?: FetchTaskFailure
    } = {},
  ): Promise<{ recoveredTaskIds: string[] }> {
    const reason = input.reason ?? {
      code: 'FETCH_TASK_INTERRUPTED',
      message: '应用在任务执行期间退出，任务已恢复为失败并等待重试',
      retryable: true,
    }
    validateFailure(reason)

    return this.database.transaction(async (transaction) => {
      const query = transaction<FetchTaskRow>('fetch_task').where('status', 'running')
      if (input.batchId !== undefined) {
        query.where('batch_id', input.batchId)
      }
      const runningRows = await query.select('*')
      if (runningRows.length === 0) {
        return { recoveredTaskIds: [] }
      }
      const now = this.now()
      const taskIdList = runningRows.map(({ id }) => id)
      await transaction<FetchTaskRow>('fetch_task')
        .whereIn('id', taskIdList)
        .where('status', 'running')
        .update({
          status: 'failed',
          last_error_json: serializeJson(reason, 'reason'),
          finished_at: now,
          updated_at: now,
        })
      await this.refreshAffectedAggregates(transaction, runningRows, now)
      return { recoveredTaskIds: taskIdList }
    })
  }

  async resumeBatch(input: { batchId: string; runId: string }): Promise<{ resetTaskIds: string[] }> {
    requireNonEmpty(input.runId, 'runId')
    return this.database.transaction(async (transaction) => {
      const batch = await this.requireBatch(transaction, input.batchId)
      assertBatchCanResume(batch)
      const now = this.now()
      const rows = await transaction<FetchTaskRow>('fetch_task')
        .where({ batch_id: input.batchId, status: 'failed' })
        .update({
          status: 'pending',
          cache_hits: 0,
          claimed_by_run_id: null,
          last_error_json: null,
          started_at: null,
          finished_at: null,
          updated_at: now,
        })
        .returning('*')
      await transaction<FetchBatchRow>('fetch_batch')
        .where('id', input.batchId)
        .update({
          active_run_id: input.runId,
          status: 'running',
          started_at: transaction.raw('COALESCE(started_at, ?)', [now]),
          finished_at: null,
          updated_at: now,
      })
      await this.refreshAffectedAggregates(transaction, rows, now)
      return { resetTaskIds: rows.map(({ id }) => id) }
    })
  }

  async retryTaskIds(input: {
    batchId: string
    taskIds: string[]
    runId?: string
  }): Promise<{ resetTaskIds: string[] }> {
    const uniqueTaskIds = [...new Set(input.taskIds)]
    if (uniqueTaskIds.length === 0) {
      return { resetTaskIds: [] }
    }
    if (input.runId !== undefined) {
      requireNonEmpty(input.runId, 'runId')
    }
    return this.database.transaction(async (transaction) => {
      const batch = await this.requireBatch(transaction, input.batchId)
      assertBatchCanResume(batch)
      const selectedRows = await transaction<FetchTaskRow>('fetch_task')
        .whereIn('id', uniqueTaskIds)
        .select('*')
      if (
        selectedRows.length !== uniqueTaskIds.length ||
        selectedRows.some((row) => row.batch_id !== input.batchId || row.status !== 'failed')
      ) {
        throw new FetchTaskRepositoryError(
          '部分任务不存在、不是失败状态或不属于指定抓取批次',
        )
      }
      const now = this.now()
      const rows = await transaction<FetchTaskRow>('fetch_task')
        .where('batch_id', input.batchId)
        .where('status', 'failed')
        .whereIn('id', uniqueTaskIds)
        .update({
          status: 'pending',
          cache_hits: 0,
          claimed_by_run_id: null,
          last_error_json: null,
          started_at: null,
          finished_at: null,
          updated_at: now,
        })
        .returning('*')
      if (input.runId !== undefined) {
        await transaction<FetchBatchRow>('fetch_batch').where('id', input.batchId).update({
          active_run_id: input.runId,
          status: 'running',
          finished_at: null,
          updated_at: now,
        })
      }
      await this.refreshAffectedAggregates(transaction, rows, now)
      if (rows.length === 0) {
        await this.refreshBatchStatus(transaction, input.batchId, now)
      }
      return { resetTaskIds: rows.map(({ id }) => id) }
    })
  }

  private async completeTask(
    taskId: string,
    status: Extract<FetchTaskStatus, 'succeeded' | 'failed'>,
    values: Partial<FetchTaskRow>,
  ): Promise<FetchTaskDto> {
    return this.database.transaction(async (transaction) => {
      const now = this.now()
      const rows = await transaction<FetchTaskRow>('fetch_task')
        .where({ id: taskId, status: 'running' })
        .update({
          ...values,
          status,
          finished_at: now,
          updated_at: now,
        })
        .returning('*')
      const row = rows[0]
      if (row === undefined) {
        const existing = await transaction<FetchTaskRow>('fetch_task').where('id', taskId).first()
        if (existing === undefined) {
          throw new FetchTaskRepositoryError(`抓取任务不存在：${taskId}`)
        }
        throw new FetchTaskRepositoryError(`任务 ${taskId} 当前状态为 ${existing.status}，不能标记为 ${status}`)
      }
      await this.refreshTargetStatus(transaction, row.target_id, now)
      await this.refreshBatchStatus(transaction, row.batch_id, now)
      return mapTask(row)
    })
  }

  private async refreshAffectedAggregates(
    transaction: Knex.Transaction,
    taskRows: FetchTaskRow[],
    now: number,
  ): Promise<void> {
    const targetIdSet = new Set(taskRows.map(({ target_id }) => target_id))
    const batchIdSet = new Set(taskRows.map(({ batch_id }) => batch_id))
    for (const targetId of targetIdSet) {
      await this.refreshTargetStatus(transaction, targetId, now)
    }
    for (const batchId of batchIdSet) {
      await this.refreshBatchStatus(transaction, batchId, now)
    }
  }

  private async refreshTargetStatus(
    transaction: Knex.Transaction,
    targetId: string,
    now: number,
  ): Promise<FetchBatchStatus> {
    const rows = (await transaction('fetch_task')
      .select('status')
      .count({ count: '*' })
      .sum({ cache_hits: 'cache_hits' })
      .where('target_id', targetId)
      .groupBy('status')) as StatusCountRow[]
    const status = aggregateTaskCounts(countsFromRows(rows))
    const isFinished = isTerminalAggregateStatus(status)
    await transaction<FetchTargetRow>('fetch_target')
      .where('id', targetId)
      .update({
        status,
        started_at:
          status === 'running' ? transaction.raw('COALESCE(started_at, ?)', [now]) : transaction.raw('started_at'),
        finished_at: isFinished ? transaction.raw('COALESCE(finished_at, ?)', [now]) : null,
        updated_at: now,
      })
    return status
  }

  private async refreshBatchStatus(
    transaction: Knex.Transaction | Knex,
    batchId: string,
    now: number,
  ): Promise<FetchBatchStatus> {
    const targetRows = await transaction<Pick<FetchTargetRow, 'status'>>('fetch_target')
      .select('status')
      .where('batch_id', batchId)
    const status = aggregateStatuses(targetRows.map(({ status: targetStatus }) => targetStatus))
    await transaction<FetchBatchRow>('fetch_batch').where('id', batchId).update({ status, updated_at: now })
    return status
  }

  private async requireBatch(transaction: Knex | Knex.Transaction, batchId: string): Promise<FetchBatchRow> {
    const row = await transaction<FetchBatchRow>('fetch_batch').where('id', batchId).first()
    if (row === undefined) {
      throw new FetchTaskRepositoryError(`抓取批次不存在：${batchId}`)
    }
    return row
  }

  private async requireTarget(transaction: Knex | Knex.Transaction, targetId: string): Promise<FetchTargetRow> {
    const row = await transaction<FetchTargetRow>('fetch_target').where('id', targetId).first()
    if (row === undefined) {
      throw new FetchTaskRepositoryError(`抓取目标不存在：${targetId}`)
    }
    return row
  }

  private async requireTask(transaction: Knex | Knex.Transaction, taskId: string): Promise<FetchTaskRow> {
    const row = await transaction<FetchTaskRow>('fetch_task').where('id', taskId).first()
    if (row === undefined) {
      throw new FetchTaskRepositoryError(`抓取任务不存在：${taskId}`)
    }
    return row
  }

  private async listDescendantTaskRows(
    transaction: Knex.Transaction,
    rootTaskId: string,
  ): Promise<FetchTaskRow[][]> {
    const result: FetchTaskRow[][] = []
    const visitedTaskIdSet = new Set([rootTaskId])
    let parentTaskIdList = [rootTaskId]
    while (parentTaskIdList.length > 0) {
      const rows = await transaction<FetchTaskRow>('fetch_task')
        .whereIn('parent_task_id', parentTaskIdList)
        .select('*')
      if (rows.length === 0) break
      for (const row of rows) {
        if (visitedTaskIdSet.has(row.id)) {
          throw new FetchTaskRepositoryError('抓取任务层级包含循环引用')
        }
        visitedTaskIdSet.add(row.id)
      }
      result.push(rows)
      parentTaskIdList = rows.map(({ id }) => id)
    }
    return result
  }
}

function mapBatch(row: FetchBatchRow): FetchBatchDto {
  return {
    id: row.id,
    createdRunId: row.created_run_id,
    activeRunId: row.active_run_id,
    phase: row.phase,
    status: row.status,
    config: parseJson(row.config_json),
    loginUid: row.login_uid,
    cacheReadMode: row.cache_read_mode,
    requestIntervalSeconds: Number(row.request_interval_seconds),
    fetchStartAt: Number(row.fetch_start_at),
    fetchEndAt: Number(row.fetch_end_at),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    startedAt: nullableNumber(row.started_at),
    finishedAt: nullableNumber(row.finished_at),
  }
}

function mapTarget(row: FetchTargetRow): FetchTargetDto {
  return {
    id: row.id,
    batchId: row.batch_id,
    targetUid: row.target_uid,
    sequence: Number(row.sequence),
    status: row.status,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    startedAt: nullableNumber(row.started_at),
    finishedAt: nullableNumber(row.finished_at),
  }
}

function mapTask(row: FetchTaskRow): FetchTaskDto {
  return {
    id: row.id,
    batchId: row.batch_id,
    targetId: row.target_id,
    parentTaskId: row.parent_task_id,
    taskType: row.task_type,
    rangeStartAt: Number(row.range_start_at),
    rangeEndAt: Number(row.range_end_at),
    pageNo: Number(row.page_no),
    sequence: Number(row.sequence),
    status: row.status,
    attemptCount: Number(row.attempt_count),
    totalCount: nullableNumber(row.total_count),
    cacheHits: Number(row.cache_hits),
    claimedByRunId: row.claimed_by_run_id,
    lastError: row.last_error_json === null ? null : (parseJson(row.last_error_json) as FetchTaskFailure),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    startedAt: nullableNumber(row.started_at),
    finishedAt: nullableNumber(row.finished_at),
  }
}

function emptyCounts(): FetchTaskCounts {
  return {
    total: 0,
    completed: 0,
    cacheHits: 0,
    pending: 0,
    running: 0,
    succeeded: 0,
    failed: 0,
  }
}

function countsFromRows(rows: StatusCountRow[]): FetchTaskCounts {
  const counts = emptyCounts()
  for (const row of rows) {
    counts[row.status] += Number(row.count)
    counts.cacheHits += Number(row.cache_hits ?? 0)
  }
  counts.total = counts.pending + counts.running + counts.succeeded + counts.failed
  counts.completed = counts.succeeded + counts.failed
  return counts
}

function addCounts(countList: FetchTaskCounts[]): FetchTaskCounts {
  const result = emptyCounts()
  for (const counts of countList) {
    result.pending += counts.pending
    result.running += counts.running
    result.succeeded += counts.succeeded
    result.failed += counts.failed
    result.cacheHits += counts.cacheHits
  }
  result.total = result.pending + result.running + result.succeeded + result.failed
  result.completed = result.succeeded + result.failed
  return result
}

function aggregateTaskCounts(counts: FetchTaskCounts): FetchBatchStatus {
  if (counts.total === 0) {
    return 'pending'
  }
  if (counts.running > 0) {
    return 'running'
  }
  if (counts.pending > 0) {
    return counts.pending === counts.total ? 'pending' : 'running'
  }
  if (counts.succeeded > 0 && counts.failed > 0) {
    return 'partial_success'
  }
  return counts.failed > 0 ? 'failed' : 'succeeded'
}

function aggregateStatuses(statusList: FetchBatchStatus[]): FetchBatchStatus {
  if (statusList.length === 0) {
    return 'pending'
  }
  const pendingCount = statusList.filter((status) => status === 'pending').length
  const runningCount = statusList.filter((status) => status === 'running').length
  const succeededCount = statusList.filter((status) => status === 'succeeded').length
  const partialCount = statusList.filter((status) => status === 'partial_success').length
  const failedCount = statusList.filter((status) => status === 'failed').length
  if (runningCount > 0) {
    return 'running'
  }
  if (pendingCount > 0) {
    return pendingCount === statusList.length ? 'pending' : 'running'
  }
  if (partialCount > 0 || (succeededCount > 0 && failedCount > 0)) {
    return 'partial_success'
  }
  if (failedCount > 0) {
    return 'failed'
  }
  return 'succeeded'
}

function isTerminalAggregateStatus(status: FetchBatchStatus): boolean {
  return status === 'succeeded' || status === 'partial_success' || status === 'failed'
}

function validateCreateTaskInput(input: CreateFetchTaskInput): void {
  requireNonEmpty(input.batchId, 'batchId')
  requireNonEmpty(input.targetId, 'targetId')
  requireOneOf(input.taskType, FETCH_TASK_TYPE_LIST, 'taskType')
  requireEpoch(input.rangeStartAt, 'rangeStartAt')
  requireEpoch(input.rangeEndAt, 'rangeEndAt')
  if (input.rangeEndAt < input.rangeStartAt) {
    throw new FetchTaskRepositoryError('rangeEndAt不能小于rangeStartAt')
  }
  requireNonNegativeInteger(input.sequence ?? 0, 'sequence')
  if (input.taskType === 'page') {
    requirePositiveInteger(input.pageNo, 'pageNo')
  } else if (input.pageNo !== undefined && input.pageNo !== 0) {
    throw new FetchTaskRepositoryError('探测任务的pageNo必须为0或省略')
  }
}

function childTaskTypeFor(taskType: FetchTaskType): FetchTaskType | null {
  switch (taskType) {
    case 'year_probe': return 'month_probe'
    case 'month_probe': return 'segment_probe'
    case 'segment_probe': return 'page'
    case 'page': return null
  }
}

function isPristinePendingTask(row: FetchTaskRow): boolean {
  return row.status === 'pending' &&
    row.attempt_count === 0 &&
    row.total_count === null &&
    row.cache_hits === 0 &&
    row.claimed_by_run_id === null &&
    row.last_error_json === null &&
    row.started_at === null &&
    row.finished_at === null
}

function assertBatchCanResume(batch: FetchBatchRow): void {
  if (batch.status === 'succeeded') {
    throw new FetchTaskRepositoryError(`成功批次 ${batch.id} 不能继续或重试`)
  }
}

function validateFailure(error: FetchTaskFailure): void {
  requireNonEmpty(error.code, 'error.code')
  requireNonEmpty(error.message, 'error.message')
  if (typeof error.retryable !== 'boolean') {
    throw new FetchTaskRepositoryError('error.retryable必须是布尔值')
  }
}

function requireNonEmpty(value: string, label: string): void {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new FetchTaskRepositoryError(`${label}必须是非空字符串`)
  }
}

function requireEpoch(value: number, label: string): void {
  requireNonNegativeInteger(value, label)
  if (Number.isSafeInteger(value) === false) {
    throw new FetchTaskRepositoryError(`${label}必须是安全整数`)
  }
}

function requireNonNegativeInteger(value: number | undefined, label: string): asserts value is number {
  if (typeof value !== 'number' || Number.isInteger(value) === false || value < 0) {
    throw new FetchTaskRepositoryError(`${label}必须是非负整数`)
  }
}

function requirePositiveInteger(value: number | undefined, label: string): asserts value is number {
  if (typeof value !== 'number' || Number.isInteger(value) === false || value < 1) {
    throw new FetchTaskRepositoryError(`${label}必须是正整数`)
  }
}

function requirePositiveFinite(value: number, label: string): void {
  if (typeof value !== 'number' || Number.isFinite(value) === false || value <= 0) {
    throw new FetchTaskRepositoryError(`${label}必须是正数`)
  }
}

function requireOneOf<T extends string>(value: T, choices: readonly T[], label: string): void {
  if (choices.includes(value) === false) {
    throw new FetchTaskRepositoryError(`${label}必须是 ${choices.join('、')} 之一`)
  }
}

function serializeJson(value: unknown, label: string): string {
  try {
    const result = JSON.stringify(value)
    if (result === undefined) {
      throw new Error('value is undefined')
    }
    return result
  } catch (error) {
    throw new FetchTaskRepositoryError(`${label}无法序列化为JSON：${String(error)}`)
  }
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

function nullableNumber(value: number | null): number | null {
  return value === null || value === undefined ? null : Number(value)
}
