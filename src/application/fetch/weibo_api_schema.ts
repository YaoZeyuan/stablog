import { z } from 'zod'

const decimalSafeIntegerStringSchema = z.string()
  .regex(/^\d+$/, '必须是非负十进制整数字符串')
  .transform((value, context) => {
    const parsed = Number(value)
    if (Number.isSafeInteger(parsed) === false) {
      context.addIssue({
        code: 'custom',
        message: '数值超出 JavaScript 安全整数范围',
      })
      return z.NEVER
    }
    return parsed
  })

/** 微博接口会把 total 返回为 number 或纯数字字符串，业务层统一消费 number。 */
export const nonnegativeSafeIntegerSchema = z.union([
  z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  decimalSafeIntegerStringSchema,
])

const weiboIdSchema = z.union([
  z.string().regex(/^\d+$/, '微博 ID 必须是数字字符串'),
  z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
])

const weiboUidStringSchema = weiboIdSchema.transform((value) => String(value))

export const weiboApiUserSchema = z.object({
  id: weiboIdSchema,
  idstr: z.string().regex(/^\d+$/),
  screen_name: z.string(),
  profile_image_url: z.string(),
  profile_url: z.string(),
  avatar_large: z.string().optional(),
  avatar_hd: z.string().optional(),
}).passthrough()

export const weiboApiPictureVariantSchema = z.object({
  url: z.string(),
  width: z.union([z.number(), z.string()]).optional(),
  height: z.union([z.number(), z.string()]).optional(),
}).passthrough()

export const weiboApiPictureInfoSchema = z.object({
  thumbnail: weiboApiPictureVariantSchema.optional(),
  bmiddle: weiboApiPictureVariantSchema.optional(),
  large: weiboApiPictureVariantSchema.optional(),
  original: weiboApiPictureVariantSchema.optional(),
  largest: weiboApiPictureVariantSchema.optional(),
  mw2000: weiboApiPictureVariantSchema.optional(),
  pic_id: z.string().optional(),
}).passthrough()

export const weiboApiPageInfoSchema = z.object({
  type: z.union([z.string(), z.number()]).optional(),
  object_type: z.string().optional(),
  source_type: z.string().optional(),
  page_url: z.string().optional(),
  object_id: z.string().optional(),
  page_pic: z.union([
    z.string(),
    z.object({ url: z.string() }).passthrough(),
  ]).optional(),
  play_count: z.union([z.string(), z.number()]).optional(),
  media_info: z.object({
    duration: z.number().finite().nonnegative().optional(),
    stream_url: z.string().optional(),
    stream_url_hd: z.string().optional(),
  }).passthrough().optional(),
}).passthrough()

const searchProfileItemBaseSchema = z.object({
  created_at: z.string().min(1),
  id: weiboIdSchema,
  idstr: z.string().regex(/^\d+$/),
  mid: weiboIdSchema,
  mblogid: z.string().min(1),
  user: weiboApiUserSchema.nullable(),
  text: z.string(),
  text_raw: z.string().optional(),
  // 无图微博（尤其是转发原帖）会省略 pic_ids，内部统一按空数组处理。
  pic_ids: z.array(z.string()).default([]),
  pic_infos: z.record(z.string(), weiboApiPictureInfoSchema).optional(),
  isLongText: z.boolean().optional(),
  reposts_count: z.number().int().nonnegative().optional(),
  comments_count: z.number().int().nonnegative().optional(),
  attitudes_count: z.number().int().nonnegative().optional(),
  deleted: z.union([z.string(), z.number(), z.boolean()]).optional(),
  state: z.number().nullable().optional(),
  page_info: weiboApiPageInfoSchema.optional(),
}).passthrough()

export type SearchProfileItem = z.infer<typeof searchProfileItemBaseSchema> & {
  retweeted_status?: SearchProfileItem
}

export const searchProfileItemSchema: z.ZodType<SearchProfileItem> = searchProfileItemBaseSchema.extend({
  retweeted_status: z.lazy(() => searchProfileItemSchema).optional(),
})

export const searchProfileResponseSchema = z.object({
  ok: z.literal(1),
  data: z.object({
    list: z.array(searchProfileItemSchema).max(50),
    total: nonnegativeSafeIntegerSchema,
  }).passthrough(),
}).passthrough().superRefine((response, context) => {
  const { list, total } = response.data
  if (total === 0 && list.length !== 0) {
    context.addIssue({
      code: 'custom',
      path: ['data', 'list'],
      message: 'total 为 0 时 list 必须为空',
    })
  }
  if (total > 0 && list.length === 0) {
    context.addIssue({
      code: 'custom',
      path: ['data', 'list'],
      message: 'total 大于 0 时当前检索页不得为空',
    })
  }
})

export const profileInfoResponseSchema = z.object({
  ok: z.literal(1),
  data: z.object({
    user: weiboApiUserSchema,
  }).passthrough(),
}).passthrough()

export const longTextResponseSchema = z.object({
  ok: z.literal(1),
  data: z.object({
    longTextContent: z.string(),
    longTextContent_raw: z.string(),
    isMarkdown: z.boolean(),
    // The adapter does not consume url_struct; validate it when present but do
    // not reject otherwise-compatible responses that omit this vendor field.
    url_struct: z.array(z.unknown()).optional(),
  }).passthrough(),
}).passthrough()

const articleCoverImageSchema = z.object({
  url: z.string(),
}).passthrough()

const articleDetailDataSchema = z.object({
  title: z.string(),
  content: z.string(),
  cover_img: z.object({
    image: articleCoverImageSchema.optional(),
    full_image: articleCoverImageSchema.optional(),
  }).passthrough().optional(),
}).passthrough()

const legacyArticleDetailDataSchema = z.object({
  title: z.string(),
  article: z.string(),
  config: z.object({
    image: z.string().optional(),
  }).passthrough(),
}).passthrough()

export const articleInfoResponseSchema = z.union([
  z.object({
    code: z.literal(100000),
    data: articleDetailDataSchema,
  }).passthrough(),
  z.object({
    data: legacyArticleDetailDataSchema,
  }).passthrough(),
])

export const weiboLoginResponseSchema = z.object({
  ok: z.literal(1),
  data: z.object({
    login: z.literal(true),
    uid: weiboUidStringSchema,
  }).passthrough(),
}).passthrough()

export type SearchProfileResponse = z.infer<typeof searchProfileResponseSchema>
export type ProfileInfoResponse = z.infer<typeof profileInfoResponseSchema>
export type LongTextResponse = z.infer<typeof longTextResponseSchema>
export type ArticleInfoResponse = z.infer<typeof articleInfoResponseSchema>
export type WeiboLoginResponse = z.infer<typeof weiboLoginResponseSchema>

export function parseSearchProfileResponse(input: unknown): SearchProfileResponse {
  return searchProfileResponseSchema.parse(input)
}

export function parseProfileInfoResponse(input: unknown): ProfileInfoResponse {
  return profileInfoResponseSchema.parse(input)
}

export function parseLongTextResponse(input: unknown): LongTextResponse {
  return longTextResponseSchema.parse(input)
}

export function parseArticleInfoResponse(input: unknown): ArticleInfoResponse {
  return articleInfoResponseSchema.parse(input)
}

export function parseWeiboLoginResponse(input: unknown): WeiboLoginResponse {
  return weiboLoginResponseSchema.parse(input)
}
