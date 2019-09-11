import Base from '~/src/model/base'
import TypeAnswer from '~/src/type/namespace/answer'
import _ from 'lodash'

class TotalAnswer extends Base {
  static TABLE_NAME = `V2_Total_Answer`
  static TABLE_COLUMN = [`answer_id`, `question_id`, `author_url_token`, `author_id`, `raw_json`]

  /**
   * 从数据库中获取指定内答案
   * @param answerId
   */
  static async asyncGetAnswer(answerId: string): Promise<TypeAnswer.Record> {
    let recordList = await this.db
      .select(this.TABLE_COLUMN)
      .from(this.TABLE_NAME)
      .where('answer_id', '=', answerId)
      .catch(() => {
        return []
      })
    let answerRecordJson = _.get(recordList, [0, 'raw_json'], '{}')
    let answerRecord: TypeAnswer.Record
    try {
      answerRecord = JSON.parse(answerRecordJson)
    } catch {
      answerRecord = {}
    }

    return answerRecord
  }

  /**
   * 从数据库中获取指定内答案列表
   * @param answerIdList
   */
  static async asyncGetAnswerList(answerIdList: Array<string>): Promise<Array<TypeAnswer.Record>> {
    let sql = this.db
      .select(this.TABLE_COLUMN)
      .from(this.TABLE_NAME)
      .whereIn('answer_id', answerIdList)
      .toString()
    // sql中的变量太多(>999), 会导致sqlite3中的select查询无法执行, 因此这里改为使用raw直接执行sql语句
    let recordList = await this.rawClient.raw(sql, []).catch(e => {
      console.log('error =>', e)
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
   * 根据问题idList从数据库中获取指定内答案列表
   * @param questionIdList
   */
  static async asyncGetAnswerListByQuestionIdList(questionIdList: Array<string>): Promise<Array<TypeAnswer.Record>> {
    let sql = this.db
      .select(this.TABLE_COLUMN)
      .from(this.TABLE_NAME)
      .whereIn('question_id', questionIdList)
      .toString()
    // sql中的变量太多(>999), 会导致sqlite3中的select查询无法执行, 因此这里改为使用raw直接执行sql语句
    let recordList = await this.rawClient.raw(sql, []).catch(() => {
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
   * 根据作者urlToken从数据库中获取指定内答案列表
   * @param authorUrlToken
   */
  static async asyncGetAnswerListByAuthorUrlToken(authorUrlToken: string): Promise<Array<TypeAnswer.Record>> {
    let recordList = await this.db
      .select(this.TABLE_COLUMN)
      .from(this.TABLE_NAME)
      .where('author_url_token', '=', authorUrlToken)
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
   * 存储问题答案数据
   * @param columnRecord
   */
  static async asyncReplaceAnswer(answerRecord: TypeAnswer.Record): Promise<void> {
    let raw_json = JSON.stringify(answerRecord)
    let answerId = answerRecord.id
    let questionId = answerRecord.question.id
    let authorUrlToken = answerRecord.author.url_token
    let authorId = answerRecord.author.id
    await this.replaceInto(
      {
        question_id: questionId,
        answer_id: answerId,
        author_id: authorId,
        author_url_token: authorUrlToken,
        raw_json,
      },
      this.TABLE_NAME,
    )
    return
  }
}

export default TotalAnswer
