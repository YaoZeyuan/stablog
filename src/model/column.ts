import Base from '~/src/model/base'
import TypeColumn from '~/src/type/namespace/column'
import TypeArticleExcerpt from '~/src/type/namespace/article_excerpt'
import _ from 'lodash'

class Column extends Base {
  static TABLE_NAME = `Column`
  static TABLE_COLUMN = [`column_id`, `raw_json`]

  static COLUMN_ARTICLE_EXCERPT_TABLE_NAME = `ColumnArticleExcerpt`
  static COLUMN_ARTICLE_EXCERPT_TABLE_COLUMN = [`column_id`, `article_id`, `raw_json`]

  /**
   * 从数据库中获取专栏信息
   * @param columnId
   */
  static async asyncGetColumnInfo(columnId: string): Promise<TypeColumn.Record> {
    let recordList = await this.db
      .select(this.TABLE_COLUMN)
      .from(this.TABLE_NAME)
      .where('column_id', '=', columnId)
      .catch(() => {
        return []
      })
    let columnInfoJson = _.get(recordList, [0, 'raw_json'], '{}')
    let columnInfo
    try {
      columnInfo = JSON.parse(columnInfoJson)
    } catch {
      columnInfo = {}
    }
    return columnInfo
  }

  /**
   * 从数据库中获取专栏文章列表
   * @param columnId
   */
  static async asyncGetArticleExcerptList(columnId: string): Promise<Array<TypeArticleExcerpt.Record>> {
    let recordList = await this.db
      .select(this.COLUMN_ARTICLE_EXCERPT_TABLE_COLUMN)
      .from(this.COLUMN_ARTICLE_EXCERPT_TABLE_NAME)
      .where('column_id', '=', columnId)
      .catch(() => {
        return []
      })
    let articleExcerptRecordList = []
    for (let record of recordList) {
      let articleExcerptRecordJson = _.get(record, ['raw_json'], '{}')
      let articleExcerptRecord
      try {
        articleExcerptRecord = JSON.parse(articleExcerptRecordJson)
      } catch {
        articleExcerptRecord = {}
      }
      if (_.isEmpty(articleExcerptRecord) === false) {
        articleExcerptRecordList.push(articleExcerptRecord)
      }
    }

    return articleExcerptRecordList
  }

  /**
   * 从数据库中获取专栏文章id列表
   * @param columnId
   */
  static async asyncGetArticleIdList(columnId: string): Promise<Array<string>> {
    let recordList = await this.db
      .select(this.COLUMN_ARTICLE_EXCERPT_TABLE_COLUMN)
      .from(this.COLUMN_ARTICLE_EXCERPT_TABLE_NAME)
      .where('column_id', '=', columnId)
      .catch(() => {
        return []
      })
    let articleIdList = []
    for (let record of recordList) {
      let articleExcerptRecordJson = _.get(record, ['raw_json'], '{}')
      let articleExcerptRecord: TypeArticleExcerpt.Record
      try {
        articleExcerptRecord = JSON.parse(articleExcerptRecordJson)
      } catch {
        articleExcerptRecord = {}
      }
      if (_.isEmpty(articleExcerptRecord) === false) {
        articleIdList.push(articleExcerptRecord.id)
      }
    }

    return articleIdList
  }

  /**
   * 存储专栏数据
   * @param columnRecord
   */
  static async asyncReplaceColumnInfo(columnRecord: TypeColumn.Record): Promise<void> {
    let columnId = columnRecord.id
    let raw_json = JSON.stringify(columnRecord)
    await this.replaceInto({
      column_id: columnId,
      raw_json,
    })
    return
  }

  /**
   * 存储专栏文章列表数据
   * @param columnRecord
   */
  static async asyncReplaceColumnArticleExcerpt(columnId: string, articleExcerptRecord: TypeArticleExcerpt.Record): Promise<void> {
    let raw_json = JSON.stringify(articleExcerptRecord)
    let articleId = articleExcerptRecord.id
    await this.replaceInto(
      {
        column_id: columnId,
        article_id: articleId,
        raw_json,
      },
      this.COLUMN_ARTICLE_EXCERPT_TABLE_NAME,
    )
    return
  }
}

export default Column
