import Base from '~/src/model/base'
import * as TypeWeibo from '~/src/type/namespace/weibo'
import _ from 'lodash'
import dayjs from 'dayjs'
import DATE_FORMAT from '~/src/constant/date_format'

type TypeFetchErrorRecord = {
  id: number;
  author_uid: string;
  resource_type: 'weibo_page' | 'long_text_weibo' | 'article'
  long_text_weibo_id: string;
  article_url: string;
  lastest_page_mid: string;
  lastest_page_offset: number;
  error_info_json: string;
  debug_info_json: string;
  mblog_json: string;
}

export default class FetchErrorRecord extends Base {
  static TABLE_NAME = `fetch_error_record`
  static TABLE_COLUMN = [
    // `id`,
    `author_uid`,
    `resource_type`,
    `long_text_weibo_id`,
    `article_url`,
    `lastest_page_mid`,
    `lastest_page_offset`,
    `error_info_json`,
    `debug_info_json`,
    `mblog_json`
  ]

  /**
   * 获取抓取失败的数据列表
   * @param uid 
   * @returns 
   */
  static async asyncGetErrorRecordList(author_uid: string) {
    let resultList = <TypeFetchErrorRecord[]>await this.db
      .select('*')
      .from(this.TABLE_NAME)
      .where('author_uid', '=', author_uid)
      .catch((e) => {
        console.log("e =>", e)
        return []
      })
    return resultList
  }

  /**
   * 获取抓取失败的分项记录数
   * @param uid 
   * @returns 
   */
  static async asyncGetErrorDistributionCount(author_uid: string) {
    let resultList = <{
      resource_type: string
      'count(*)': number
    }[]>await this.db
      .count('*')
      .select('resource_type')
      .from(this.TABLE_NAME)
      .where('author_uid', '=', author_uid)
      .groupBy("resource_type")
      .catch((e) => {
        console.log("e =>", e)
        return []
      })
    return resultList.map(item => {
      return {
        resource_type: item.resource_type,
        count: item['count(*)']
      }
    })
  }


  static async asyncAddErrorRecord({
    author_uid,
    resource_type,
    long_text_weibo_id,
    article_url,
    lastest_page_mid,
    lastest_page_offset,
    debug_info_json = '{}',
    error_info_json = '{}',
    mblog_json = '{}',
  }: {
    author_uid: string
    resource_type: 'weibo_page' | 'long_text_weibo' | 'article';
    long_text_weibo_id: string;
    article_url: string;
    lastest_page_mid: string;
    lastest_page_offset: number;
    debug_info_json?: string
    error_info_json?: string
    mblog_json: string
  }) {
    let resultList = <TypeFetchErrorRecord[]>await this.replaceInto({
      author_uid,
      resource_type,
      long_text_weibo_id,
      article_url,
      lastest_page_mid,
      lastest_page_offset,
      error_info_json,
      debug_info_json,
      mblog_json
    })
    return resultList
  }

  static async asyncRemoveErrorRecord({
    author_uid,
    resource_type,
    long_text_weibo_id,
    article_url,
    lastest_page_mid,
    lastest_page_offset,
  }: {
    author_uid: string
    resource_type: string;
    long_text_weibo_id: string;
    article_url: string;
    lastest_page_mid: string;
    lastest_page_offset: number;
  }) {
    let resultList = <TypeFetchErrorRecord[]>await this.db
      .delete()
      .from(this.TABLE_NAME)
      .where('author_uid', '=', author_uid)
      .andWhere('resource_type', '=', resource_type,)
      .andWhere('long_text_weibo_id', '=', long_text_weibo_id,)
      .andWhere('article_url', '=', article_url,)
      .andWhere('lastest_page_mid', '=', lastest_page_mid,)
      .andWhere('lastest_page_offset', '=', lastest_page_offset,)
      .catch((e) => {
        console.log("e =>", e)
        return []
      })
    return resultList
  }

}
