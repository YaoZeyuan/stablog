import Base from '~/src/model/base'
import TypeWeibo from '~/src/type/namespace/weibo'
import _ from 'lodash'
import DATE_FORMAT from '~/src/constant/date_format'
import Mblog from '~/src/model/mblog'

type TypeMblogUserRecord = {
  author_uid: string
  raw_json: string
}

export default class MblogUser extends Base {
  static TABLE_NAME = `total_user`
  static TABLE_COLUMN = [`author_uid`, `raw_json`]

  /**
   * 获取数据库中的用户列表
   * @param author_uid
   */
  static async asyncGetUserList(): Promise<TypeWeibo.TypeWeiboUserInfo[]> {
    let rawRecordList = <Array<TypeMblogUserRecord>>await this.db
      .select(this.TABLE_COLUMN)
      .from(this.TABLE_NAME)
      .catch(() => {
        return []
      })
    let recordList = []
    for (let rawItem of rawRecordList) {
      let record = JSON.parse(rawItem.raw_json)
      let author_uid = rawItem.author_uid
      let mblog_save_count = await Mblog.asyncGetMblogSaveCount(author_uid)
      record.mblog_save_count = mblog_save_count
      recordList.push(record)
    }
    return recordList
  }
  /**
   * 从数据库中获取微博记录列表
   * @param id
   */
  static async asyncGetUserInfo(author_uid: string): Promise<TypeWeibo.TypeWeiboUserInfo> {
    let recordList = <Array<TypeMblogUserRecord>>await this.db
      .select(this.TABLE_COLUMN)
      .from(this.TABLE_NAME)
      .where('author_uid', '=', author_uid)
      .catch(() => {
        return []
      })
    if (recordList.length === 0) {
      // @ts-ignore
      return {}
    }
    // 只可能取到一条记录
    let record = recordList[0]

    let userInfo = JSON.parse(record.raw_json)
    return userInfo
  }
}
