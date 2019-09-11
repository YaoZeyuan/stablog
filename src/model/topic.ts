import Base from '~/src/model/base'
import TypeTopic from '~/src/type/namespace/topic'
import TypeAnswer from '~/src/type/namespace/answer'
import _ from 'lodash'

class Topic extends Base {
  static TABLE_NAME = `Topic`
  static TABLE_COLUMN = [`topic_id`, `raw_json`]

  static TOPIC_ANSWER_TABLE_NAME = `TopicAnswer`
  static TOPIC_ANSWER_TABLE_COLUMN = [`topic_id`, `answer_id`, `raw_json`]

  /**
   * 从数据库中获取话题信息
   * @param topicId
   */
  static async asyncGetTopicInfo(topicId: string): Promise<TypeTopic.Info> {
    let recordList = await this.db
      .select(this.TABLE_COLUMN)
      .from(this.TABLE_NAME)
      .where('topic_id', '=', topicId)
      .catch(() => {
        return []
      })
    let topicInfoJson = _.get(recordList, [0, 'raw_json'], '{}')
    let topicInfo
    try {
      topicInfo = JSON.parse(topicInfoJson)
    } catch {
      topicInfo = {}
    }
    return topicInfo
  }

  /**
   * 从数据库中获取话题内的答案列表
   * @param topicId
   */
  static async asyncGetAnswerList(topicId: string): Promise<Array<TypeAnswer.Record>> {
    let recordList = await this.db
      .select(this.TOPIC_ANSWER_TABLE_COLUMN)
      .from(this.TOPIC_ANSWER_TABLE_NAME)
      .where('topic_id', '=', topicId)
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
   * 从数据库中获取话题内的答案id列表
   * @param topicId
   */
  static async asyncGetAnswerIdList(topicId: string): Promise<Array<string>> {
    let recordList = await this.db
      .select(this.TOPIC_ANSWER_TABLE_COLUMN)
      .from(this.TOPIC_ANSWER_TABLE_NAME)
      .where('topic_id', '=', topicId)
      .catch(() => {
        return []
      })
    let answerIdList = []
    for (let record of recordList) {
      let answerRecordJson = _.get(record, ['raw_json'], '{}')
      let answerRecord: TypeAnswer.Record
      try {
        answerRecord = JSON.parse(answerRecordJson)
      } catch {
        answerRecord = {}
      }
      if (_.isEmpty(answerRecord) === false) {
        answerIdList.push(answerRecord.id)
      }
    }

    return answerIdList
  }

  /**
   * 存储话题信息数据
   * @param topicRecord
   */
  static async asyncReplaceTopicInfo(topicRecord: TypeTopic.Info): Promise<void> {
    let topicId = topicRecord.id
    let raw_json = JSON.stringify(topicRecord)
    await this.replaceInto({
      topic_id: topicId,
      raw_json,
    })
    return
  }

  /**
   * 存储话题答案数据
   * @param columnRecord
   */
  static async asyncReplaceTopicAnswer(topicId: number, answerRecord: TypeAnswer.Record): Promise<void> {
    let raw_json = JSON.stringify(answerRecord)
    let answerId = answerRecord.id
    await this.replaceInto(
      {
        topic_id: topicId,
        answer_id: answerId,
        raw_json,
      },
      this.TOPIC_ANSWER_TABLE_NAME,
    )
    return
  }
}

export default Topic
