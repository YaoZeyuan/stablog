import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  parseArticleInfoResponse,
  parseLongTextResponse,
  parseProfileInfoResponse,
  parseSearchProfileResponse,
  parseWeiboLoginResponse,
} from '../../src/application/fetch/weibo_api_schema.js'

function fixture(name: string): unknown {
  return JSON.parse(
    fs.readFileSync(new URL(`../fixtures/weibo/${name}`, import.meta.url), 'utf8'),
  )
}

describe('微博 API 响应 schema', () => {
  it('校验精简 searchProfile fixture、归一化 total 并透传新增字段', () => {
    const response = parseSearchProfileResponse(fixture('search-profile.redacted.json'))

    expect(response.data.total).toBe(1)
    expect(response.request_id).toBe('redacted-fixture')
    expect(response.data.list[0].vendor_added_field).toBe('kept')
    expect(response.data.list[0].retweeted_status?.pic_ids).toEqual([])
  })

  it.each([
    -1,
    1.5,
    Number.MAX_SAFE_INTEGER + 1,
    '-1',
    '1.0',
    ' 1',
    '9007199254740992',
  ])('拒绝非法 total：%j', (total) => {
    const response = fixture('search-profile.redacted.json') as {
      data: { total: unknown }
    }
    response.data.total = total
    expect(() => parseSearchProfileResponse(response)).toThrow()
  })

  it('接受任意纯数字写法并归一化前导零', () => {
    const response = fixture('search-profile.redacted.json') as {
      data: { total: unknown }
    }
    response.data.total = '0001'
    expect(parseSearchProfileResponse(response).data.total).toBe(1)
  })

  it('区分合法空结果与错误或矛盾响应', () => {
    expect(parseSearchProfileResponse({
      ok: 1,
      data: { list: [], total: '0' },
    }).data.total).toBe(0)
    expect(() => parseSearchProfileResponse({
      ok: 0,
      data: { list: [], total: 0 },
    })).toThrow()
    expect(() => parseSearchProfileResponse({
      ok: 1,
      data: { list: [], total: 1 },
    })).toThrow()
  })

  it('限制单页最多 50 条', () => {
    const response = fixture('search-profile.redacted.json') as {
      data: { list: unknown[]; total: unknown }
    }
    response.data.list = Array.from({ length: 51 }, () => response.data.list[0])
    response.data.total = 51
    expect(() => parseSearchProfileResponse(response)).toThrow()
  })

  it('校验 profile、长文、文章与登录身份响应', () => {
    expect(parseProfileInfoResponse(fixture('profile-info.redacted.json')).data.user.idstr)
      .toBe('1000000001')
    expect(parseLongTextResponse(fixture('longtext-plain.redacted.json')).data.isMarkdown)
      .toBe(false)
    const longTextWithoutUnusedUrlStruct = fixture('longtext-plain.redacted.json') as {
      data: { url_struct?: unknown }
    }
    delete longTextWithoutUnusedUrlStruct.data.url_struct
    expect(parseLongTextResponse(longTextWithoutUnusedUrlStruct).data.isMarkdown).toBe(false)
    expect(parseArticleInfoResponse(fixture('article-current.redacted.json')).data.title)
      .toBe('Fixture article')
    expect(parseArticleInfoResponse(fixture('article-legacy.redacted.json')).data.title)
      .toBe('Legacy fixture article')
    const failedArticle = fixture('article-current.redacted.json') as { code: number }
    failedArticle.code = 100001
    expect(() => parseArticleInfoResponse(failedArticle)).toThrow()
    expect(parseWeiboLoginResponse({
      ok: 1,
      data: { login: true, uid: '1000000001' },
    }).data.uid).toBe('1000000001')
    expect(parseWeiboLoginResponse({
      ok: 1,
      data: { login: true, uid: 1000000001 },
    }).data.uid).toBe('1000000001')
    expect(() => parseWeiboLoginResponse({
      ok: 1,
      data: { login: true, uid: Number.MAX_SAFE_INTEGER + 1 },
    })).toThrow()
    expect(() => parseWeiboLoginResponse({
      ok: 1,
      data: { login: false, uid: '1000000001' },
    })).toThrow()
  })
})
