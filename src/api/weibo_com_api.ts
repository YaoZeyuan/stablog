import _ from 'lodash'
import Base from '~/src/api/base'
import * as TypeNewWeiboApi from '~/src/type/namespace/new_weibo_api_com'

// 微博.com的API和.cn的API公用一套cookie(XSRF-TOKEN & SUB 两项), 因此可以直接调用
export default class WeiboComApi extends Base {
  // /**
  //  * 根据微博的的bid字段获取长微博文本内容
  //  * @param bid
  //  */
  // static async asyncGetLongTextWeibo(bid: string): Promise<string> {
  //   const baseUrl = `https://weibo.com/ajax/statuses/longtext?id=${bid}`
  //   const weiboResponse = <TypeNewWeiboApi.TypeWeiboApi_LongText_Response>await Base.http.get(baseUrl)
  //   let content = weiboResponse?.data?.longTextContent || ""
  //   return content
  // }

  /**
  * 获取用户微博列表
  * demo => https://m.weibo.cn/api/container/getIndex?containerid=2304131668244557_-_WEIBO_SECOND_PROFILE_WEIBO&page_type=03&page=2
  * @param author_uid
  * @param page
  */
  static async asyncStep3GetWeiboList(
    author_uid: string,
    page: number = 1,
  ): Promise<Array<TypeNewWeiboApi.TypeWeiboApi_MyBlob_Item>> {
    const baseUrl = `https://weibo.com/ajax/statuses/mymblog?uid=${author_uid}&page=${page}&feature=0`
    const config = {}
    // console.log('url =>', baseUrl)
    let weiboResponse = <TypeNewWeiboApi.TypeWeiboApi_MyBlob_ListResponse>await Base.http
      .get(baseUrl, {
        params: config,
        headers: {
          Accept: 'application/json, text/plain, */*',
        },
      })
      .catch(e => {
        return undefined
      })
    if (_.isEmpty(weiboResponse?.data?.list)) {
      return []
    }
    const rawRecordList = weiboResponse?.data?.list || []
    return rawRecordList
  }
}
