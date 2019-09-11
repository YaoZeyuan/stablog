import Base from '~/src/model/base'
import TypeQuestion from '~/src/type/namespace/question'
import TypeAnswer from '~/src/type/namespace/answer'
import _ from 'lodash'

class Question extends Base {
  static TABLE_NAME = `Question`
  static TABLE_COLUMN = [`question_id`, `raw_json`]

  static QUESTION_ANSWER_TABLE_NAME = `QuestionAnswer`
  static QUESTION_ANSWER_TABLE_COLUMN = [`question_id`, `answer_id`, `raw_json`]

  /**
   * 从数据库中获取问题信息
   * @param questionId
   */
  static async asyncGetQuestionInfo(questionId: string): Promise<TypeQuestion.Record> {
    let recordList = await this.db
      .select(this.TABLE_COLUMN)
      .from(this.TABLE_NAME)
      .where('question_id', '=', questionId)
      .catch(() => {
        return []
      })
    let questionInfoJson = _.get(recordList, [0, 'raw_json'], '{}')
    let questionInfo
    try {
      questionInfo = JSON.parse(questionInfoJson)
    } catch {
      questionInfo = {}
    }
    return questionInfo
  }

  /**
   * 从数据库中获取问题内的答案列表
   * @param questionId
   */
  static async asyncGetAnswerList(questionId: string): Promise<Array<TypeAnswer.Record>> {
    let recordList = await this.db
      .select(this.QUESTION_ANSWER_TABLE_COLUMN)
      .from(this.QUESTION_ANSWER_TABLE_NAME)
      .where('question_id', '=', questionId)
      .catch(() => {
        return []
      })
    let answerRecordList = []
    for (let record of recordList) {
      let answerRecordJson = _.get(record, ['raw_json'], '{}')
      let answerRecord
      try {
        answerRecord = JSON.parse(answerRecordJson)
      } catch {
        answerRecord = {}
      }
      if (_.isEmpty(answerRecord) === false) {
        answerRecordList.push(answerRecord)
      }
    }

    return answerRecordList
  }

  /**
   * 存储问题信息数据
   * @param questionRecord
   */
  static async asyncReplaceQuestionInfo(questionRecord: TypeQuestion.Record): Promise<void> {
    let questionId = questionRecord.id
    let raw_json = JSON.stringify(questionRecord)
    await this.replaceInto({
      question_id: questionId,
      raw_json,
    })
    return
  }

  /**
   * 存储问题答案数据
   * @param columnRecord
   */
  static async asyncReplaceQuestionAnswer(questionId: number | string, answerRecord: TypeAnswer.Record): Promise<void> {
    let raw_json = JSON.stringify(answerRecord)
    let answerId = answerRecord.id
    await this.replaceInto(
      {
        question_id: questionId,
        answer_id: answerId,
        raw_json,
      },
      this.QUESTION_ANSWER_TABLE_NAME,
    )
    return
  }
}

export default Question
