import fs from 'node:fs'
import fsp from 'node:fs/promises'
import { afterEach, describe, expect, it } from 'vitest'
import { parseSearchProfileResponse } from '../../src/application/fetch/weibo_api_schema.js'
import {
  isWeiboResponseCacheEligible,
  WeiboResponseCache,
  WeiboResponseCacheRequest,
} from '../../src/application/fetch/weibo_response_cache.js'
import { createTestSandbox, TestSandbox } from '../helpers/sandbox.js'

function fixture(): unknown {
  return JSON.parse(
    fs.readFileSync(
      new URL('../fixtures/weibo/search-profile.redacted.json', import.meta.url),
      'utf8',
    ),
  )
}

function request(loginUid = '1000000009'): WeiboResponseCacheRequest {
  return {
    apiVersion: 'weibo-web-v1',
    endpoint: '/ajax/statuses/searchProfile',
    loginUid,
    targetUid: '1000000001',
    params: {
      uid: '1000000001',
      page: 1,
      starttime: 1483200000,
      endtime: 1485964799,
    },
  }
}

describe('微博 HTTP JSON 缓存', () => {
  let sandbox: TestSandbox | undefined

  afterEach(() => {
    sandbox?.cleanup()
    sandbox = undefined
  })

  it('按登录身份隔离、只写通过 schema 的响应且不落凭证', async () => {
    sandbox = createTestSandbox('weibo-cache')
    const cache = new WeiboResponseCache(sandbox.cachePath)
    const firstRequest = request()
    const otherIdentityRequest = request('1000000010')
    const responseWithCredential = fixture() as Record<string, unknown>
    responseWithCredential.access_token = 'must-not-be-persisted'

    await cache.write(firstRequest, responseWithCredential, parseSearchProfileResponse)
    await cache.write(otherIdentityRequest, fixture(), parseSearchProfileResponse)

    expect(cache.getCachePath(firstRequest)).not.toBe(cache.getCachePath(otherIdentityRequest))
    expect((await cache.read(firstRequest, parseSearchProfileResponse))?.data.total).toBe(1)
    const diskContent = await fsp.readFile(cache.getCachePath(firstRequest), 'utf8')
    expect(diskContent).not.toContain('cookie')
    expect(diskContent).not.toContain('token')
    expect(diskContent).not.toContain('must-not-be-persisted')
    await expect(cache.write(
      firstRequest,
      { ok: 0, data: { list: [], total: 0 } },
      parseSearchProfileResponse,
    )).rejects.toThrow()
  })

  it('损坏缓存按 miss 回退，prefer-cache 命中不调用网络，refresh 覆盖', async () => {
    sandbox = createTestSandbox('weibo-cache-modes')
    const cache = new WeiboResponseCache(sandbox.cachePath)
    const cacheRequest = request()
    let fetchCount = 0

    await cache.write(cacheRequest, fixture(), parseSearchProfileResponse)
    const hit = await cache.getOrFetch({
      mode: 'prefer-cache',
      eligible: true,
      request: cacheRequest,
      parser: parseSearchProfileResponse,
      fetcher: async () => {
        fetchCount += 1
        return fixture()
      },
    })
    expect(hit.source).toBe('cache')
    expect(fetchCount).toBe(0)

    const refreshed = fixture() as {
      data: { list: Array<{ text: string }> }
    }
    refreshed.data.list[0].text = 'refreshed'
    const refreshResult = await cache.getOrFetch({
      mode: 'refresh',
      eligible: true,
      request: cacheRequest,
      parser: parseSearchProfileResponse,
      fetcher: async () => {
        fetchCount += 1
        return refreshed
      },
    })
    expect(refreshResult.source).toBe('network')
    expect((await cache.read(cacheRequest, parseSearchProfileResponse))?.data.list[0].text)
      .toBe('refreshed')

    await fsp.writeFile(cache.getCachePath(cacheRequest), '{broken json', 'utf8')
    const recovered = await cache.getOrFetch({
      mode: 'prefer-cache',
      eligible: true,
      request: cacheRequest,
      parser: parseSearchProfileResponse,
      fetcher: async () => {
        fetchCount += 1
        return fixture()
      },
    })
    expect(recovered.source).toBe('network')
    expect(fetchCount).toBe(2)
    expect((await cache.read(cacheRequest, parseSearchProfileResponse))?.data.total).toBe(1)
  })

  it('只清理指定登录身份和目标用户的缓存', async () => {
    sandbox = createTestSandbox('weibo-cache-clear')
    const cache = new WeiboResponseCache(sandbox.cachePath)
    const firstRequest = request()
    const otherIdentityRequest = request('1000000010')
    await cache.write(firstRequest, fixture(), parseSearchProfileResponse)
    await cache.write(otherIdentityRequest, fixture(), parseSearchProfileResponse)

    await cache.clearIdentityTarget({
      apiVersion: firstRequest.apiVersion,
      targetUid: firstRequest.targetUid,
      loginUid: firstRequest.loginUid,
    })

    expect(await cache.read(firstRequest, parseSearchProfileResponse)).toBeUndefined()
    expect(await cache.read(otherIdentityRequest, parseSearchProfileResponse)).toBeDefined()
  })

  it('仅允许结束秒严格早于启动时刻减一个自然月', () => {
    const batchStartedAtMs = Date.parse('2020-04-15T10:00:00+08:00')
    expect(isWeiboResponseCacheEligible({
      batchStartedAtMs,
      rangeEndAt: Date.parse('2020-03-15T09:59:59+08:00') / 1000,
    })).toBe(true)
    expect(isWeiboResponseCacheEligible({
      batchStartedAtMs,
      rangeEndAt: Date.parse('2020-03-15T10:00:00+08:00') / 1000,
    })).toBe(false)
  })

  it('拒绝把敏感请求参数加入缓存键或落盘内容', () => {
    sandbox = createTestSandbox('weibo-cache-sensitive')
    const cache = new WeiboResponseCache(sandbox.cachePath)
    expect(() => cache.getCachePath({
      ...request(),
      params: { cookie: 'credential' },
    })).toThrow()
    expect(() => cache.getCachePath({
      ...request(),
      endpoint: '/ajax/statuses/searchProfile?token=credential',
    })).toThrow()
  })
})
