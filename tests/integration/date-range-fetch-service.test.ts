import type { Knex } from 'knex'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { WeiboApiClientError } from '../../src/api/weibo_api_client.js'
import { createFetchBatch } from '../../src/application/fetch/fetch_batch_factory.js'
import {
  createFetchDatabaseClient,
  ensureFetchDatabaseSchema,
} from '../../src/application/fetch/fetch_database_schema.js'
import DateRangeFetchService, {
  type DateRangeFetchServiceOptions,
} from '../../src/application/fetch/date_range_fetch_service.js'
import {
  parseProfileInfoResponse,
  parseSearchProfileResponse,
} from '../../src/application/fetch/weibo_api_schema.js'
import FetchTaskRepository from '../../src/model/fetch_task_repository.js'
import {
  CacheReadMode,
  ImageQuality,
  PostOrder,
  type CustomerTaskConfig,
  VolumeSplit,
} from '../../src/shared/config/task_config.js'
import { createTestSandbox, type TestSandbox } from '../helpers/sandbox.js'

const TARGET_UID = '1000000001'

describe('date range fetch service persistence flow', () => {
  let sandbox: TestSandbox
  let database: Knex
  let repository: FetchTaskRepository

  beforeEach(async () => {
    sandbox = createTestSandbox('date-range-fetch-service')
    database = createFetchDatabaseClient(sandbox.databasePath)
    await ensureFetchDatabaseSchema(database)
    repository = new FetchTaskRepository(database)
  })

  afterEach(async () => {
    await database.destroy()
    sandbox.cleanup()
  })

  it('persists a partial page failure and cache hits, then resumes only the failed page', async () => {
    const config = createConfig()
    const created = await createFetchBatch({
      repository,
      config,
      loginUid: '9000000001',
      runId: 'run-initial',
      batchId: 'batch-integration',
      startedAtMs: Date.parse('2024-01-02T00:00:00+08:00'),
    })
    const fakeApi = createFakeApi()

    const initial = await new DateRangeFetchService({
      database,
      repository,
      apiClient: fakeApi.client,
      batch: created.batch,
      config,
      runId: 'run-initial',
    }).execute()

    expect(initial).toMatchObject({
      batchId: 'batch-integration',
      savedMblogCount: 1,
      cacheHits: 3,
    })
    expect(initial.failures).toHaveLength(1)
    expect(initial.failures[0]).toMatchObject({ taskType: 'page', entityType: 'fetch_task' })

    let dashboard = await repository.getDashboard(created.batch.id)
    expect(dashboard.taskCounts).toMatchObject({
      total: 5,
      pending: 0,
      running: 0,
      succeeded: 4,
      failed: 1,
      cacheHits: 3,
    })
    expect(dashboard.targets[0].target.status).toBe('partial_success')
    expect(await database('total_mblog').count<{ count: number }>({ count: '*' }).first())
      .toMatchObject({ count: 1 })

    const partialBatch = await repository.finishBatch({ batchId: created.batch.id })
    expect(partialBatch).toMatchObject({ phase: 'done', status: 'partial_success' })

    const resumed = await repository.resumeBatch({
      batchId: created.batch.id,
      runId: 'run-resume',
    })
    expect(resumed.resetTaskIds).toHaveLength(1)

    const resumedBatch = await repository.getBatch(created.batch.id)
    const secondRun = await new DateRangeFetchService({
      database,
      repository,
      apiClient: fakeApi.client,
      batch: resumedBatch,
      config,
      runId: 'run-resume',
    }).execute()
    expect(secondRun).toMatchObject({ savedMblogCount: 1, cacheHits: 1, failures: [] })

    const succeededBatch = await repository.finishBatch({ batchId: created.batch.id })
    expect(succeededBatch).toMatchObject({ phase: 'done', status: 'succeeded' })
    dashboard = await repository.getDashboard(created.batch.id)
    expect(dashboard.taskCounts).toMatchObject({
      total: 5,
      pending: 0,
      running: 0,
      succeeded: 5,
      failed: 0,
      cacheHits: 4,
    })
    const pageTasks = await repository.listTasks(created.batch.id, { taskTypes: ['page'] })
    expect(pageTasks.map(({ pageNo, attemptCount, status }) => ({ pageNo, attemptCount, status })))
      .toEqual([
        { pageNo: 1, attemptCount: 1, status: 'succeeded' },
        { pageNo: 2, attemptCount: 2, status: 'succeeded' },
      ])
    expect(await database('total_mblog').count<{ count: number }>({ count: '*' }).first())
      .toMatchObject({ count: 2 })
    expect(fakeApi.searchCalls).toHaveLength(6)
    expect(fakeApi.searchCalls.every(({ cache }) => cache?.mode === 'prefer-cache')).toBe(true)
  })

  it('completes planned roots without API access when fetching is skipped', async () => {
    const config = { ...createConfig(), isSkipFetch: true }
    const created = await createFetchBatch({
      repository,
      config,
      loginUid: '9000000001',
      runId: 'run-skip',
      batchId: 'batch-skip',
      startedAtMs: Date.parse('2024-01-02T00:00:00+08:00'),
    })
    let apiCallCount = 0
    const noNetworkClient = new Proxy({}, {
      get() {
        return async () => {
          apiCallCount += 1
          throw new Error('skip-fetch must not call the API')
        }
      },
    }) as DateRangeFetchServiceOptions['apiClient']

    const result = await new DateRangeFetchService({
      database,
      repository,
      apiClient: noNetworkClient,
      batch: created.batch,
      config,
      runId: 'run-skip',
    }).execute()

    expect(result).toMatchObject({ savedMblogCount: 0, cacheHits: 0, failures: [] })
    expect(apiCallCount).toBe(0)
    const dashboard = await repository.getDashboard(created.batch.id)
    expect(dashboard.taskCounts).toMatchObject({
      total: 1,
      pending: 0,
      running: 0,
      succeeded: 1,
      failed: 0,
    })
    expect(dashboard.targets[0].target.status).toBe('succeeded')
    expect(await repository.finishBatch({ batchId: created.batch.id })).toMatchObject({
      phase: 'done',
      status: 'succeeded',
    })
  })

  it('treats one target profile failure as partial and still processes later users', async () => {
    const uidList = ['1000000001', '1000000002', '1000000003']
    const config = createConfig()
    config.configList = uidList.map((uid) => ({ uid, rawInputText: uid, comment: '' }))
    const created = await createFetchBatch({
      repository,
      config,
      loginUid: '9000000001',
      runId: 'run-profile-partial',
      batchId: 'batch-profile-partial',
      startedAtMs: Date.parse('2024-01-02T00:00:00+08:00'),
    })
    const profileCalls: string[] = []
    const searchCalls: string[] = []
    const client = {
      async getProfileInfo(uid: string) {
        profileCalls.push(uid)
        if (uid === uidList[1]) throw new Error('fixture target profile unavailable')
        return { data: createProfileResponse(uid), source: 'network' as const }
      },
      async searchProfile(options: { targetUid: string }) {
        searchCalls.push(options.targetUid)
        return { data: createEmptySearchResponse(), source: 'network' as const }
      },
      async getLongText() {
        throw new Error('long text should not be requested')
      },
      async getArticle() {
        throw new Error('article should not be requested')
      },
    } as unknown as DateRangeFetchServiceOptions['apiClient']

    const result = await new DateRangeFetchService({
      database,
      repository,
      apiClient: client,
      batch: created.batch,
      config,
      runId: 'run-profile-partial',
    }).execute()

    expect(profileCalls).toEqual(uidList)
    expect(searchCalls).toEqual([uidList[0], uidList[2]])
    expect(result.failures).toHaveLength(1)
    expect(result.failures[0]).toMatchObject({
      taskType: 'profile',
      entityType: 'fetch_target',
    })
    const dashboard = await repository.getDashboard(created.batch.id)
    expect(dashboard.taskCounts).toMatchObject({
      total: 3,
      pending: 0,
      running: 0,
      succeeded: 2,
      failed: 1,
    })
    expect(dashboard.targets.map(({ target }) => target.status))
      .toEqual(['succeeded', 'failed', 'succeeded'])
  })

  it.each(['profile', 'search', 'longtext'] as const)(
    'propagates %s authentication expiry as a global failure',
    async (failureAt) => {
      const config = createConfig()
      const created = await createFetchBatch({
        repository,
        config,
        loginUid: '9000000001',
        runId: `run-auth-${failureAt}`,
        batchId: `batch-auth-${failureAt}`,
        startedAtMs: Date.parse('2024-01-02T00:00:00+08:00'),
      })
      const authenticationError = () => new WeiboApiClientError({
        kind: 'authentication',
        endpoint: `/fixture/${failureAt}`,
        message: 'fixture login expired',
        statusCode: 401,
      })
      const client = {
        async getProfileInfo(uid: string) {
          if (failureAt === 'profile') throw authenticationError()
          return { data: createProfileResponse(uid), source: 'network' as const }
        },
        async searchProfile() {
          if (failureAt === 'search') throw authenticationError()
          return {
            data: createSearchResponse(1, '9', failureAt === 'longtext'),
            source: 'network' as const,
          }
        },
        async getLongText() {
          throw authenticationError()
        },
        async getArticle() {
          throw new Error('article should not be requested')
        },
      } as unknown as DateRangeFetchServiceOptions['apiClient']

      const error = await new DateRangeFetchService({
        database,
        repository,
        apiClient: client,
        batch: created.batch,
        config,
        runId: `run-auth-${failureAt}`,
      }).execute().catch((caught) => caught)
      expect(error).toMatchObject({
        retryable: false,
        cause: { kind: 'authentication' },
      })
    },
  )
})

function createConfig(): CustomerTaskConfig {
  return {
    configList: [{ uid: TARGET_UID, rawInputText: TARGET_UID, comment: '' }],
    imageQuilty: ImageQuality.DEFAULT,
    bookTitle: 'integration',
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

function createFakeApi(): {
  client: DateRangeFetchServiceOptions['apiClient']
  searchCalls: Array<{
    page: number
    cache?: { mode: 'prefer-cache' | 'refresh' }
  }>
} {
  const profile = parseProfileInfoResponse({
    ok: 1,
    data: {
      user: {
        id: TARGET_UID,
        idstr: TARGET_UID,
        screen_name: 'fixture-user',
        profile_image_url: 'https://example.invalid/avatar.jpg',
        profile_url: `/u/${TARGET_UID}`,
      },
    },
  })
  const searchCalls: Array<{
    page: number
    cache?: { mode: 'prefer-cache' | 'refresh' }
  }> = []
  let pageTwoFailed = false
  const client = {
    async getProfileInfo() {
      return { data: profile, source: 'network' as const }
    },
    async searchProfile(options: {
      page: number
      cache?: { mode: 'prefer-cache' | 'refresh' }
    }) {
      searchCalls.push(options)
      const callNumber = searchCalls.length
      if (options.page === 2 && pageTwoFailed === false) {
        pageTwoFailed = true
        throw new Error('fixture page 2 network failure')
      }
      const isSegmentOrPage = callNumber >= 3
      const itemSuffix = options.page === 2 ? '2' : '1'
      return {
        data: createSearchResponse(isSegmentOrPage ? 51 : 1, itemSuffix),
        source: callNumber === 2 ? 'network' as const : 'cache' as const,
      }
    },
    async getLongText() {
      throw new Error('long text should not be requested by this fixture')
    },
    async getArticle() {
      throw new Error('article should not be requested by this fixture')
    },
  } as unknown as DateRangeFetchServiceOptions['apiClient']
  return { client, searchCalls }
}

function createProfileResponse(uid: string) {
  return parseProfileInfoResponse({
    ok: 1,
    data: {
      user: {
        id: uid,
        idstr: uid,
        screen_name: `fixture-user-${uid}`,
        profile_image_url: 'https://example.invalid/avatar.jpg',
        profile_url: `/u/${uid}`,
      },
    },
  })
}

function createEmptySearchResponse() {
  return parseSearchProfileResponse({ ok: 1, data: { total: 0, list: [] } })
}

function createSearchResponse(total: number, itemSuffix: string, isLongText = false) {
  const id = `500000000000000${itemSuffix}`
  return parseSearchProfileResponse({
    ok: 1,
    data: {
      total,
      list: [{
        created_at: 'Mon Jan 01 12:00:00 +0800 2024',
        id,
        idstr: id,
        mid: id,
        mblogid: `fixture-${itemSuffix}`,
        text: `fixture page ${itemSuffix}`,
        text_raw: `fixture page ${itemSuffix}`,
        pic_ids: [],
        user: {
          id: TARGET_UID,
          idstr: TARGET_UID,
          screen_name: 'fixture-user',
          profile_image_url: 'https://example.invalid/avatar.jpg',
          profile_url: `/u/${TARGET_UID}`,
        },
        isLongText,
      }],
    },
  })
}
