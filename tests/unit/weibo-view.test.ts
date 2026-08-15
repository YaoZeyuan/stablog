import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import type * as TypeWeibo from '../../src/type/namespace/weibo.js'
import WeiboView from '../../src/view/weibo.js'
import {
  adaptSearchProfileResponse,
  hydrateCanonicalMblog,
} from '../../src/application/fetch/weibo_canonical_adapter.js'
import {
  parseArticleInfoResponse,
  parseLongTextResponse,
  parseSearchProfileResponse,
} from '../../src/application/fetch/weibo_api_schema.js'

function fixture(name: string): unknown {
  return JSON.parse(
    fs.readFileSync(new URL(`../fixtures/weibo/${name}`, import.meta.url), 'utf8'),
  )
}

describe('canonical 微博 HTML 输出', () => {
  it('保留作者、正文、日期、媒体、转发和 Markdown 文章语义', async () => {
    const [adapted] = adaptSearchProfileResponse(
      parseSearchProfileResponse(fixture('search-profile.redacted.json')),
    )
    const mblog = await hydrateCanonicalMblog(adapted, {
      getLongText: async () => parseLongTextResponse(
        fixture('longtext-markdown.redacted.json'),
      ),
      getArticle: async () => parseArticleInfoResponse(
        fixture('article-current.redacted.json'),
      ),
    })

    const html = WeiboView.render([mblog])
    expect(html).toContain('fixture-user')
    expect(html).toContain('fixture summary')
    expect(html).toContain('2017-02-01')
    expect(html).toContain('https://example.invalid/original.jpg')
    expect(html).toContain('nested-user')
    expect(html).toContain('markdown-body')
    expect(html).toContain('Fixture article')
  })

  it('顶层已删除记录缺少 user 时仍可生成占位内容', () => {
    const [adapted] = adaptSearchProfileResponse(
      parseSearchProfileResponse(fixture('search-profile.redacted.json')),
    )
    const deleted = {
      ...adapted,
      user: null,
      state: 7,
      text: '<p>该微博已不可见</p>',
    } as unknown as TypeWeibo.TypeMblog

    const html = WeiboView.render([deleted])
    expect(html).toContain('该微博已不可见')
    expect(html).toContain('weibo-rp')
  })
})
