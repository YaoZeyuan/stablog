import _ from 'lodash'
import Base from '~/src/api/base'
import TypeActivity from '~/src/type/namespace/activity'
import moment from 'moment'

class Activity extends Base {
  /**
   * 获取用户活动列表
   * https://www.zhihu.com/api/v4/members/404-Page-Not-found/activities?limit=10&after_id=1547034952&desktop=True
   * @param url_token
   * @param afterTimeAt 从X时间后
   * @param limit
   * @param sortBy
   */
  static async asyncGetAutherActivityList(
    url_token: string,
    afterTimeAt: number = 0,
    limit: number = 20,
  ): Promise<Array<TypeActivity.Record>> {
    const baseUrl = `https://www.zhihu.com/api/v4/members/${url_token}/activities`
    const config = {
      after_id: afterTimeAt,
      limit: limit,
      desktop: 'True',
    }
    const record = await Base.http.get(baseUrl, {
      params: config,
    })
    const activityList = _.get(record, ['data'], [])
    return activityList
  }

  /**
   * 检查指定时间后是否还有用户活跃记录
   * @param url_token
   * @param afterTimeAt 从X时间后
   */
  static async asyncCheckHasAutherActivityAfterAt(url_token: string, afterTimeAt: number = 0): Promise<boolean> {
    const baseUrl = `https://www.zhihu.com/api/v4/members/${url_token}/activities`
    const config = {
      after_id: afterTimeAt,
      limit: 10,
      desktop: 'True',
    }
    const record = await Base.http.get(baseUrl, {
      params: config,
    })
    const hasActivity = _.get(record, ['paging', 'is_end'], false)
    return hasActivity === false
  }

  /**
   * 获取用户最近一次活跃时间
   * @param url_token
   */
  static async asyncGetAutherLastActivityAt(url_token: string): Promise<number> {
    const baseUrl = `https://www.zhihu.com/api/v4/members/${url_token}/activities`
    let now = moment().unix()
    const config = {
      after_id: now,
      limit: 10,
      desktop: 'True',
    }
    const record = await Base.http.get(baseUrl, {
      params: config,
    })
    let lastActivityMsAt = _.get(record, ['data', 0, 'id'], 0)
    let lastActivityAt = lastActivityMsAt / 1000 // 取到的id是毫秒值, 因此需要除以1000
    if (lastActivityAt <= 0) {
      lastActivityAt = now
    }
    return lastActivityAt
  }
}
export default Activity
