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
    let st = ''
    try {
      let responseHtml = await Base.http.get(url)
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
    }).catch(e => { return {} })
    let newSt: string = responseConfig?.['data']?.['st'] ?? ''
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
  ): Promise<{
    recordList: TypeWeibo.TypeWeiboRecord[],
    isSuccess: boolean,
    errorInfo: any
  }> {
    let containerId = `${Total_Mblog_Container_Id}${author_uid}_-_WEIBO_SECOND_PROFILE_WEIBO`
    const baseUrl = `https://m.weibo.cn/api/container/getIndex?containerid=${containerId}&page_type=03&page=${page}`
    const config = {
      // containerid: containerId,
      // page_type: '03',
      // page: page,
    }
    // console.log('url =>', baseUrl)
    let weiboResponse: TypeWeibo.TypeWeiboListResponse = {} as any
    try {
      weiboResponse = <TypeWeibo.TypeWeiboListResponse>await Base.http
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
    } catch (e) {
      const errorInfo = e as Error
      return {
        recordList: [],
        isSuccess: false,
        errorInfo: {
          message: errorInfo.message,
          stack: errorInfo.stack
        }
      }
    }

    if (_.isEmpty(weiboResponse?.data?.cards)) {
      return {
        recordList: [],
        isSuccess: weiboResponse?.msg === '这里还没有内容',
        errorInfo: {}
      }
    }
    const rawRecordList = weiboResponse?.data?.cards || []
    // 需要按cardType进行过滤, 只要id为9的(微博卡片)
    let recordList = rawRecordList.filter((item) => {
      return item.card_type === 9
    })
    return {
      recordList,
      isSuccess: true,
      errorInfo: {}
    }
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
    }).catch(e => { return {} })
    const rawRecordList = weiboResponse?.data?.cards ?? []
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
    }).catch(e => {
      this.logger.log(`网络请求失败, 您的账号可能因抓取频繁被认为有风险, 请6小时后再试`)
      this.logger.log(`错误内容=> message:${e.message}, stack=>${e.stack}`)
      // 避免由于status不存在导致进程退出
      let errorStatus = _.get(e, ['response', 'status'], '')
      if (errorStatus === 404) {
        return undefined
      }

      return {}
    })
    const responseData = rawResponse?.data ?? {}
    return responseData?.user?.statuses_count ?? 0
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
    // 如果
    let apiUrl = `https://card.weibo.com/article/m/aj/detail?id=${articleId}&_t=${dayjs().unix()}`
    let articleUrl = `https://card.weibo.com/article/m/show/id/${articleId}`
    let isOldArticle = false
    if (articleId.startsWith("100160")) {
      // 微博文章在2015-06附近进行了改版, 旧版示例id为1001603981142553395587, 新版示例id为2309403992391940965443
      isOldArticle = true
      apiUrl = `https://card.weibo.com/article/aj/articleshow?cid=${articleId}&_=${dayjs().unix()}`
      articleUrl = `https://card.weibo.com/article/h5/s`
    }

    let response = await Base.http.get(apiUrl, {
      headers: {
        Referer: articleUrl,
      },
    })
    let json: TypeWeibo.TypeWeiboArticleRecord = _.get(response, ['data'], {})
    if (isOldArticle) {
      const oldArticleConfig = json as unknown as TypeWeibo.TypeWeiboArticleRecordOld
      const defaultTitleImage = 'https://ww4.sinaimg.cn/crop.0.0.1280.719.1000.562/006cSmwjgw1f5e8xstgc4j30zk0k0whp.jpg'
      // 需要将旧字段处理成新文章字段
      json = {
        "object_id": "1022:2309404958925064634396",
        "vuid": 7305723493,
        "uid": 7801436496,
        "cover_img": {
          "image": {
            "url": oldArticleConfig.config.image ?? defaultTitleImage,
            "height": 450,
            "width": 800
          },
          "full_image": {
            "url": oldArticleConfig.config.image ?? defaultTitleImage,
            "height": 562,
            "width": 1000
          }
        },
        "target_url": `https://weibo.com/p/${articleId}}`,
        "title": oldArticleConfig.title,
        "create_at": '2015-01-01',
        "read_count": oldArticleConfig.config.read_count,
        "summary": oldArticleConfig.config.desc,
        "writer": [],
        "ourl": "",
        "url": `https://weibo.com/p/${articleId}}`,
        "is_pay": 0,
        "is_reward": 0,
        "is_vclub": 0,
        "is_original": 0,
        "pay_status": 0,
        "follow_to_read": 1,
        "userinfo": {
          "uid": Number.parseInt(oldArticleConfig.config.uid),
          "id": Number.parseInt(oldArticleConfig.config.uid),
          "screen_name": oldArticleConfig.config.author,
          "description": "",
          "followers_count": 0,
          "friends_count": 78,
          "verified": false,
          "verified_type": 1,
          "verified_type_ext": 1,
          "verified_reason": "",
          "avatar_large": "https://tvax2.sinaimg.cn/crop.0.0.996.996.180/008vY20Uly8hbuu0rz23xj30ro0ro750.jpg?KID=imgbed,tva&Expires=1729790414&ssig=e33S6uSCOG",
          "profile_image_url": "https://tvax2.sinaimg.cn/crop.0.0.996.996.50/008vY20Uly8hbuu0rz23xj30ro0ro750.jpg?KID=imgbed,tva&Expires=1729790414&ssig=vKXOlLj4Xj",
          "cover_image": "",
          "cover_image_phone": "https://ww1.sinaimg.cn/crop.0.0.640.640.640/549d0121tw1egm1kjly3jj20hs0hsq4f.jpg",
          "following": false,
          "mbtype": 12,
          "mbrank": 4,
          "url": `https://weibo.com/u/${oldArticleConfig.config.uid}`,
          "target_url": `https://weibo.com/u/${oldArticleConfig.config.uid}`,
          "scheme_url": "sinaweibo://userinfo?uid=7801436496",
          "is_vclub": 0,
          "is_vclub_gold": 0
        },
        "content": '',
        "is_import": 0,
        "is_repost_to_share": 0,
        "reward_data": {
          "seller": 7801436496,
          "bid": 1000207805,
          "oid": oldArticleConfig.config.cid,
          "access_type": "mobileLayer",
          "share": 1,
          "sign": "e804514b328d78962719e3b9649bb429",
        },
        "copyright": 0,
        "mid": oldArticleConfig.config.cid,
        "is_word": 1,
        "article_browser": 1,
        "scheme_url": "sinaweibo://articlebrowser?object_id=1022:2309404958925064634396&url=https%3A%2F%2Fcard.weibo.com%2Farticle%2Fm%2Fshow%2Fid%2F2309404958925064634396",
        "article_recommend": [],
        "article_recommend_info": {
          "type": 1
        },
        "ignore_read_count": 0,
        "is_new_style": 1,
        "card_list": [],
        "object_info": [],
        "extra": null,
        "article_type": "v3_h5",
        "history": "",
        "origin_oid": "",
        "update_at": "",
        "show_edit": 0,
        "pay_info": [],
        "pay_info_ext": [],
        "pay_edit_tips": "",
        "pay_data": {
          "version": "531294344d21a6d3",
          "ua": "h5",
          "vuid": 7801436496,
          "body_btn": [],
          "footer_btn": [],
        },
        "is_checking": null,
        "real_oid": null,
        "hide_share_button": 0,
        "hide_repost_button": 0,
        "article_fingerprinting": "f8a66a53c0cf5b726a6703d83df4fdd9",
        "is_follow": 0
      }
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
