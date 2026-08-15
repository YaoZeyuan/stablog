import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone.js'
import utc from 'dayjs/plugin/utc.js'
import { marked } from 'marked'
import type * as TypeWeibo from '~/src/type/namespace/weibo.js'
import {
  ArticleInfoResponse,
  LongTextResponse,
  parseSearchProfileResponse,
  ProfileInfoResponse,
  SearchProfileItem,
  SearchProfileResponse,
} from '~/src/application/fetch/weibo_api_schema.js'
import { WEIBO_TIME_ZONE } from '~/src/application/fetch/date_range_planner.js'

dayjs.extend(utc)
dayjs.extend(timezone)

const MONTH_INDEX: Record<string, number> = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11,
}
const WEEKDAY_LIST = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

function parseCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function parseDimension(value: unknown): number | string {
  return typeof value === 'number' || typeof value === 'string' ? value : 0
}

/** 严格解析新接口固定的英文日期格式，并明确按 +08:00 生成时间戳。 */
export function parseWeiboCreatedAt(rawCreatedAt: string): number {
  const match = rawCreatedAt.match(
    /^(Sun|Mon|Tue|Wed|Thu|Fri|Sat) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{2}) (\d{2}):(\d{2}):(\d{2}) \+0800 (\d{4})$/,
  )
  if (match === null) {
    throw new TypeError(`微博 created_at 格式无效：${rawCreatedAt}`)
  }
  const [, weekdayName, monthName, dayText, hourText, minuteText, secondText, yearText] = match
  const year = Number(yearText)
  const month = MONTH_INDEX[monthName]
  const day = Number(dayText)
  const hour = Number(hourText)
  const minute = Number(minuteText)
  const second = Number(secondText)
  const timestampMs = Date.UTC(year, month, day, hour - 8, minute, second)
  const parsed = dayjs(timestampMs).tz(WEIBO_TIME_ZONE)
  const expected = `${yearText}-${`${month + 1}`.padStart(2, '0')}-${dayText} ${hourText}:${minuteText}:${secondText}`
  if (parsed.format('YYYY-MM-DD HH:mm:ss') !== expected) {
    throw new TypeError(`微博 created_at 日期无效：${rawCreatedAt}`)
  }
  const expectedWeekday = WEEKDAY_LIST[new Date(Date.UTC(year, month, day)).getUTCDay()]
  if (weekdayName !== expectedWeekday) {
    throw new TypeError(`微博 created_at 星期与日期不一致：${rawCreatedAt}`)
  }
  return Math.floor(timestampMs / 1000)
}

function absoluteProfileUrl(profileUrl: string): string {
  if (profileUrl.startsWith('/')) return `https://weibo.com${profileUrl}`
  return profileUrl
}

function adaptUser(user: SearchProfileItem['user']): TypeWeibo.TypenWeiboRecord_UserInfo | null {
  if (user === null) return null
  return {
    ...user,
    id: Number(user.idstr),
    profile_url: absoluteProfileUrl(user.profile_url),
    avatar_hd: user.avatar_hd ?? user.avatar_large ?? user.profile_image_url,
  } as unknown as TypeWeibo.TypenWeiboRecord_UserInfo
}

function adaptPictures(item: SearchProfileItem): TypeWeibo.TypenWeiboRecord_Pic[] {
  const pictureInfoMap = item.pic_infos ?? {}
  return item.pic_ids.flatMap((pictureId) => {
    const info = pictureInfoMap[pictureId]
    if (info === undefined) return []
    const preview = info.bmiddle ?? info.thumbnail ?? info.large ?? info.original ?? info.largest
    const large = info.largest ?? info.original ?? info.mw2000 ?? info.large ?? preview
    if (preview === undefined || large === undefined) return []
    return [{
      pid: info.pic_id ?? pictureId,
      url: preview.url,
      size: 'large',
      geo: {
        width: parseDimension(preview.width),
        height: parseDimension(preview.height),
        croped: false,
      },
      large: {
        size: 'large',
        url: large.url,
        geo: {
          width: parseDimension(large.width),
          height: parseDimension(large.height),
          croped: false,
        },
      },
    } as unknown as TypeWeibo.TypenWeiboRecord_Pic]
  })
}

function adaptPageInfo(pageInfo: SearchProfileItem['page_info']): TypeWeibo.TypePageInfo | undefined {
  if (pageInfo === undefined) return undefined
  const semanticType = pageInfo.object_type ?? pageInfo.source_type
  const normalizedType = semanticType === 'article' || semanticType === 'video' || semanticType === 'webpage'
    ? semanticType
    : pageInfo.type
  const rawPagePic = (pageInfo as Record<string, unknown>).page_pic
  const normalizedPagePic = typeof rawPagePic === 'string'
    ? { url: rawPagePic }
    : rawPagePic
  return {
    ...pageInfo,
    type: normalizedType,
    ...(normalizedPagePic === undefined ? {} : { page_pic: normalizedPagePic }),
  } as unknown as TypeWeibo.TypePageInfo
}

/** 将供应商 searchProfile item 转成现有 SQLite/HTML 链路消费的稳定 TypeMblog。 */
export function adaptSearchProfileItem(item: SearchProfileItem): TypeWeibo.TypeMblog {
  const retweetedStatus = item.retweeted_status === undefined
    ? undefined
    : adaptSearchProfileItem(item.retweeted_status)
  return {
    ...item,
    id: item.idstr,
    idstr: item.idstr,
    mid: String(item.mid),
    bid: item.mblogid,
    user: adaptUser(item.user),
    raw_text: item.text_raw,
    created_timestamp_at: parseWeiboCreatedAt(item.created_at),
    reposts_count: parseCount(item.reposts_count),
    comments_count: parseCount(item.comments_count),
    attitudes_count: parseCount(item.attitudes_count),
    pics: adaptPictures(item),
    page_info: adaptPageInfo(item.page_info),
    retweeted_status: retweetedStatus,
  } as unknown as TypeWeibo.TypeMblog
}

export function adaptSearchProfileResponse(response: SearchProfileResponse): TypeWeibo.TypeMblog[] {
  return response.data.list.map(adaptSearchProfileItem)
}

export function parseAndAdaptSearchProfileResponse(input: unknown): TypeWeibo.TypeMblog[] {
  return adaptSearchProfileResponse(parseSearchProfileResponse(input))
}

export function adaptProfileInfoUser(response: ProfileInfoResponse): TypeWeibo.TypeWeiboUserInfo {
  const user = response.data.user
  return {
    ...user,
    id: Number(user.idstr),
    profile_url: absoluteProfileUrl(user.profile_url),
    avatar_hd: user.avatar_hd ?? user.avatar_large ?? user.profile_image_url,
  } as unknown as TypeWeibo.TypeWeiboUserInfo
}

function decodeRepeatedly(value: string): string {
  let decoded = value
  for (let index = 0; index < 3; index += 1) {
    try {
      const next = decodeURIComponent(decoded)
      if (next === decoded) break
      decoded = next
    } catch {
      break
    }
  }
  return decoded
}

/** 支持当前接口中 sinaweibo scheme、ttarticle、card article 和旧 `/p/<id>` 地址。 */
export function extractWeiboArticleId(pageUrl: string, objectId = ''): string {
  const candidateList = [decodeRepeatedly(objectId), decodeRepeatedly(pageUrl)]
  const patternList = [
    /^(\d{10,32})$/,
    /(?:^|[?&#])object_id=1022:(\d{10,32})(?:$|[&#])?/,
    /(?:^|[?&#/])id=(\d{10,32})(?:$|[&#])?/,
    /\/show\/id\/(\d{10,32})(?:$|[?&#/])?/,
    /weibo\.com\/p\/(\d{10,32})(?:$|[?&#/])?/,
    /1022:(\d{10,32})/,
  ]
  for (const candidate of candidateList) {
    for (const pattern of patternList) {
      const match = candidate.match(pattern)
      if (match !== null) return match[1]
    }
  }
  return ''
}

export function adaptArticleResponse(
  articleId: string,
  response: ArticleInfoResponse,
): TypeWeibo.TypeWeiboArticleRecord {
  const data = response.data
  if ('content' in data) {
    return data as unknown as TypeWeibo.TypeWeiboArticleRecord
  }
  const coverUrl = data.config.image ?? ''
  return {
    ...data,
    object_id: `1022:${articleId}`,
    title: data.title,
    content: data.article,
    target_url: `https://weibo.com/p/${articleId}`,
    url: `https://weibo.com/p/${articleId}`,
    cover_img: {
      image: { url: coverUrl, width: 800, height: 450 },
      full_image: { url: coverUrl, width: 1000, height: 562 },
    },
  } as unknown as TypeWeibo.TypeWeiboArticleRecord
}

/** 合并长微博正文；Markdown 使用任务提供的 .markdown-body 样式作用域。 */
export function mergeLongTextIntoMblog(
  mblog: TypeWeibo.TypeMblog,
  response: LongTextResponse,
): TypeWeibo.TypeMblog {
  const content = response.data.longTextContent
  const html = response.data.isMarkdown
    ? `<div class="markdown-body">${marked.parse(content, { async: false })}</div>`
    : content
  return {
    ...mblog,
    text: html,
    raw_text: response.data.longTextContent_raw,
    isLongText: true,
  } as unknown as TypeWeibo.TypeMblog
}

export type CanonicalMblogHydrators = {
  getLongText(mblogId: string): Promise<LongTextResponse>
  getArticle(articleId: string): Promise<ArticleInfoResponse>
}

/**
 * 用注入的 API hydrator 递归补全原帖与转发中的长文/文章。
 * 任一补全失败会直接抛出，由上层把所属页任务标记为 failed。
 */
export async function hydrateCanonicalMblog(
  mblog: TypeWeibo.TypeMblog,
  hydrators: CanonicalMblogHydrators,
): Promise<TypeWeibo.TypeMblog> {
  let hydrated = { ...mblog }
  if (hydrated.isLongText === true) {
    const bid = (hydrated as unknown as { bid?: unknown }).bid
    if (typeof bid !== 'string' || bid === '') {
      throw new TypeError(`长微博 ${hydrated.id} 缺少 mblogid`)
    }
    hydrated = mergeLongTextIntoMblog(hydrated, await hydrators.getLongText(bid))
  }
  if (hydrated.retweeted_status !== undefined) {
    hydrated.retweeted_status = await hydrateCanonicalMblog(hydrated.retweeted_status, hydrators)
  }

  const pageInfo = hydrated.page_info as unknown as Record<string, unknown> | undefined
  const pageType = pageInfo?.type ?? pageInfo?.object_type ?? pageInfo?.source_type
  if (pageType === 'article') {
    const articleId = extractWeiboArticleId(
      typeof pageInfo?.page_url === 'string' ? pageInfo.page_url : '',
      typeof pageInfo?.object_id === 'string' ? pageInfo.object_id : '',
    )
    if (articleId === '') {
      throw new TypeError(`微博 ${hydrated.id} 的文章地址无法解析`)
    }
    hydrated.article = adaptArticleResponse(articleId, await hydrators.getArticle(articleId))
  }
  return hydrated
}
