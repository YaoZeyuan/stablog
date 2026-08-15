import fs from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'
import WeiboApiClient, {
  ARTICLE_DETAIL_ENDPOINT,
  LEGACY_ARTICLE_DETAIL_ENDPOINT,
  LOGIN_CONFIG_ENDPOINT,
  LONG_TEXT_ENDPOINT,
  PROFILE_INFO_ENDPOINT,
  resolveWeiboLoginUid,
  SEARCH_PROFILE_ENDPOINT,
  WeiboApiClientError,
  WeiboTransport,
  WeiboTransportRequest,
} from '../../src/api/weibo_api_client.js'
import { WeiboRequestLimiter } from '../../src/application/fetch/weibo_request_limiter.js'
import { WeiboResponseCache } from '../../src/application/fetch/weibo_response_cache.js'
import { createTestSandbox, TestSandbox } from '../helpers/sandbox.js'

function fixture(name: string): unknown {
  return JSON.parse(
    fs.readFileSync(new URL(`../fixtures/weibo/${name}`, import.meta.url), 'utf8'),
  )
}

class QueueTransport implements WeiboTransport {
  readonly requests: WeiboTransportRequest[] = []

  constructor(private readonly responses: unknown[]) {}

  async get(request: WeiboTransportRequest): Promise<unknown> {
    this.requests.push(request)
    if (this.responses.length === 0) throw new Error('fixture response queue exhausted')
    const response = this.responses.shift()
    if (response instanceof Error) throw response
    return response
  }
}

function immediateLimiter(): WeiboRequestLimiter {
  return new WeiboRequestLimiter({
    intervalMs: 0,
    minimumIntervalMs: 0,
  })
}

describe('微博接口客户端', () => {
  let sandbox: TestSandbox | undefined

  afterEach(() => {
    sandbox?.cleanup()
    sandbox = undefined
  })

  it('通过同一可注入传输层发起用户资料、检索、长文与文章请求', async () => {
    sandbox = createTestSandbox('weibo-api-client')
    const transport = new QueueTransport([
      fixture('profile-info.redacted.json'),
      fixture('search-profile.redacted.json'),
      fixture('longtext-plain.redacted.json'),
      fixture('article-current.redacted.json'),
      fixture('article-legacy.redacted.json'),
    ])
    const client = new WeiboApiClient({
      cookie: 'SUB=redacted; XSRF-TOKEN=fixture%2Dxsrf',
      loginUid: '1000000009',
      userAgent: 'fixture-agent',
      now: () => 1_700_000_000_000,
      transport,
      limiter: immediateLimiter(),
      cache: new WeiboResponseCache(sandbox.cachePath),
    })

    expect((await client.getProfileInfo('1000000001')).data.data.user.idstr)
      .toBe('1000000001')
    expect((await client.searchProfile({
      targetUid: '1000000001',
      page: 1,
      startAt: 1483200000,
      endAt: 1485964799,
    })).data.data.total).toBe(1)
    expect((await client.getLongText({
      targetUid: '1000000001',
      mblogId: 'EtFixture01',
    })).data.data.isMarkdown).toBe(false)
    expect((await client.getArticle({
      targetUid: '1000000001',
      articleId: '2309404080000000000001',
    })).data.data.title).toBe('Fixture article')
    expect((await client.getArticle(
      '1000000001',
      '1001604080000000000001',
    )).data.data.title).toBe('Legacy fixture article')

    expect(transport.requests.map(({ url }) => url)).toEqual([
      `https://weibo.com${PROFILE_INFO_ENDPOINT}`,
      `https://weibo.com${SEARCH_PROFILE_ENDPOINT}`,
      `https://weibo.com${LONG_TEXT_ENDPOINT}`,
      ARTICLE_DETAIL_ENDPOINT,
      LEGACY_ARTICLE_DETAIL_ENDPOINT,
    ])
    expect(transport.requests[1].params).toEqual({
      uid: '1000000001',
      page: 1,
      starttime: 1483200000,
      endtime: 1485964799,
      hasori: 1,
      hasret: 1,
      hastext: 1,
      haspic: 1,
      hasvideo: 1,
      hasmusic: 1,
    })
    expect(transport.requests[1].headers).toMatchObject({
      cookie: 'SUB=redacted; XSRF-TOKEN=fixture%2Dxsrf',
      referer: 'https://weibo.com/u/1000000001',
      'user-agent': 'fixture-agent',
      'x-xsrf-token': 'fixture-xsrf',
    })
    expect(transport.requests[3].params).toMatchObject({
      id: '2309404080000000000001',
      _t: 1_700_000_000,
    })
    expect(transport.requests[4].params).toMatchObject({
      cid: '1001604080000000000001',
      _: 1_700_000_000,
    })
  })

  it('所有响应先经过校验，错误业务响应不会伪装为空结果', async () => {
    const transport = new QueueTransport([
      { ok: 0, data: { list: [], total: 0 } },
    ])
    const client = new WeiboApiClient({
      cookie: 'SUB=redacted',
      loginUid: '1000000009',
      transport,
      limiter: immediateLimiter(),
    })

    await expect(client.searchProfile({
      targetUid: '1000000001',
      page: 1,
      startAt: 1,
      endAt: 2,
    })).rejects.toThrow()
  })

  it('将鉴权失败转换为不携带请求会话凭证或响应正文的稳定错误', async () => {
    const transportError = Object.assign(new Error('axios-like request failure'), {
      response: { status: 401, data: { secret: 'raw-response-secret' } },
      config: { headers: { cookie: 'SUB=must-not-leak' } },
    })
    const transport = new QueueTransport([transportError])
    const client = new WeiboApiClient({
      cookie: 'SUB=must-not-leak',
      loginUid: '1000000009',
      transport,
      limiter: immediateLimiter(),
    })

    const error = await client.searchProfile({
      targetUid: '1000000001',
      page: 1,
      startAt: 1,
      endAt: 2,
    }).catch((caught) => caught)
    expect(error).toBeInstanceOf(WeiboApiClientError)
    expect(error).toMatchObject({ kind: 'authentication', statusCode: 401 })
    expect(JSON.stringify(error)).not.toContain('must-not-leak')
    expect(JSON.stringify(error)).not.toContain('raw-response-secret')

    const businessClient = new WeiboApiClient({
      cookie: 'SUB=must-not-leak',
      loginUid: '1000000009',
      transport: new QueueTransport([{ ok: 0, msg: '请先登录后重试' }]),
      limiter: immediateLimiter(),
    })
    await expect(businessClient.getProfileInfo('1000000001'))
      .rejects.toMatchObject({ kind: 'authentication' })
  })

  it('可缓存检索命中时跳过传输层和限流时隙', async () => {
    sandbox = createTestSandbox('weibo-api-cache-hit')
    const transport = new QueueTransport([fixture('search-profile.redacted.json')])
    const cache = new WeiboResponseCache(sandbox.cachePath)
    const client = new WeiboApiClient({
      cookie: 'SUB=redacted',
      loginUid: '1000000009',
      transport,
      limiter: immediateLimiter(),
      cache,
    })
    const cacheContext = {
      mode: 'refresh' as const,
      batchStartedAtMs: Date.parse('2020-04-15T10:00:00+08:00'),
      rangeEndAt: Date.parse('2020-02-01T23:59:59+08:00') / 1000,
    }
    await client.searchProfile({
      targetUid: '1000000001',
      page: 1,
      startAt: 1483200000,
      endAt: 1485964799,
      cache: cacheContext,
    })
    const hit = await client.searchProfile({
      targetUid: '1000000001',
      page: 1,
      startAt: 1483200000,
      endAt: 1485964799,
      cache: { ...cacheContext, mode: 'prefer-cache' },
    })

    expect(hit.source).toBe('cache')
    expect(transport.requests).toHaveLength(1)
  })

  it('独立解析当前会话的登录用户编号，不写配置且同样走限流器', async () => {
    const transport = new QueueTransport([
      { ok: 1, data: { login: true, uid: '1000000009' } },
      { ok: 1, data: { login: true, uid: 1000000009 } },
      { ok: 1, data: { login: false, uid: '1000000009' } },
    ])
    const limiter = immediateLimiter()

    await expect(resolveWeiboLoginUid({
      cookie: 'SUB=redacted',
      userAgent: 'fixture-agent',
      transport,
      limiter,
    })).resolves.toBe('1000000009')
    await expect(resolveWeiboLoginUid({
      cookie: 'SUB=redacted',
      transport,
      limiter,
    })).resolves.toBe('1000000009')
    await expect(resolveWeiboLoginUid({
      cookie: 'SUB=redacted',
      transport,
      limiter,
    })).rejects.toThrow()
    expect(transport.requests[0]).toMatchObject({
      url: LOGIN_CONFIG_ENDPOINT,
      params: {},
      headers: {
        cookie: 'SUB=redacted',
        'user-agent': 'fixture-agent',
      },
    })
  })
})
