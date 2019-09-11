import AuthorApi from '~/src/api/author'
import MAuthorAskQuestion from '~/src/model/author_ask_question'
import MAuthor from '~/src/model/author'
import Base from '~/src/command/fetch/batch/base'
import BatchFetchQuestion from '~/src/command/fetch/batch/question'

class BatchFetchAuthorQuestion extends Base {
  async fetch(urlToken: string) {
    this.log(`开始抓取用户${urlToken}的数据`)
    this.log(`获取用户信息`)
    const authorInfo = await AuthorApi.asyncGetAutherInfo(urlToken)
    await MAuthor.asyncReplaceAuthor(authorInfo)
    this.log(`用户信息获取完毕`)
    const name = authorInfo.name
    const authorId = authorInfo.id
    const questionCount = authorInfo.question_count
    this.log(`用户${name}(${urlToken})共提了${questionCount}个问题`)
    this.log(`开始抓取提问列表`)
    let batchFetchQuestion = new BatchFetchQuestion()
    for (let offset = 0; offset < questionCount; offset = offset + this.max) {
      let authorQuestionList = await AuthorApi.asyncGetAutherQuestionList(urlToken, offset, this.max)
      for (let authorQuestion of authorQuestionList) {
        await MAuthorAskQuestion.asyncReplaceAuthorQuestion(urlToken, authorId, authorQuestion)
      }
      this.log(`第${offset}~${offset + this.max}条用户提问记录获取完毕`)
    }
    let questionIdList = await MAuthorAskQuestion.asyncGetAuthorAskQuestionIdList(urlToken)
    this.log(`开始抓取用户${name}(${urlToken})的所有提问下的回答记录,共${questionIdList.length}条`)
    await batchFetchQuestion.fetchListAndSaveToDb(questionIdList)
    this.log(`用户${name}(${urlToken})的提问记录抓取完毕`)
  }
}

export default BatchFetchAuthorQuestion
