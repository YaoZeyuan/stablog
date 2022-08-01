import Base from '~/src/model/base'
import * as TypeWeibo from '~/src/type/namespace/weibo'
import _ from 'lodash'
import dayjs from 'dayjs'
import DATE_FORMAT from '~/src/constant/date_format'

type TypeMblogRecord = {
  id: string
  author_uid: string
  raw_json: string
  post_publish_at: number
  is_retweet: number
  is_article: number
}

type BlogDistributionMap = Map<
  string,
  {
    date: string
    key: string
    type: 'year' | 'month' | 'day'
    startAt: number
    count: number
    childrenMap: BlogDistributionMap
  }
>


type BlogDistributionObj = {
  [key: string]: {
    date: string
    key: string
    type: 'year' | 'month' | 'day'
    startAt: number
    count: number
    childrenMap: BlogDistributionObj
  }
}

export default class Mblog extends Base {
  static TABLE_NAME = `total_mblog`
  static TABLE_COLUMN = [`id`, `author_uid`, `post_publish_at`, `is_retweet`, `is_article`, `raw_json`]

  // 更新数据库数据
  // static async autoUpdate() {
  //   let recordList = <Array<TypeMblogRecord>>await this.db
  //     .select(this.TABLE_COLUMN)
  //     .from(this.TABLE_NAME)
  //   // .where('author_uid', '=', '2656274875')
  //   console.log("total record count => ", recordList.length)
  //   for (let i = 0; i < recordList.length; i++) {
  //     if (i % 10 === 0) {
  //       console.log(`处理第${i}/${recordList.length}条数据`)
  //     }
  //     let record = recordList[i];
  //     let mblog = JSON.parse(record.raw_json)
  //     let is_retweet = mblog.retweeted_status ? 1 : 0
  //     let is_article = mblog.article ? 1 : 0
  //     record.is_article = is_article
  //     record.is_retweet = is_retweet
  //     await this.replaceInto(record, this.TABLE_NAME)
  //   }

  //   return
  // }

  /**
   * 获取数据库中已缓存的记录列表
   * @param uid 
   * @returns 
   */
  static async asyncGetMblogSaveCount(uid: string) {
    let resultList = <Array<any>>await this.db
      .count('*')
      .from(this.TABLE_NAME)
      .where('author_uid', '=', uid)
      .catch((e) => {
        console.log("e =>", e)
        return []
      })
    let total_count = resultList?.[0]?.['count(*)'] || 0
    return total_count
  }

  /**
   * 从数据库中获取微博记录列表
   * @param id
   */
  static async asyncGetMblogList(uid: string, startAt: number, endAt: number, retweet_status_in = [0, 1], article_status_in = [0, 1]): Promise<Array<TypeWeibo.TypeMblog>> {
    let recordList = <Array<TypeMblogRecord>>await this.db
      .select(this.TABLE_COLUMN)
      .from(this.TABLE_NAME)
      .where('author_uid', '=', uid)
      .andWhere('post_publish_at', '>=', startAt)
      .andWhere('post_publish_at', '<=', endAt)
      .whereIn('is_retweet', retweet_status_in)
      .whereIn('is_article', article_status_in)
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

    mblogRecordList.sort((a, b) => {
      // 先进行排序
      // 根据接口 https://m.weibo.cn/feed/friends?max_id=4448802586999203 可以确认, id为确认时间线的关键
      // 经测试, 仅通过id并不靠谱, 因此还是要使用发布日期作为排序依据.
      // 同一日期内再用id排序
      let aSortBy = a.created_timestamp_at
      let bSortBy = b.created_timestamp_at
      if (a.created_timestamp_at === b.created_timestamp_at) {
        // 日期相同时, 以id作为排序依据
        aSortBy = parseInt(a.id)
        bSortBy = parseInt(b.id)
      }
      return aSortBy! - bSortBy!
    })

    return mblogRecordList
  }

  /**
   * 获取数据库中的微博记录数分布
   * @param uid
   */
  static async asyncGetWeiboDistribution(uid: string): Promise<BlogDistributionObj> {
    let postPublishAtList = <Array<{ post_publish_at: number }>>await this.db
      .select(`post_publish_at`)
      .from(this.TABLE_NAME)
      .where('author_uid', '=', uid)
      .orderBy(`post_publish_at`, 'desc')
      .catch(() => {
        return []
      })
    let distributionMap: Map<string, Map<string, Map<string, number[]>>> = new Map()
    // 使用map在前端会出现返回数据不及时的问题, 因此改为使用对象
    let distributionObj: {
      [year: string]: {
        // 增加publish_start_at字段, 方便前端排序
        "publish_start_at": number,
        datbase: {
          [month: string]: {
            // 增加publish_start_at字段, 方便前端排序
            "publish_start_at": number,
            "database": {
              [day: string]: {
                "publish_start_at": number,
                database: number[]
              }
            }
          }
        }
      }
    } = {}

    for (let item of postPublishAtList) {
      let publishAt = item.post_publish_at
      let YYYY = dayjs.unix(publishAt).format('YYYY')
      let MM = dayjs.unix(publishAt).format('MM')
      let DD = dayjs.unix(publishAt).format('DD')

      if (distributionObj[YYYY] === undefined) {
        distributionObj[YYYY] = {
          "publish_start_at": dayjs.unix(publishAt).startOf("year").unix(),
          datbase: {}
        }
      }

      let yearDatabase = distributionObj[YYYY].datbase

      // let yearMap = distributionMap.get(YYYY)!
      if (yearDatabase[MM] === undefined) {
        yearDatabase[MM] = {
          "publish_start_at": dayjs.unix(publishAt).startOf("month").unix(),
          database: {},
        }
      }
      let monthDatabase = distributionObj[YYYY].datbase[MM].database

      if (monthDatabase[DD] === undefined) {
        monthDatabase[DD] = {
          "publish_start_at": dayjs.unix(publishAt).startOf("day").unix(),
          database: [],
        }
      }

      let dayList = monthDatabase[DD].database

      dayList.push(publishAt)
      monthDatabase[DD].database = dayList
      yearDatabase[MM].database = monthDatabase
      distributionObj[YYYY].datbase = yearDatabase
    }

    let newYearObj: BlogDistributionObj = {}
    for (let year of Object.keys(distributionObj)) {
      let yearCounter = 0
      let yearObj = distributionObj[year]
      let newMonthObj: BlogDistributionObj = {}
      for (let month of Object.keys(yearObj.datbase)) {
        let monthCounter = 0
        let monthObj = yearObj.datbase[month]
        let newDayObj: BlogDistributionObj = {}
        for (let day of Object.keys(monthObj.database)) {
          let dayCounter = monthObj.database[day].database.length
          monthCounter += dayCounter
          newDayObj[`${day}日`] = {
            date: `${day}日`,
            key: `${year}-${month}-${day}`,
            type: 'day',
            startAt: dayjs(`${year}-${month}-${day}`, 'YYYY-MM-DD')
              .startOf('day')
              .unix(),
            count: dayCounter,
            childrenMap: {},
          }
        }
        yearCounter += monthCounter
        newMonthObj[`${month}月`] = {
          date: `${month}月`,
          key: `${year}-${month}`,
          type: 'month',
          startAt: dayjs(`${year}-${month}-01`, 'YYYY-MM-DD')
            .startOf('day')
            .unix(),
          count: monthCounter,
          childrenMap: newDayObj,
        }
      }
      newYearObj[`${year}年`] = {
        date: `${year}年`,
        key: `${year}`,
        type: 'year',
        startAt: dayjs(`${year}-01-01`, 'YYYY-MM-DD')
          .startOf('day')
          .unix(),
        count: yearCounter,
        childrenMap: newMonthObj,
      }
    }

    return newYearObj
  }
}
