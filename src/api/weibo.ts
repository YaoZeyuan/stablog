import _ from 'lodash'
import Base from '~/src/api/base'
import * as TypeWeibo from '~/src/type/namespace/weibo'
import moment from 'moment'

export default class Weibo extends Base {
  /**
   * 获取用户活动列表
   * https://www.zhihu.com/api/v4/members/404-Page-Not-found/activities?limit=10&after_id=1547034952&desktop=True
   * @param url_token
   * @param afterTimeAt 从X时间后
   * @param limit
   * @param sortBy
   */
  static async asyncGetWeiboList(
    containerId: string = '2304131245161127_-_WEIBO_SECOND_PROFILE_WEIBO',
    page_type: string = '03',
    page: number = 0,
  ): Promise<Array<TypeWeibo.TypeWeiboRecord>> {
    const baseUrl = `view-source:https://m.weibo.cn/api/container/getIndex`
    const config = {
      containerid: containerId,
      page_type: page_type,
      page: page,
    }
    const weiboResponse = await Base.http.get(baseUrl, {
      params: config,
    })
    const recordList = _.get(weiboResponse, ['data', 'cards'], [])
    return recordList
  }

  static async asyncGetUserInfo(uid: string) {
    const baseUrl = `https://m.weibo.cn/api/container/getIndex`
    const config = {
      type: 'uid',
      value: uid,
      containerid: 1005051245161127,
    }
    const record = await Base.http.get(baseUrl, {
      params: config,
    })
    const activityList = _.get(record, ['data'], [])
    return activityList
  }
}
