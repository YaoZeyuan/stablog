import QuestionApi from '~/src/api/question'
import MQuestion from '~/src/model/question'
import Logger from '~/src/library/logger'
import _ from 'lodash'
import BatchFetchAnswer from '~/src/command/fetch/batch/answer'
import Base from '~/src/command/fetch/batch/base'

class BatchFetchQuestion extends Base {
  /**
   * 获取单个问题,并存入数据库中
   * @param questionId
   */
  async fetch(questionId: string) {
    this.log(`准备抓取问题${questionId}`)
    let question = await QuestionApi.asyncGetQuestionInfo(questionId)
    if (_.isEmpty(question)) {
      this.log(`问题${questionId}抓取失败`)
      return
    }
    let title = question.title
    let answerCount = question.answer_count
    this.log(`问题:${title}(${questionId})信息抓取成功, 存入数据库`)
    await MQuestion.asyncReplaceQuestionInfo(question)
    this.log(`问题:${title}(${questionId})信息成功存入数据库`)
    this.log(`问题${title}(${questionId})下共有${answerCount}个回答`)
    this.log(`开始抓取问题${title}(${questionId})下的回答列表`)
    let answerIndex = 0
    let answerIdList = []
    let batchFetchAnswer = new BatchFetchAnswer()
    for (let offset = 0; offset < answerCount; offset = offset + this.max) {
      let answerList = await QuestionApi.asyncGetAnswerList(questionId, offset, this.max)
      for (let answer of answerList) {
        answerIndex = answerIndex + 1
        await MQuestion.asyncReplaceQuestionAnswer(questionId, answer)
        let answerId = `${answer.id}`
        answerIdList.push(answerId)
      }
    }
    await batchFetchAnswer.fetchListAndSaveToDb(answerIdList)
    this.log(`问题${title}(${questionId})下全部回答抓取完毕`)
  }
}

export default BatchFetchQuestion
