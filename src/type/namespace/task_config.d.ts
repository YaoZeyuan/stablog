declare namespace TaskConfig {
  type AuthorCollectionType =
    | 'author-ask-question'
    | 'author-answer'
    | 'author-pin'
    | 'author-agree-answer'
    | 'author-agree-article'
    | 'author-watch-question'
  type ItemCollectionType = 'topic' | 'collection' | 'column' | 'article' | 'question' | 'answer' | 'pin'
  type orderBy = 'createAt' | 'updateAt' | 'voteUpCount' | 'commentCount'
  type order = 'asc' | 'desc'
  type orderByList = Array<{
    orderBy: orderBy
    order: order
  }>
  type imageQuilty = 'default' | 'none' | 'raw' | 'hd'
  type maxQuestionOrArticleInBook = number // 自动分卷: 单本电子书中最大问题/文章数量
  type Record = {
    type: ItemCollectionType | AuthorCollectionType
    id: string | number
    rawInputText: string
    comment: string // 备注
  }

  // 自定义抓取
  type Customer = {
    configList: Array<Record>
    imageQuilty: imageQuilty // 图片质量
    bookTitle: string // 书名
    comment: string // 备注
    maxQuestionOrArticleInBook: maxQuestionOrArticleInBook // 自动分卷: 单本电子书中最大问题/文章数量
    orderByList: orderByList
  }
}

export default TaskConfig
