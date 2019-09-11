import AuthorApi from '~/src/api/author'
import AnswerApi from '~/src/api/answer'
import MAnswer from '~/src/model/answer'
import MAuthor from '~/src/model/author'
import Base from '~/src/command/fetch/batch/base'
import BatchFetchAnswer from '~/src/command/fetch/batch/answer'

class BatchFetchAuthorAnswer extends Base {
  async fetch(urlToken: string) {
    this.log(`开始抓取用户${urlToken}的数据`)
    this.log(`获取用户信息`)
    const authorInfo = await AuthorApi.asyncGetAutherInfo(urlToken)
    await MAuthor.asyncReplaceAuthor(authorInfo)
    this.log(`用户信息获取完毕`)
    const name = authorInfo.name
    const answerCount = authorInfo.answer_count
    this.log(`用户${name}(${urlToken})共有${answerCount}个回答`)
    this.log(`开始抓取回答列表`)
    let answetIdList = []
    let batchFetchAnswer = new BatchFetchAnswer()
    for (let offset = 0; offset < answerCount; offset = offset + this.max) {
      let answerList = await AnswerApi.asyncGetAutherAnswerList(urlToken, offset, this.max)
      for (let answer of answerList) {
        let answerId = `${answer.id}`
        answetIdList.push(answerId)
      }
      this.log(`第${offset}~${offset + this.max}条回答记录抓取完毕`)
    }
    this.log(`开始抓取用户${name}(${urlToken})的所有回答记录,共${answetIdList.length}条`)
    await batchFetchAnswer.fetchListAndSaveToDb(answetIdList)
    this.log(`用户${name}(${urlToken})的回答记录抓取完毕`)
  }
}

export default BatchFetchAuthorAnswer
