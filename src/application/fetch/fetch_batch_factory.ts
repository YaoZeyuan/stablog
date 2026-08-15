import {
  createFetchDateRange,
  planYearRanges,
} from '~/src/application/fetch/date_range_planner.js'
import FetchTaskRepository, {
  FetchBatchDto,
  FetchTargetDto,
} from '~/src/model/fetch_task_repository.js'
import {
  CacheReadMode,
  CustomerTaskConfig,
} from '~/src/shared/config/task_config.js'

export type CreatedFetchBatch = {
  batch: FetchBatchDto
  targets: FetchTargetDto[]
}

/** Create the durable batch, ordered targets and initial year probes. */
export async function createFetchBatch(options: {
  repository: FetchTaskRepository
  config: CustomerTaskConfig
  loginUid: string
  runId: string
  batchId?: string
  startedAtMs?: number
}): Promise<CreatedFetchBatch> {
  return options.repository.runInTransaction((repository) => createFetchBatchAtomically({
    ...options,
    repository,
  }))
}

async function createFetchBatchAtomically(options: {
  repository: FetchTaskRepository
  config: CustomerTaskConfig
  loginUid: string
  runId: string
  batchId?: string
  startedAtMs?: number
}): Promise<CreatedFetchBatch> {
  const range = createFetchDateRange({
    startDate: options.config.fetchStartDate,
    endDate: options.config.fetchEndDate,
    startedAtMs: options.startedAtMs,
  })
  const batch = await options.repository.createBatch({
    id: options.batchId,
    runId: options.runId,
    config: options.config,
    loginUid: options.loginUid,
    cacheReadMode: options.config.cacheReadMode === CacheReadMode.PREFER_CACHE
      ? 'prefer_cache'
      : 'bypass_cache',
    requestIntervalSeconds: options.config.requestIntervalSeconds,
    fetchStartAt: range.startAt,
    fetchEndAt: range.endAt,
  })

  const yearRanges = planYearRanges(range)
  const targets: FetchTargetDto[] = []
  for (const [targetIndex, taskConfig] of options.config.configList.entries()) {
    const target = await options.repository.createTarget({
      batchId: batch.id,
      targetUid: taskConfig.uid,
      sequence: targetIndex,
    })
    targets.push(target)
    await options.repository.createTasks(yearRanges.map((yearRange, yearIndex) => ({
      batchId: batch.id,
      targetId: target.id,
      taskType: 'year_probe' as const,
      rangeStartAt: yearRange.startAt,
      rangeEndAt: yearRange.endAt,
      sequence: yearIndex,
    })))
  }
  return { batch, targets }
}
