import Base from '~/src/model/base'
import TypeAnswer from '~/src/type/namespace/answer'
import _ from 'lodash'

class Answer extends Base {
  static TABLE_NAME = `Answer`
  static TABLE_COLUMN = [
    `id`,
    `author_url_token`,
    `author_id`,
    `question_id`,
    `raw_json`
  ]

  /**
   * 从数据库中获取用户信息
   * @param urlToken
   */
  static async asyncGetAnswerList(urlToken: string): Promise<Array<TypeAnswer.Record>> {
    let recordList = await this.db
      .select(this.TABLE_COLUMN)
      .from(this.TABLE_NAME)
      .where('author_url_token', '=', urlToken)
      .catch(() => { return [] })

    let answerRecordList = []
    for (let record of recordList) {

      let answerRecordJson = _.get(record, ['raw_json'], '{}')
      let answerRecord
      try {
        answerRecord = JSON.parse(answerRecordJson)
      } catch {
        answerRecord = {}
      }
      if (_.isEmpty(answerRecord)) {
        continue
      }
      answerRecordList.push(answerRecord)
    }
    return answerRecordList
  }

  static async asyncReplaceAnswer(answerRecord: TypeAnswer.Record) {
    let id = answerRecord.id
    let question_id = answerRecord.question.id
    let author_url_token = answerRecord.author.url_token
    let author_id = answerRecord.author.id
    let raw_json = JSON.stringify(answerRecord)
    await this.replaceInto({
      id,
      author_url_token,
      author_id,
      question_id,
      raw_json
    })
    return
  }
}

export default Answer
