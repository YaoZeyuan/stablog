import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone.js'
import utc from 'dayjs/plugin/utc.js'
import type { Knex } from 'knex'
import type * as TypeWeibo from '~/src/type/namespace/weibo.js'
import WeiboApiClient, {
  isWeiboAuthenticationError,
} from '~/src/api/weibo_api_client.js'
import {
  adaptProfileInfoUser,
  adaptSearchProfileResponse,
  hydrateCanonicalMblog,
} from '~/src/application/fetch/weibo_canonical_adapter.js'
import {
  planMonthRanges,
  planPageNumbers,
  planSegmentRanges,
  WEIBO_TIME_ZONE,
} from '~/src/application/fetch/date_range_planner.js'
import FetchTaskRepository, {
  FetchBatchDto,
  FetchTaskRepositoryError,
  FetchTaskDto,
  FetchTaskType,
  FetchTargetDto,
} from '~/src/model/fetch_task_repository.js'
import {
  AppErrorCode,
  ApplicationError,
  ServiceLevel,
} from '~/src/shared/error/application_error.js'
import type { CustomerTaskConfig } from '~/src/shared/config/task_config.js'
import type { ExecutionFailure } from '~/src/shared/runtime/execution_result.js'

dayjs.extend(utc)
dayjs.extend(timezone)

export type DateRangeFetchSummary = {
  batchId: string
  savedMblogCount: number
  cacheHits: number
  failures: ExecutionFailure[]
}

export type DateRangeFetchServiceOptions = {
  database: Knex
  repository: FetchTaskRepository
  /** Omitted only when the durable task snapshot proves no network work exists. */
  apiClient?: WeiboApiClient
  batch: FetchBatchDto
  config: CustomerTaskConfig
  runId: string
}

type TaskExecutionResult = {
  savedMblogCount: number
  cacheHits: number
}

/**
 * Sequentially expands and executes the persisted year -> month -> segment ->
 * page tree. Network/schema failures stay on their task; persistence and user
 * identity failures escape as workflow failures.
 */
export default class DateRangeFetchService {
  private savedMblogCount = 0
  private cacheHits = 0
  private readonly failures: ExecutionFailure[] = []

  constructor(private readonly options: DateRangeFetchServiceOptions) {}

  async execute(): Promise<DateRangeFetchSummary> {
    await this.options.repository.setBatchPhase({
      batchId: this.options.batch.id,
      phase: 'fetching',
      runId: this.options.runId,
    })

    if (this.options.config.isSkipFetch) {
      await this.completeSkippedRootTasks()
      return this.summary()
    }

    const dashboard = await this.options.repository.getDashboard(this.options.batch.id)
    for (const targetDashboard of dashboard.targets) {
      if (targetDashboard.taskCounts.pending === 0) continue
      const target = targetDashboard.target
      if (await this.fetchAndPersistProfile(target) === false) continue
      for (const taskType of [
        'year_probe',
        'month_probe',
        'segment_probe',
        'page',
      ] as const) {
        await this.executeTargetTasks(target, taskType)
      }
    }
    return this.summary()
  }

  /**
   * A skip-fetch batch still owns the durable year roots created during
   * planning. Complete them without network access so the batch and dashboard
   * cannot remain spuriously resumable with pending work.
   */
  private async completeSkippedRootTasks(): Promise<void> {
    const dashboard = await this.options.repository.getDashboard(this.options.batch.id)
    for (const { target } of dashboard.targets) {
      while (true) {
        const task = await this.options.repository.claimNextTask({
          batchId: this.options.batch.id,
          runId: this.options.runId,
          targetId: target.id,
          taskTypes: ['year_probe'],
        })
        if (task === null) break
        await this.options.repository.markTaskSucceeded({
          taskId: task.id,
          totalCount: 0,
          cacheHits: 0,
        })
      }
    }
  }

  private async fetchAndPersistProfile(target: FetchTargetDto): Promise<boolean> {
    let user: ReturnType<typeof adaptProfileInfoUser>
    try {
      const response = await this.apiClient.getProfileInfo(target.targetUid)
      user = adaptProfileInfoUser(response.data)
    } catch (error) {
      if (isWeiboAuthenticationError(error)) {
        throw this.toFetchError(error, '微博登录会话已失效，请重新登录后继续批次', false)
      }
      const appError = this.toFetchError(error, `无法获取用户 ${target.targetUid} 的资料`, true)
      await this.failAllClaimableTasks(target, appError)
      this.failures.push({
        taskType: 'profile',
        entityType: 'fetch_target',
        entityId: target.id,
        error: appError.toJSON(),
      })
      return false
    }
    // Keep persistence outside the target-local API/schema boundary. SQLite
    // failure is a global workflow failure and must not be disguised as one
    // user's retryable profile error.
    await this.options.database('total_user')
      .insert({
        author_uid: target.targetUid,
        raw_json: JSON.stringify(user),
      })
      .onConflict('author_uid')
      .merge()
    return true
  }

  private async failAllClaimableTasks(
    target: FetchTargetDto,
    error: ApplicationError,
  ): Promise<void> {
    while (true) {
      const task = await this.options.repository.claimNextTask({
        batchId: this.options.batch.id,
        runId: this.options.runId,
        targetId: target.id,
        taskTypes: ['year_probe', 'month_probe', 'segment_probe', 'page'],
      })
      if (task === null) return
      await this.options.repository.markTaskFailed({
        taskId: task.id,
        error: this.taskFailure(error),
      })
    }
  }

  private async executeTargetTasks(
    target: FetchTargetDto,
    taskType: FetchTaskType,
  ): Promise<void> {
    while (true) {
      const task = await this.options.repository.claimNextTask({
        batchId: this.options.batch.id,
        runId: this.options.runId,
        targetId: target.id,
        taskTypes: [taskType],
      })
      if (task === null) return

      try {
        const result = task.taskType === 'page'
          ? await this.executePageTask(target, task)
          : await this.executeProbeTask(target, task)
        this.savedMblogCount += result.savedMblogCount
        this.cacheHits += result.cacheHits
      } catch (error) {
        if (this.isGlobalTaskError(error)) {
          throw this.toFetchError(
            error,
            isWeiboAuthenticationError(error)
              ? '微博登录会话已失效，请重新登录后继续批次'
              : `抓取 ${target.targetUid} 时发生全局任务或数据库错误`,
            false,
          )
        }
        const appError = this.toFetchError(
          error,
          `抓取 ${target.targetUid} 的 ${task.taskType} 任务失败`,
          true,
        )
        await this.options.repository.markTaskFailed({
          taskId: task.id,
          error: this.taskFailure(appError),
        })
        this.failures.push({
          taskType: task.taskType,
          entityType: 'fetch_task',
          entityId: task.id,
          error: appError.toJSON(),
        })
      }
    }
  }

  private async executeProbeTask(
    target: FetchTargetDto,
    task: FetchTaskDto,
  ): Promise<TaskExecutionResult> {
    const response = await this.apiClient.searchProfile({
      targetUid: target.targetUid,
      page: 1,
      startAt: task.rangeStartAt,
      endAt: task.rangeEndAt,
      cache: this.cacheContext(task),
    })
    const total = response.data.data.total
    const cacheHits = response.source === 'cache' ? 1 : 0
    let childTasks
    try {
      childTasks = this.createChildTasks(task, total)
    } catch (error) {
      throw new ApplicationError({
        code: AppErrorCode.FETCH_FAILED,
        message: '日期任务树规划失败',
        serviceLevel: ServiceLevel.S0,
        stage: 'planning',
        retryable: false,
        cause: error,
      })
    }
    await this.options.repository.completeProbeTask({
      taskId: task.id,
      totalCount: total,
      cacheHits,
      childTasks,
    })
    return { savedMblogCount: 0, cacheHits }
  }

  private createChildTasks(task: FetchTaskDto, total: number) {
    if (total === 0) return []
    const parentRange = {
      startDate: formatShanghaiDate(task.rangeStartAt),
      endDate: formatShanghaiDate(task.rangeEndAt),
    }
    if (task.taskType === 'year_probe') {
      return planMonthRanges(parentRange).map((range, index) => ({
        batchId: task.batchId,
        targetId: task.targetId,
        parentTaskId: task.id,
        taskType: 'month_probe' as const,
        rangeStartAt: range.startAt,
        rangeEndAt: range.endAt,
        sequence: index,
      }))
    }
    if (task.taskType === 'month_probe') {
      return planSegmentRanges(parentRange).map((range, index) => ({
        batchId: task.batchId,
        targetId: task.targetId,
        parentTaskId: task.id,
        taskType: 'segment_probe' as const,
        rangeStartAt: range.startAt,
        rangeEndAt: range.endAt,
        sequence: index,
      }))
    }
    if (task.taskType === 'segment_probe') {
      return planPageNumbers(total).map((pageNo) => ({
        batchId: task.batchId,
        targetId: task.targetId,
        parentTaskId: task.id,
        taskType: 'page' as const,
        rangeStartAt: task.rangeStartAt,
        rangeEndAt: task.rangeEndAt,
        pageNo,
        sequence: pageNo,
      }))
    }
    return []
  }

  private async executePageTask(
    target: FetchTargetDto,
    task: FetchTaskDto,
  ): Promise<TaskExecutionResult> {
    const response = await this.apiClient.searchProfile({
      targetUid: target.targetUid,
      page: task.pageNo,
      startAt: task.rangeStartAt,
      endAt: task.rangeEndAt,
      cache: this.cacheContext(task),
    })
    let cacheHits = response.source === 'cache' ? 1 : 0
    const adapted = adaptSearchProfileResponse(response.data)
    const hydrated: TypeWeibo.TypeMblog[] = []
    for (const mblog of adapted) {
      hydrated.push(await hydrateCanonicalMblog(mblog, {
        getLongText: async (mblogId) => {
          const detail = await this.apiClient.getLongText({
            targetUid: target.targetUid,
            mblogId,
            cache: this.cacheContext(task),
          })
          if (detail.source === 'cache') cacheHits += 1
          return detail.data
        },
        getArticle: async (articleId) => {
          const detail = await this.apiClient.getArticle({
            targetUid: target.targetUid,
            articleId,
            cache: this.cacheContext(task),
          })
          if (detail.source === 'cache') cacheHits += 1
          return detail.data
        },
      }))
    }

    await this.options.database.transaction(async (transaction) => {
      for (const mblog of hydrated) {
        await transaction('total_mblog')
          .insert({
            id: String(mblog.id),
            author_uid: target.targetUid,
            post_publish_at: mblog.created_timestamp_at,
            is_retweet: mblog.retweeted_status === undefined ? 0 : 1,
            is_article: mblog.article === undefined ? 0 : 1,
            raw_json: JSON.stringify(mblog),
          })
          .onConflict('id')
          .merge()
      }
      const transactionRepository = new FetchTaskRepository(transaction)
      await transactionRepository.markTaskSucceeded({
        taskId: task.id,
        totalCount: response.data.data.total,
        cacheHits,
      })
    })
    return { savedMblogCount: hydrated.length, cacheHits }
  }

  private cacheContext(task: FetchTaskDto) {
    return {
      mode: this.options.batch.cacheReadMode === 'prefer_cache'
        ? 'prefer-cache' as const
        : 'refresh' as const,
      batchStartedAtMs: this.options.batch.createdAt,
      rangeEndAt: task.rangeEndAt,
    }
  }

  private toFetchError(error: unknown, message: string, retryable: boolean): ApplicationError {
    return ApplicationError.from(error, {
      code: AppErrorCode.FETCH_FAILED,
      message,
      serviceLevel: ServiceLevel.S1,
      stage: 'fetch',
      retryable,
    })
  }

  private isGlobalTaskError(error: unknown): boolean {
    if (isWeiboAuthenticationError(error) || error instanceof FetchTaskRepositoryError) {
      return true
    }
    if (error instanceof ApplicationError && error.retryable === false) {
      return true
    }
    if (error !== null && typeof error === 'object') {
      const code = (error as { code?: unknown }).code
      if (typeof code === 'string' && /^(?:SQLITE_|KNEX_)/.test(code)) return true
    }
    return false
  }

  private taskFailure(error: ApplicationError) {
    return {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
    }
  }

  private get apiClient(): WeiboApiClient {
    if (this.options.apiClient === undefined) {
      throw new ApplicationError({
        code: AppErrorCode.FETCH_FAILED,
        message: '存在待抓取任务，但未提供微博 API 客户端',
        serviceLevel: ServiceLevel.S0,
        stage: 'fetch',
        retryable: false,
      })
    }
    return this.options.apiClient
  }

  private summary(): DateRangeFetchSummary {
    return {
      batchId: this.options.batch.id,
      savedMblogCount: this.savedMblogCount,
      cacheHits: this.cacheHits,
      failures: [...this.failures],
    }
  }
}

function formatShanghaiDate(epochSeconds: number): string {
  return dayjs.unix(epochSeconds).tz(WEIBO_TIME_ZONE).format('YYYY-MM-DD')
}
