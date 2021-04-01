export type TypeTransConfigItem = {
    "dayIndex": number | 14,
    "weiboIndex": number | 2,
    /**
     * html内容, 打进pdf里, 方便搜索
     */
    htmlContent: string;
    /**
     * html地址
     */
    "htmlUri": string | "F:\\www\\share\\github\\stablog\\缓存文件\\html\\yaozeyuan93-微博整理(2011-07-07~2021-01-27)\\pdf\\content\\html\\14_2.html"
    /**
     * 图片输出地址
     */
    "imageUri": string | "F:\\www\\share\\github\\stablog\\缓存文件\\html\\yaozeyuan93-微博整理(2011-07-07~2021-01-27)\\pdf\\content\\html\\14_2.html"
}

export type TypeTransConfigPackage = {
    title: string,
    "dayIndex": number,
    "configList": TypeTransConfigItem[]
}

export type TypeTransConfigPackageList = TypeTransConfigPackage[]