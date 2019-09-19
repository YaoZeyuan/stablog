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
  static async asyncGetMblogList(uid: string): Promise<Array<TypeWeibo.TypeWeiboRecord_Mblog>> {
    let recordList = <Array<TypeMblogRecord>>await this.db
      .select(this.TABLE_COLUMN)
      .from(this.TABLE_NAME)
      .where('author_uid', '=', uid)
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
}
