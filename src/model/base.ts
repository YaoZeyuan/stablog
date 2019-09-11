import Knex from '~/src/library/knex'
import TypeKnex from 'knex'
import _ from 'lodash'

class Base {
  static TABLE_NAME = ``
  static TABLE_COLUMN: Array<string>
  static PRIMARY_KEY = ``

  /**
   * 获取sqlite客户端
   */
  static get db() {
    return Knex.queryBuilder()
  }

  /**
   * 获取sqlite客户端
   */
  static get rawClient(): TypeKnex {
    return Knex
  }

  /**
   * 手工拼接replaceInto语句
   * @param{object} data
   */
  static replaceInto(data: object, tableName = this.TABLE_NAME) {
    let columnList = []
    let markList = []
    let valueList = []
    for (let key of Object.keys(data)) {
      columnList.push(`\`${key}\``)
      markList.push(`?`)
      valueList.push(_.get(data, [key], ''))
    }
    let rawSql = `
        REPLACE INTO ${tableName} (${columnList.join(',')}) VALUES (${markList.join(',')})
        `
    return Knex.raw(rawSql, valueList)
  }
}

export default Base
