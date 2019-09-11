import Base from '~/src/model/base'
import TypePin from '~/src/type/namespace/pin'
import _ from 'lodash'

class Pin extends Base {
  static TABLE_NAME = `V2_Total_Pin`
  static TABLE_COLUMN = [`pin_id`, `author_url_token`, `author_id`, `raw_json`]

  /**
   * 从数据库中获取用户的想法列表
   * @param questionId
   */
  static async asyncGetPinListByAuthorUrlToken(authorUrlToken: string): Promise<Array<TypePin.Record>> {
    let recordList = await this.db
      .select(this.TABLE_COLUMN)
      .from(this.TABLE_NAME)
      .where('author_url_token', authorUrlToken)
      .catch(() => {
        return []
      })
    let pinRecordList = []
    for (let record of recordList) {
      let pinRecordJson = _.get(record, ['raw_json'], '{}')
      let pinRecord
      try {
        pinRecord = JSON.parse(pinRecordJson)
      } catch {
        pinRecord = {}
      }
      if (_.isEmpty(pinRecord) === false) {
        pinRecordList.push(pinRecord)
      }
    }

    return pinRecordList
  }
  /**
   * 根据pinId从数据库中获取用户的想法
   * @param pinId
   */
  static async asyncGetPin(pinId: string): Promise<TypePin.Record> {
    let recordList = await this.db
      .select(this.TABLE_COLUMN)
      .from(this.TABLE_NAME)
      .where('pin_id', '=', pinId)
      .catch(() => {
        return []
      })
    let pinRecordJson = _.get(recordList, [0, 'raw_json'], '{}')
    let pinRecord: TypePin.Record
    try {
      pinRecord = JSON.parse(pinRecordJson)
    } catch {
      pinRecord = {}
    }

    return pinRecord
  }

  /**
   * 根据pinId从数据库中获取用户的想法列表
   * @param pinIdList
   */
  static async asyncGetPinList(pinIdList: Array<string>): Promise<Array<TypePin.Record>> {
    let sql = this.db
      .select(this.TABLE_COLUMN)
      .from(this.TABLE_NAME)
      .whereIn('pin_id', pinIdList)
      .toString()
    // sql中的变量太多(>999), 会导致sqlite3中的select查询无法执行, 因此这里改为使用raw直接执行sql语句
    let recordList = await this.rawClient.raw(sql, []).catch(() => {
      return []
    })
    let pinRecordList = []
    for (let record of recordList) {
      let pinRecordJson = _.get(record, ['raw_json'], '{}')
      let pinRecord
      try {
        pinRecord = JSON.parse(pinRecordJson)
      } catch {
        pinRecord = {}
      }
      if (_.isEmpty(pinRecord) === false) {
        pinRecordList.push(pinRecord)
      }
    }

    return pinRecordList
  }

  /**
   * 存储想法数据
   * @param pinRecord
   */
  static async asyncReplacePin(pinRecord: TypePin.Record): Promise<void> {
    let raw_json = JSON.stringify(pinRecord)
    let pin_id = pinRecord.id
    let author_url_token = pinRecord.author.url_token
    let author_id = pinRecord.author.id
    await this.replaceInto(
      {
        pin_id,
        author_id,
        author_url_token,
        raw_json,
      },
      this.TABLE_NAME,
    )
    return
  }
}

export default Pin
