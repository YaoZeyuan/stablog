import Base from '~/src/model/base'
import TypeCollection from '~/src/type/namespace/collection'
import TypeAnswer from '~/src/type/namespace/answer'
import _ from 'lodash'

class Collection extends Base {
  static TABLE_NAME = `Collection`
  static TABLE_COLUMN = [`collection_id`, `raw_json`]

  static COLLECTION_ANSWER_TABLE_NAME = `CollectionAnswer`
  static COLLECTION_ANSWER_TABLE_COLUMN = [`collection_id`, `answer_id`, `raw_answer_excerpt_json`, `raw_answer_json`]

  /**
   * 从数据库中获取专栏信息
   * @param collectionId
   */
  static async asyncGetCollectionInfo(collectionId: string): Promise<TypeCollection.Info> {
    let recordList = await this.db
      .select(this.TABLE_COLUMN)
      .from(this.TABLE_NAME)
      .where('collection_id', '=', collectionId)
      .catch(() => {
        return []
      })
    let collectionInfoJson = _.get(recordList, [0, 'raw_json'], '{}')
    let collectionInfo
    try {
      collectionInfo = JSON.parse(collectionInfoJson)
    } catch {
      collectionInfo = {}
    }
    return collectionInfo
  }

  /**
   * 从数据库中获取收藏夹内的答案列表
   * @param collectionId
   */
  static async asyncGetAnswerList(collectionId: string): Promise<Array<TypeAnswer.Record>> {
    let recordList = await this.db
      .select(this.COLLECTION_ANSWER_TABLE_COLUMN)
      .from(this.COLLECTION_ANSWER_TABLE_NAME)
      .where('collection_id', '=', collectionId)
      .catch(() => {
        return []
      })
    let answerRecordList = []
    for (let record of recordList) {
      let answerRecordJson = _.get(record, ['raw_answer_json'], '{}')
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
   * 从数据库中获取收藏夹内的答案id列表
   * @param collectionId
   */
  static async asyncGetAnswerIdList(collectionId: string): Promise<Array<string>> {
    let recordList = await this.db
      .select(this.COLLECTION_ANSWER_TABLE_COLUMN)
      .from(this.COLLECTION_ANSWER_TABLE_NAME)
      .where('collection_id', '=', collectionId)
      .catch(() => {
        return []
      })
    let answerIdList = []
    for (let record of recordList) {
      let answerId = record.answer_id
      if (answerId) {
        answerIdList.push(answerId)
      }
    }

    return answerIdList
  }

  /**
   * 存储收藏夹数据
   * @param collectionRecord
   */
  static async asyncReplaceColumnInfo(collectionRecord: TypeCollection.Info): Promise<void> {
    let collectionId = collectionRecord.id
    let raw_json = JSON.stringify(collectionRecord)
    await this.replaceInto({
      collection_id: collectionId,
      raw_json,
    })
    return
  }

  /**
   * 存储收藏夹答案概览数据
   * @param columnRecord
   */
  static async asyncReplaceColumnAnswerExcerpt(
    collectionId: number,
    answerExcerptRecord: TypeCollection.AnswerExcerpt,
  ): Promise<void> {
    let raw_answer_excerpt_json = JSON.stringify(answerExcerptRecord)
    let answerId = answerExcerptRecord.id
    // 直接使用replaceInto会把另外一列置换成null, 所以这里手工完善一下replace into吧
    let oldRecordList = await this.db
      .select(this.COLLECTION_ANSWER_TABLE_COLUMN)
      .from(this.COLLECTION_ANSWER_TABLE_NAME)
      .where('collection_id', '=', collectionId)
      .andWhere('answer_id', '=', answerId)
      .catch(() => {
        return []
      })

    let raw_answer_json = _.get(oldRecordList, [0, 'raw_answer_json'], '{}')
    await this.replaceInto(
      {
        collection_id: collectionId,
        answer_id: answerId,
        raw_answer_excerpt_json,
        raw_answer_json,
      },
      this.COLLECTION_ANSWER_TABLE_NAME,
    )
    return
  }

  /**
   * 存储收藏夹答案详情数据
   * @param columnRecord
   */
  static async asyncReplaceColumnAnswer(collectionId: number, answerRecord: TypeAnswer.Record): Promise<void> {
    let raw_answer_json = JSON.stringify(answerRecord)
    let answerId = answerRecord.id
    // 直接使用replaceInto会把另外一列置换成null, 所以这里手工完善一下replace into吧
    let oldRecordList = await this.db
      .select(this.COLLECTION_ANSWER_TABLE_COLUMN)
      .from(this.COLLECTION_ANSWER_TABLE_NAME)
      .where('collection_id', '=', collectionId)
      .andWhere('answer_id', '=', answerId)
      .catch(() => {
        return []
      })

    let raw_answer_excerpt_json = _.get(oldRecordList, [0, 'raw_answer_excerpt_json'], '{}')
    await this.replaceInto(
      {
        collection_id: collectionId,
        answer_id: answerId,
        raw_answer_excerpt_json,
        raw_answer_json,
      },
      this.COLLECTION_ANSWER_TABLE_NAME,
    )
    return
  }
}

export default Collection
