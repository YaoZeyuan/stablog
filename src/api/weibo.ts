import _ from 'lodash'
import Base from '~/src/api/base'
import * as TypeWeibo from '~/src/type/namespace/weibo'
import Util from '~/src/library/util/common'
import dayjs from 'dayjs'

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
   * 仅为抓取微博而设.
   * 第一步, 获取初始st配置
   */
  static async asyncStep1FetchPageConfigSt() {
    let url = 'https://m.weibo.cn/p/index'
    let responseHtml = await Base.http.get(url)
    let st = ''
    try {
      let scriptContent = responseHtml.split('<router-view>')[1]
      let rawJsContent = scriptContent.split('<script>')[1]
      let jsContent = rawJsContent.split('</script>')[0]
      let rawJson = jsContent.split('var config = ')[1]
      let jsonStr = rawJson.split('var $render_data ')[0]
      let rawStStartStr = jsonStr.split(`st:`)[1]
      let rawStStr = rawStStartStr.split(`,`)[0]
      st = rawStStr.replace(/"|'| /g, '')
    } catch (e) { }
    return st
  }
  static async asyncStep2FetchApiConfig(st: string) {
    let url = 'https://m.weibo.cn/api/config'
    let responseConfig = await Base.http.get(url, {
      headers: {
        Accept: 'application/json, text/plain, */*',
        'MWeibo-Pwa': 1,
        'Sec-Fetch-Mode': 'cors',
        'X-Requested-With': 'XMLHttpRequest',
        'X-XSRF-TOKEN': st,
      },
    })
    let newSt: string = _.get(responseConfig, ['data', 'st'], '')
    return newSt
  }

  /**
   * 获取用户微博列表
   * demo => https://m.weibo.cn/api/container/getIndex?containerid=2304131668244557_-_WEIBO_SECOND_PROFILE_WEIBO&page_type=03&page=2
   * @param author_uid
   * @param page
   */
  static async asyncStep3GetWeiboList(
    st: string,
    author_uid: string,
    page: number = 1,
  ): Promise<Array<TypeWeibo.TypeWeiboRecord>> {
    let containerId = `${Total_Mblog_Container_Id}${author_uid}_-_WEIBO_SECOND_PROFILE_WEIBO`
    const baseUrl = `https://m.weibo.cn/api/container/getIndex?containerid=${containerId}&page_type=03&page=${page}`
    const config = {
      // containerid: containerId,
      // page_type: '03',
      // page: page,
    }
    // console.log('url =>', baseUrl)
    let weiboResponse = <TypeWeibo.TypeWeiboListResponse>await Base.http
      .get(baseUrl, {
        params: config,
        headers: {
          accept: 'application/json, text/plain, */*',
          'mweibo-pwa': 1,
          'sec-fetch-mode': 'cors',
          'x-requested-with': 'XMLHttpRequest',
          'x-xsrf-token': st,
          'referer': `https://m.weibo.cn/p/${Total_Mblog_Container_Id}${author_uid}_-_WEIBO_SECOND_PROFILE_WEIBO`,
        },
      })
      .catch((e) => {
        return undefined
      })
    if (_.isEmpty(weiboResponse?.data?.cards)) {
      return []
    }
    const rawRecordList = weiboResponse?.data?.cards || []
    // 需要按cardType进行过滤, 只要id为9的(微博卡片)
    let recordList = rawRecordList.filter((item) => {
      return item.card_type === 9
    })
    return recordList
  }

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
    let recordList = rawRecordList.filter((item) => {
      return item.card_type === 9
    })
    return recordList
  }
  /**
   * 获取用户微博总数
   * 微博列表中用户信息的total可能不准, 因此使用cardlistInfo中的字段
   */
  static async asyncGetWeiboCount({ author_uid, st }: { author_uid: string; st: string }): Promise<number> {
    const baseUrl = `https://m.weibo.cn/profile/info`
    const config = {
      uid: author_uid,
    }
    const rawResponse = <TypeWeibo.Type_Profile_Info>await Base.http.get(baseUrl, {
      params: config,
      headers: {
        'x-requested-with': 'XMLHttpRequest',
        'x-xsrf-token': st,
        referer: `https://m.weibo.cn/profile/${author_uid}`,
      },
    })
    const responseData = rawResponse.data
    return responseData.user.statuses_count
  }

  /**
   * 根据微博的的bid字段获取长微博详情
   * @param bid
   */
  static async asyncGetLongTextWeibo({ bid, st }: {
    bid: string,
    st: string
  }): Promise<TypeWeibo.TypeMblog | {}> {
    const baseUrl = `https://m.weibo.cn/statuses/show?id=${bid}`
    const config = {}
    const weiboResponse = <TypeWeibo.TypeLongTextWeiboResponse>await Base.http.get(baseUrl, {
      params: config,
      headers: {
        'mweibo-pwa': 1,
        'sec-fetch-mode': 'cors',
        'x-requested-with': 'XMLHttpRequest',
        'x-xsrf-token': st,
        'referer': `https://m.weibo.cn/detail/${bid}`
      }
    })
    if (_.isEmpty(weiboResponse.data)) {
      return {}
    }
    return weiboResponse.data
  }

  /**
   * 获取微博文章, 获取不到返回空对象
   */
  static async asyncGetWeiboArticle(articleId: string) {
    let apiUrl = `https://card.weibo.com/article/m/aj/detail?id=${articleId}&_t=${dayjs().unix()}`
    let articleUrl = `https://card.weibo.com/article/m/show/id/${articleId}`

    let response = await Base.http.get(apiUrl, {
      headers: {
        Referer: articleUrl,
      },
    })
    let json: TypeWeibo.TypeWeiboArticleRecord = _.get(response, ['data'], {})
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
