export namespace TypeTaskConfig {
  export type imageQuilty = 'default' | 'none' | 'raw' | 'hd'
  export type maxBlogInBook = number // 自动分卷: 单本电子书中最大问题/文章数量
  export type Record = {
    uid: string
    rawInputText: string
    comment: string // 备注
  }

  // 自定义抓取
  export type Customer = {
    configList: Array<Record>
    imageQuilty: imageQuilty // 图片质量
    pdfQuilty: 50 | 60 | 70 | 90 | 100 // pdf输出质量(默认60, 质量体积平衡点)
    bookTitle: string // 书名
    comment: string // 备注
    maxBlogInBook: maxBlogInBook // 自动分卷: 单本电子书中最大微博数
    mergeBy: 'day' | 'month' | 'year' | 'count' // 按天/月/年/微博条数合并微博记录
    // 若按count合并微博, 单页中处理多少条微博记录
    mergeCount: number
    /**
     * 微博排序方式: 按发布事件升序排列, 按发布时间降序排列
     */
    postAtOrderBy: 'desc' | 'asc'
    /**
     * 开始抓取的页码数, 默认为0(方便抓取区间数据)
     */
    fetchStartAtPageNo: number
    /**
     * 结束抓取的页码数, 默认为10000(方便抓取区间数据)
     */
    fetchEndAtPageNo: number
    /**
     * 输出微博时间上限(毫秒值)
     */
    outputStartAtMs: number
    /**
     * 输出微博时间下限(毫秒值)
     */
    outputEndAtMs: number
    /**
     * 是否跳过备份阶段
     */
    isSkipFetch: boolean
    /**
     * 是否跳过pdf输出阶段
     */
    isSkipGeneratePdf: boolean
  }

  // 作为常量
  export const CONST_Order_Desc = 'desc'
  export const CONST_Order_Asc = 'asc'
  export const CONST_Image_Quilty_默认 = 'default'
  export const CONST_Image_Quilty_无图 = 'none'
  export const CONST_Pdf_Quilty_低清 = 50
  export const CONST_Pdf_Quilty_标准 = 60
  export const CONST_Pdf_Quilty_清晰 = 70
  export const CONST_Pdf_Quilty_超清 = 90
  export const CONST_Pdf_Quilty_原图 = 100
  export const CONST_Merge_By_年 = 'year'
  export const CONST_Merge_By_月 = 'month'
  export const CONST_Merge_By_日 = 'day'
  export const CONST_Merge_By_按篇数分割 = 'count'
}
