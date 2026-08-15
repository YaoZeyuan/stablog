import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import type * as TypeWeibo from '../../src/type/namespace/weibo.js'
import {
  adaptArticleResponse,
  adaptSearchProfileResponse,
  extractWeiboArticleId,
  hydrateCanonicalMblog,
  mergeLongTextIntoMblog,
  parseWeiboCreatedAt,
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

describe('微博 canonical adapter', () => {
  it('稳定映射 ID、北京时间、用户、图片与递归转发', () => {
    const response = parseSearchProfileResponse(fixture('search-profile.redacted.json'))
    const [mblog] = adaptSearchProfileResponse(response)

    expect(mblog.id).toBe('4080266096000001')
    expect(mblog.bid).toBe('EtFixture01')
    expect(mblog.created_timestamp_at)
      .toBe(Date.parse('2017-02-01T12:34:56+08:00') / 1000)
    expect(mblog.user?.profile_url).toBe('https://weibo.com/u/1000000001')
    expect(mblog.pics[0]).toMatchObject({
      pid: 'fixture-picture',
      url: 'https://example.invalid/preview.jpg',
      large: {
        url: 'https://example.invalid/original.jpg',
      },
    })
    expect(mblog.retweeted_status).toMatchObject({
      id: '4080000000000001',
      bid: 'EtFixture00',
      pics: [],
      page_info: {
        type: 'article',
        page_pic: {
          url: 'https://example.invalid/article-card.jpg',
        },
      },
    })
  })

  it('严格拒绝接口约定之外或不存在的 created_at', () => {
    expect(parseWeiboCreatedAt('Wed Feb 01 12:34:56 +0800 2017'))
      .toBe(Date.parse('2017-02-01T12:34:56+08:00') / 1000)
    expect(() => parseWeiboCreatedAt('2017-02-01 12:34:56')).toThrow()
    expect(() => parseWeiboCreatedAt('Wed Feb 31 12:34:56 +0800 2017')).toThrow()
    expect(() => parseWeiboCreatedAt('Mon Feb 01 12:34:56 +0800 2017')).toThrow()
  })

  it('普通长文直接合并，Markdown 转为带样式作用域的 HTML', () => {
    const [mblog] = adaptSearchProfileResponse(
      parseSearchProfileResponse(fixture('search-profile.redacted.json')),
    )
    const plain = mergeLongTextIntoMblog(
      mblog,
      parseLongTextResponse(fixture('longtext-plain.redacted.json')),
    )
    const markdown = mergeLongTextIntoMblog(
      mblog,
      parseLongTextResponse(fixture('longtext-markdown.redacted.json')),
    )

    expect(plain.text).toBe('<p>fixture long text</p>')
    expect(plain.raw_text).toBe('fixture long text')
    expect(markdown.text).toContain('<div class="markdown-body">')
    expect(markdown.text).toContain('<h1>Fixture title</h1>')
    expect(markdown.text).toContain('<li>first</li>')
  })

  it('解析现行、scheme 和旧文章 URL 并适配文章结构', () => {
    expect(extractWeiboArticleId(
      'https://card.weibo.com/article/m/show/id/2309404080000000000001',
    )).toBe('2309404080000000000001')
    expect(extractWeiboArticleId(
      'sinaweibo://articlebrowser?object_id=1022%3A2309404080000000000001',
    )).toBe('2309404080000000000001')
    expect(extractWeiboArticleId(
      'https://weibo.com/p/1001604080000000000001',
    )).toBe('1001604080000000000001')
    expect(extractWeiboArticleId('', '2309404080000000000001'))
      .toBe('2309404080000000000001')
    expect(extractWeiboArticleId('https://example.invalid/no-article')).toBe('')

    expect(adaptArticleResponse(
      '2309404080000000000001',
      parseArticleInfoResponse(fixture('article-current.redacted.json')),
    ).title).toBe('Fixture article')
    expect(adaptArticleResponse(
      '1001604080000000000001',
      parseArticleInfoResponse(fixture('article-legacy.redacted.json')),
    )).toMatchObject({
      object_id: '1022:1001604080000000000001',
      title: 'Legacy fixture article',
      content: '<p>Legacy article body</p>',
    })
  })

  it('递归补全转发长文及其文章，任一失败向上传播', async () => {
    const [mblog] = adaptSearchProfileResponse(
      parseSearchProfileResponse(fixture('search-profile.redacted.json')),
    )
    const requestedMblogIds: string[] = []
    const requestedArticleIds: string[] = []
    const hydrated = await hydrateCanonicalMblog(mblog, {
      getLongText: async (mblogId) => {
        requestedMblogIds.push(mblogId)
        return parseLongTextResponse(fixture('longtext-markdown.redacted.json'))
      },
      getArticle: async (articleId) => {
        requestedArticleIds.push(articleId)
        return parseArticleInfoResponse(fixture('article-current.redacted.json'))
      },
    })

    expect(requestedMblogIds).toEqual(['EtFixture00'])
    expect(requestedArticleIds).toEqual(['2309404080000000000001'])
    expect(hydrated.retweeted_status?.text).toContain('markdown-body')
    expect(hydrated.retweeted_status?.article?.title).toBe('Fixture article')

    await expect(hydrateCanonicalMblog(
      {
        ...mblog,
        isLongText: true,
        bid: '',
      } as unknown as TypeWeibo.TypeMblog,
      {
        getLongText: async () => parseLongTextResponse(
          fixture('longtext-plain.redacted.json'),
        ),
        getArticle: async () => parseArticleInfoResponse(
          fixture('article-current.redacted.json'),
        ),
      },
    )).rejects.toThrow()
  })
})
