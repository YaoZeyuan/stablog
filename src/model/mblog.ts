import Base from '~/src/model/base'
import * as TypeWeibo from '~/src/type/namespace/weibo'
import _ from 'lodash'
import moment from 'moment'
import DATE_FORMAT from '~/src/constant/date_format'

type TypeMblogRecord = {
  id: string
  author_uid: string
  raw_json: string
}

export default class Mblog extends Base {
  static TABLE_NAME = `total_mblog`
  static TABLE_COLUMN = [`id`, `author_uid`, `raw_json`]

  /**
   * 从数据库中获取微博记录列表
   * @param id
   */
  static async asyncGetMblogList(uid: string): Promise<Array<TypeWeibo.TypeWeiboRecord>> {
    let recordList = <Array<TypeMblogRecord>>await this.db
      .select(this.TABLE_COLUMN)
      .from(this.TABLE_NAME)
      .where('author_id', '=', uid)
      .catch(() => {
        return []
      })

    let mblogRecordList = []
    for (let record of recordList) {
      let mblogRecordJson = _.get(record, ['raw_json'], '{}')
      let mblogRecord
      try {
        mblogRecord = JSON.parse(mblogRecordJson)
      } catch {
        mblogRecord = {}
      }
      if (_.isEmpty(mblogRecord) === false) {
        mblogRecordList.push(mblogRecord)
      }
    }
    return mblogRecordList
  }

  static async asyncReplaceInto(id: string, author_uid: string, raw_json: string) {
    // 先检查数据库中是否有该条记录
    let recordList = <Array<TypeMblogRecord>>await this.db
      .select(this.TABLE_COLUMN)
      .from(this.TABLE_NAME)
      .where('id', '=', id)
      .catch(() => {
        return []
      })
    let isSuccess = false
    if (_.isEmpty(recordList) === false) {
      // 存在记录, update
      let record_id = recordList[0].id
      let updateRowCount = await this.db
        .update({ id, author_uid, raw_json })
        .from(this.TABLE_NAME)
        .where('id', '=', record_id)
        .catch(() => {})
      isSuccess = updateRowCount > 0
    } else {
      // 不存在记录, 直接插入
      let insertId = await this.db
        .insert({ id, author_uid, raw_json })
        .into(this.TABLE_NAME)
        .catch(() => {})
      isSuccess = insertId > 0
    }
    return isSuccess
  }
}
