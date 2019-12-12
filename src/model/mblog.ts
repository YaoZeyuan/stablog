import Base from '~/src/model/base'
import * as TypeWeibo from '~/src/type/namespace/weibo'
import _ from 'lodash'
import moment from 'moment'
import DATE_FORMAT from '~/src/constant/date_format'

type TypeMblogRecord = {
  id: string
  author_uid: string
  raw_json: string
  post_publish_at: number
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

export default class Mblog extends Base {
  static TABLE_NAME = `total_mblog`
  static TABLE_COLUMN = [`id`, `author_uid`, `raw_json`]

  /**
   * 从数据库中获取微博记录列表
   * @param id
   */
  static async asyncGetMblogList(uid: string, startAt: number, endAt: number): Promise<Array<TypeWeibo.TypeMblog>> {
    let recordList = <Array<TypeMblogRecord>>await this.db
      .select(this.TABLE_COLUMN)
      .from(this.TABLE_NAME)
      .where('author_uid', '=', uid)
      .andWhere('post_publish_at', '>=', startAt)
      .andWhere('post_publish_at', '<=', endAt)
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

    // 按发布时间(id)排序
    mblogRecordList.sort((a, b) => {
      // 先进行排序
      // 根据接口 https://m.weibo.cn/feed/friends?max_id=4448802586999203 可以确认, id为确认时间线的关键
      let aSortBy = parseInt(a.idstr, 10)
      let bSortBy = parseInt(b.idstr, 10)
      return aSortBy! - bSortBy!
    })

    return mblogRecordList
  }

  /**
   * 获取数据库中的微博记录数分布
   * @param uid
   */
  static async asyncGetWeiboDistribution(uid: string): Promise<BlogDistributionMap> {
    let postPublishAtList = <Array<{ post_publish_at: number }>>await this.db
      .select(`post_publish_at`)
      .from(this.TABLE_NAME)
      .where('author_uid', '=', uid)
      .orderBy(`post_publish_at`, 'desc')
      .catch(() => {
        return []
      })
    let distributionMap: Map<string, Map<string, Map<string, number[]>>> = new Map()

    for (let item of postPublishAtList) {
      let publishAt = item.post_publish_at
      let YYYY = moment.unix(publishAt).format('YYYY')
      let MM = moment.unix(publishAt).format('MM')
      let DD = moment.unix(publishAt).format('DD')

      if (distributionMap.has(YYYY) === false) {
        distributionMap.set(YYYY, new Map())
      }
      let yearMap = distributionMap.get(YYYY)!
      if (yearMap.has(MM) === false) {
        yearMap.set(MM, new Map())
      }
      let monthMap = yearMap.get(MM)!
      if (monthMap.has(DD) === false) {
        monthMap.set(DD, [])
      }
      let dayList = monthMap.get(DD)!
      dayList.push(publishAt)
      monthMap.set(DD, dayList)
      yearMap.set(MM, monthMap)
      distributionMap.set(YYYY, yearMap)
    }

    let newYearMap: BlogDistributionMap = new Map()
    for (let year of distributionMap.keys()) {
      let yearCounter = 0
      let yearMap = distributionMap.get(year)!
      let newMonthMap: BlogDistributionMap = new Map()
      for (let month of yearMap.keys()) {
        let monthCounter = 0
        let monthMap = yearMap.get(month)!
        let newDayMap: BlogDistributionMap = new Map()
        for (let day of monthMap.keys()) {
          let dayCounter = monthMap.get(day)!.length
          monthCounter += dayCounter
          newDayMap.set(`${day}日`, {
            date: `${day}日`,
            key: `${year}-${month}-${day}`,
            type: 'day',
            startAt: moment(`${year}-${month}-${day}`, 'YYYY-MM-DD')
              .startOf('day')
              .unix(),
            count: dayCounter,
            childrenMap: new Map(),
          })
        }
        yearCounter += monthCounter
        newMonthMap.set(`${month}月`, {
          date: `${month}月`,
          key: `${year}-${month}`,
          type: 'month',
          startAt: moment(`${year}-${month}-01`, 'YYYY-MM-DD')
            .startOf('day')
            .unix(),
          count: monthCounter,
          childrenMap: newDayMap,
        })
      }
      newYearMap.set(`${year}年`, {
        date: `${year}年`,
        key: `${year}`,
        type: 'year',
        startAt: moment(`${year}-01-01`, 'YYYY-MM-DD')
          .startOf('day')
          .unix(),
        count: yearCounter,
        childrenMap: newMonthMap,
      })
    }
    return newYearMap
  }
}
