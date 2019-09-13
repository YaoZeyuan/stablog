import _ from 'lodash'
import Base from '~/src/api/base'
import * as TypeWeibo from '~/src/type/namespace/weibo'
import moment from 'moment'

/**
 * 用户信息部分容器 id
 * 容器id为固定前缀, 容器id + 用户uid即为最终请求的数据, 可以考虑提取到配置接口中
 */
const UserInfo_Container_ID = 100505
/**
 * 全部微博容器 id
 */
const Total_Mblog_Container_Id = 230413

export default class Weibo extends Base {
  /**
   * 获取用户微博列表
   * demo => https://m.weibo.cn/api/container/getIndex?containerid=2304131668244557_-_WEIBO_SECOND_PROFILE_WEIBO&page_type=03&page=2
   * @param author_uid
   * @param page
   */
  static async asyncGetWeiboList(author_uid: string, page: number = 1): Promise<Array<TypeWeibo.TypeWeiboRecord>> {
    let containerId = `${Total_Mblog_Container_Id}${author_uid}_-_WEIBO_SECOND_PROFILE_WEIBO`
    const baseUrl = `https://m.weibo.cn/api/container/getIndex`
    const config = {
      containerid: containerId,
      page_type: '03',
      page: page,
    }
    const weiboResponse = <TypeWeibo.TypeWeiboListResponse>await Base.http.get(baseUrl, {
      params: config,
    })
    if (_.isEmpty(weiboResponse.data.cards)) {
      return []
    }
    const recordList = weiboResponse.data.cards
    return recordList
  }

  /**
   * 首次请求, 先获取用户信息
   * demo => https://m.weibo.cn/api/container/getIndex?uid=1221171697&containerid=1005051221171697
   * @param author_uid
   */
  static async asyncGetUserInfoResponseData(author_uid: string) {
    const baseUrl = `https://m.weibo.cn/api/container/getIndex`
    const config = {
      type: 'uid',
      value: author_uid,
      containerid: `${UserInfo_Container_ID}${author_uid}`,
    }
    const rawResponse = <TypeWeibo.TypeUserInfoResponse>await Base.http.get(baseUrl, {
      params: config,
    })
    const responseData = rawResponse.data
    return responseData
  }
}
