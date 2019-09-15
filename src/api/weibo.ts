import _ from 'lodash'
import Base from '~/src/api/base'
import * as TypeWeibo from '~/src/type/namespace/weibo'

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
    const baseUrl = `https://m.weibo.cn/api/container/getIndex?containerid=${containerId}&page_type=03&page=${page}`
    const config = {
      // containerid: containerId,
      // page_type: '03',
      // page: page,
    }
    console.log('url =>', baseUrl)
    const weiboResponse = <TypeWeibo.TypeWeiboListResponse>await Base.http.get(baseUrl, {
      params: config,
    })
    if (_.isEmpty(weiboResponse.data.cards)) {
      return []
    }
    const rawRecordList = weiboResponse.data.cards
    // 需要按cardType进行过滤, 只要id为9的(微博卡片)
    let recordList = rawRecordList.filter(item => {
      return item.card_type === 9
    })
    return recordList
  }

  /**
   * 根据微博的的bid字段获取长微博详情
   * @param bid
   */
  static async asyncGetLongTextWeibo(bid: string): Promise<TypeWeibo.TypeLongTextWeiboRecord | {}> {
    const baseUrl = `https://m.weibo.cn/statuses/show?id=${bid}`
    const config = {}
    const weiboResponse = <TypeWeibo.TypeLongTextWeiboResponse>await Base.http.get(baseUrl, {
      params: config,
    })
    if (_.isEmpty(weiboResponse.data)) {
      return {}
    }
    return weiboResponse.data
  }

  /**
   * 获取微博文章, 获取不到返回空对象
   */
  static async asyncGetWeiboArticle(url: string) {
    let responseHtml = await Base.http.get(url)
    let json: TypeWeibo.TypeWeiboArticleRecord
    try {
      let scriptContent = responseHtml.split('<router-view>')[1]
      let rawJsContent = scriptContent.split('<script>')[1]
      let jsContent = rawJsContent.split('</script>')[0]
      let rawJson = jsContent.split('var $render_data = [')[1]
      let jsonStr = rawJson.split('][0] || {};')[0]
      json = JSON.parse(jsonStr)
    } catch (e) {
      json = <TypeWeibo.TypeWeiboArticleRecord>{}
    }

    return json
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
