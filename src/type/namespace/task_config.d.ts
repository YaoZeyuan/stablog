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
  }
}

export default TaskConfig
