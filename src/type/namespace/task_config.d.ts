declare namespace TaskConfig {
  type imageQuilty = 'default' | 'none' | 'raw' | 'hd'
  type maxBlogInBook = number // 自动分卷: 单本电子书中最大问题/文章数量
  type Record = {
    uid: string
    rawInputText: string
    comment: string // 备注
  }

  // 自定义抓取
  type Customer = {
    configList: Array<Record>
    imageQuilty: imageQuilty // 图片质量
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
  }
}

export default TaskConfig
