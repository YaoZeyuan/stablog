export type TypeBlogItem = {
    "dayIndex": number | 14,
    "weiboIndex": number | 2,
    "uri": string | "F:\\www\\share\\github\\stablog\\缓存文件\\html\\yaozeyuan93-微博整理(2011-07-07~2021-01-27)\\pdf\\content\\html\\14_2.html"
}

export type TypeDayItem = {
    "dayIndex": number,
    "weiboUriList": TypeBlogItem[]
}

export type TypeDayList = TypeDayItem[]