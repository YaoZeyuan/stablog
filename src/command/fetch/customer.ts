import Base from '~/src/command/fetch/base'
import TypeTaskConfig from '~/src/type/namespace/task_config'
import PathConfig from '~/src/config/path'
import fs from 'fs'
import _ from 'lodash'
import json5 from 'json5'
import dayjs from 'dayjs'

import ApiWeibo from '~/src/api/weibo'
import MMblog from '~/src/model/mblog'
import MMblogUser from '~/src/model/mblog_user'
import MFetchErrorRecord from '~/src/model/fetch_error_record'
import CommonUtil from '~/src/library/util/common'
import * as TypeWeibo from '~/src/type/namespace/weibo'
import Util from '~/src/library/util/common'
import querystring from 'query-string'
// dayjs需要安装插件后, 才能支持识别复杂文本串
import customParseFormat from 'dayjs/plugin/customParseFormat'
dayjs.extend(customParseFormat)

/**
 * weibo.com的新Api对应的创建时间解析格式字符串
 */
const Const_DayJs_Parse_Format_4_WeiboComApi = 'MMM DD HH:mm:ss Z YYYY'
/**
 * 重试时的等待时间
 */
const Const_Retry_Wait_Seconds = 30
/**
 * 正常执行抓取流程的等待时间
 */
const Const_Fetch_Wati_Seconds = 20

/**
 * 解析微博文章id，方便构造api, 抓取文章内容
 * @param rawUrl
 * 原始
 * rawurl格式 => https://m.weibo.cn/feature/applink?scheme=sinaweibo%3A%2F%2Farticlebrowser%3Fobject_id%3D1022%253A2309404446645566701785%26url%3Dhttps%253A%252F%252Fcard.weibo.com%252Farticle%252Fm%252Fshow%252Fid%252F2309404446645566701785%253F_wb_client_%253D1%26extparam%3Dlmid--4446645569803228&luicode=10000011&lfid=2304131913094142_-_WEIBO_SECOND_PROFILE_WEIBO
 * 解码后=>  https://m.weibo.cn/feature/applink?scheme=sinaweibo://articlebrowser?object_id=1022:2309404446645566701785&url=https://card.weibo.com/article/m/show/id/2309404446645566701785?_wb_client_=1&extparam=lmid--4446645569803228&luicode=10000011&lfid=2304131913094142_-_WEIBO_SECOND_PROFILE_WEIBO
 * 2021年3月28日新增
 * rawurl格式 => https://weibo.com/ttarticle/p/show?id=2309404619352241471539&luicode=10000011&lfid=2304131221171697_-_WEIBO_SECOND_PROFILE_WEIBO
 * 2024年10月22日新增
 * http://weibo.com/p/1001603893058344251505?luicode=20000174
 */
function getArticleId(rawUrl = '') {
  if (!rawUrl) {
    return ''
  }
  // 需要多次解析，才能将url完全解码成正常文本
  let decodeUrl = unescape(unescape(unescape(rawUrl)))
  if (!decodeUrl) {
    return ''
  }
  if (decodeUrl.includes('id=') && decodeUrl.includes('/ttarticle/p/show')) {
    // 说明是新格式 https://weibo.com/ttarticle/p/show?id=2309404619352241471539&luicode=10000011&lfid=2304131221171697_-_WEIBO_SECOND_PROFILE_WEIBO
    let rawQuery = querystring.parseUrl(decodeUrl).query
    let articleId = rawQuery?.id || ''
    return articleId
  }
  if (decodeUrl.includes("weibo.com/p/")) {
    let rawContent = rawUrl.split("weibo.com/p/")?.[1] ?? "";
    let articleId = rawContent.split("?")?.[0] ?? ""
    return articleId
  }

  let rawArticleUrl = decodeUrl.split('url=')[1]
  if (!rawArticleUrl) {
    return ''
  }
  let baseArticleUrl = rawArticleUrl.split('?')[0] // url => 'https://card.weibo.com/article/m/show/id/2309404446645566701785'
  if (!baseArticleUrl) {
    return ''
  }
  let articleId = baseArticleUrl.split('show/id/')[1]
  if (!articleId) {
    return ''
  }
  return articleId
}

class FetchCustomer extends Base {
  fetchStartAtPageNo = 0
  fetchEndAtPageNo = 10000

  requestConfig = {
    st: '',
  }

  static get signature() {
    return `
        Fetch:Customer
    `
  }

  static get description() {
    return `从${PathConfig.customerTaskConfigUri}中读取自定义抓取任务并执行`
  }

  async execute(args: any, options: any): Promise<any> {
    this.log(`从${PathConfig.customerTaskConfigUri}中读取配置文件`)
    let fetchConfigJSON = fs.readFileSync(PathConfig.customerTaskConfigUri).toString()
    this.log('content =>', fetchConfigJSON)
    let customerTaskConfig: TypeTaskConfig.Customer = json5.parse(fetchConfigJSON)
    this.fetchStartAtPageNo = customerTaskConfig.fetchStartAtPageNo || this.fetchStartAtPageNo
    this.fetchEndAtPageNo = customerTaskConfig.fetchEndAtPageNo || this.fetchEndAtPageNo
    if (customerTaskConfig.isSkipFetch) {
      this.log(`检测到isSkipFetch配置为${!!customerTaskConfig.isSkipFetch}, 自动跳过抓取流程`)
      return
    }
    this.log(`开始进行自定义抓取`)
    type TypeTaskPackage = {
      [key: string]: Array<string>
    }
    let taskConfigList: Array<TypeTaskConfig.Record> = customerTaskConfig.configList
    for (let taskConfig of taskConfigList) {
      let { uid, comment } = taskConfig
      this.log(`待抓取用户uid => ${uid}`)
      this.log(`备注信息 => ${comment}`)
      // 开工

      // 需要先拿到st信息
      // 为抓取微博自定义一套流程
      // 获取st
      this.requestConfig.st = await ApiWeibo.asyncStep1FetchPageConfigSt()
      // 拿着st, 获取api config中的st
      this.requestConfig.st = await ApiWeibo.asyncStep2FetchApiConfig(this.requestConfig.st)

      this.log(`抓取用户${uid}信息`)
      let response = await ApiWeibo.asyncGetUserInfoResponseData(uid)
      if (_.isEmpty(response)) {
        this.log(`用户信息获取失败, 请检查登录状态`)
        continue
      }
      let userInfo = response.userInfo
      this.log(`用户信息获取完毕,待抓取用户为:${userInfo.screen_name},个人简介:${userInfo.description}`)
      // 拿到containerId
      let containerId: string = ''
      for (let tab of response.tabsInfo.tabs) {
        if (tab.tabKey === 'weibo') {
          containerId = tab.containerid
        }
      }
      if (containerId === '') {
        this.log(`未能获取到用户${userInfo.screen_name}对应的containerId,自动跳过`)
        continue
      }
      this.log(`开始抓取用户${userInfo.screen_name}微博记录`)
      let mblogCardList = await ApiWeibo.asyncGetWeiboList(uid).catch((e) => {
        // 避免crash导致整个进程退出
        return []
      })
      if (_.isEmpty(mblogCardList)) {
        this.log(`用户${userInfo.screen_name}微博记录为空,跳过抓取流程`)
        continue
      }
      let mblogCard = mblogCardList[0]
      let mblog = mblogCard.mblog
      let mblogUserInfo = mblog.user
      // 保存用户信息
      await MMblogUser.replaceInto({
        author_uid: `${mblogUserInfo.id}`,
        raw_json: JSON.stringify(mblogUserInfo),
      })
      // 用户总微博数
      let totalMblogCount = await ApiWeibo.asyncGetWeiboCount({
        author_uid: uid,
        st: this.requestConfig.st,
      })
      let totalPageCount = Math.ceil(totalMblogCount / 10)
      this.log(`用户${userInfo.screen_name}共发布了${totalMblogCount}条微博, 正式开始抓取`)
      let maxFetchPageNo = this.fetchEndAtPageNo <= totalPageCount ? this.fetchEndAtPageNo : totalPageCount
      this.log(`本次抓取的页码范围为:${this.fetchStartAtPageNo}~${maxFetchPageNo}`)

      // 记录最近一次成功的微博mid, 方便后续重抓
      let lastest_page_mid = '0'
      let lastest_page_offset = 0 // 从0开始记录, 在fetchMblogListAndSaveToDb中自动加1
      for (let page = 1; page <= totalPageCount; page++) {
        if (page < this.fetchStartAtPageNo) {
          page = this.fetchStartAtPageNo
          this.log(`从第${this.fetchStartAtPageNo}页数据开始抓取`)
        }
        if (page > this.fetchEndAtPageNo) {
          this.log(`已抓取至设定的第${page}/${this.fetchEndAtPageNo}页数据, 自动跳过抓取`)
        } else {
          const fetchRes = await this.fetchMblogListAndSaveToDb({
            author_uid: uid,
            page,
            totalPage: totalPageCount,
            lastest_page_mid: `${lastest_page_mid}`,
            lastest_page_offset,
          })
          if (fetchRes.isSuccess === true) {
            const lastItem = fetchRes.mblogList[fetchRes.mblogList.length - 1]
            lastest_page_mid = lastItem.mid ?? '0'
            // 有1次成功则归0
            lastest_page_offset = 0
          } else {
            // 失败时mid不需要变
            // lastest_page_mid 
            // page_offset递增1
            lastest_page_offset = lastest_page_offset + 1
          }
          // 微博的反爬虫措施太强, 只能用每20s抓一次的方式拿数据🤦‍♂️
          this.log(`已抓取${page}/${totalPageCount}页记录, 休眠${Const_Fetch_Wati_Seconds}s, 避免被封`)
          await Util.asyncSleep(Const_Fetch_Wati_Seconds * 1000)
        }
      }
      this.log(`用户${userInfo.screen_name}的微博数据抓取完毕`)
    }
    this.log(`所有任务抓取完毕`)
  }

  /**
   *
   * @param author_uid
   * @param page
   * @param totalPage
   * @param newFormatRecordMap
   */
  async fetchMblogListAndSaveToDb({
    author_uid,
    page,
    totalPage,
    lastest_page_mid,
    lastest_page_offset = 1
  }: { author_uid: string, page: number, totalPage: number, lastest_page_mid: string, lastest_page_offset: number }) {
    let target = `第${page}/${totalPage}页微博记录`
    this.log(`准备抓取${target}`)
    let rawMBlogRes = await ApiWeibo.asyncStep3GetWeiboList(this.requestConfig.st, author_uid, page)

    if (rawMBlogRes.isSuccess === false) {
      // 说明抓取失败, 等待30s后重试一次
      this.log(`经ApiV1接口抓取第${page}/${totalPage}页数据失败(1/3), 等待${Const_Retry_Wait_Seconds}s后重试`)
      await Util.asyncSleep(1000 * Const_Retry_Wait_Seconds)
      // 更新st
      let newSt = await ApiWeibo.asyncStep2FetchApiConfig(this.requestConfig.st)
      this.requestConfig.st = newSt
      // 带着新st重新抓取一次
      rawMBlogRes = await ApiWeibo.asyncStep3GetWeiboList(this.requestConfig.st, author_uid, page)
    }
    if (rawMBlogRes.isSuccess === false) {
      this.log(`经ApiV1接口抓取第${page}/${totalPage}页数据失败(2/3), 等待${Const_Retry_Wait_Seconds}s后重试`)
      await Util.asyncSleep(1000 * Const_Retry_Wait_Seconds)
      rawMBlogRes = await ApiWeibo.asyncStep3GetWeiboList(this.requestConfig.st, author_uid, page)
    }
    if (rawMBlogRes.isSuccess === false) {
      this.log(`经ApiV1接口抓取第${page}/${totalPage}页数据失败(3/3), 跳过对本页的抓取, 记录到数据库中待后续重抓`)

      this.log(`⚠️${author_uid}的第${page}/${totalPage}页微博获取失败, 记入数据库, 待后续重试`)

      await MFetchErrorRecord.asyncAddErrorRecord({
        author_uid: author_uid,
        resource_type: 'weibo_page',
        long_text_weibo_id: '',
        article_url: '',
        lastest_page_mid: lastest_page_mid,
        // 比上次抓取的offset+1
        lastest_page_offset: lastest_page_offset + 1,
        debug_info_json: JSON.stringify(
          {
            author_uid,
            page,
            totalPage
          }
        ),
        error_info_json: JSON.stringify({
          message: rawMBlogRes.errorInfo.message,
          stack: rawMBlogRes.errorInfo.stack
        })
      })

      await Util.asyncSleep(1000 * Const_Retry_Wait_Seconds)
      return {
        isSuccess: false,
        mblogList: []
      }
    }
    let mblogList: Array<TypeWeibo.TypeMblog> = []

    // 此处要根据微博类型进行具体定制
    for (let rawMblog of rawMBlogRes.recordList) {
      let mblog = rawMblog.mblog
      if (_.isEmpty(mblog) || _.isEmpty(mblog.user)) {
        // 数据为空自动跳过
        continue
      }

      // 检查是否是长微博
      if (rawMblog.mblog.isLongText === true) {
        // 长微博需要调取api重新获得微博内容
        let bid = rawMblog.mblog.bid
        let realMblog = <TypeWeibo.TypeMblog>await ApiWeibo.asyncGetLongTextWeibo({
          bid,
          st: this.requestConfig.st
        }).catch(async (e) => {
          // 记录抓取失败信息 & 避免crash导致整个进程退出 
          this.log(`⚠️${author_uid}的长微博${rawMblog.mblog.bid}获取失败, 记入数据库, 待后续重试`)
          const errorInfo = e as Error

          await MFetchErrorRecord.asyncAddErrorRecord({
            author_uid: author_uid,
            resource_type: 'long_text_weibo',
            long_text_weibo_id: rawMblog.mblog.bid,
            article_url: '',
            lastest_page_mid: '',
            lastest_page_offset: 0,
            debug_info_json: JSON.stringify(
              {
                rawMblog,
                isRetweet: false
              }
            ),
            error_info_json: JSON.stringify({
              message: errorInfo.message,
              stack: errorInfo.stack
            })
          })
          return {}
        })
        if (_.isEmpty(realMblog)) {
          continue
        }
        // @ts-ignore
        mblog = realMblog
      }
      if (_.isEmpty(rawMblog.mblog.retweeted_status) == false && rawMblog.mblog.retweeted_status !== undefined) {
        if (rawMblog.mblog.retweeted_status.isLongText === true) {
          // 转发微博属于长微博
          let bid = rawMblog.mblog.retweeted_status.bid
          let realRetweetMblog: TypeWeibo.TypeMblog | undefined = undefined
          try {
            realRetweetMblog = <TypeWeibo.TypeMblog>await ApiWeibo.asyncGetLongTextWeibo(bid)
          } catch (e) {
            // 记录抓取失败信息 & 避免crash导致整个进程退出 
            this.log(`⚠️${author_uid}转发的长微博${rawMblog.mblog.bid}获取失败, 记入数据库, 待后续重试`)
            const errorInfo = e as Error

            await MFetchErrorRecord.asyncAddErrorRecord({
              author_uid: author_uid,
              resource_type: 'long_text_weibo',
              long_text_weibo_id: rawMblog.mblog.bid,
              article_url: '',
              lastest_page_mid: '',
              lastest_page_offset: 0,
              debug_info_json: JSON.stringify(
                {
                  rawMblog,
                  isRetweet: true
                }
              ),
              error_info_json: JSON.stringify({
                message: errorInfo.message,
                stack: errorInfo.stack
              })
            })
          }
          mblog.retweeted_status = realRetweetMblog
        }
        if (
          rawMblog.mblog.retweeted_status !== undefined &&
          rawMblog.mblog.retweeted_status.page_info !== undefined &&
          rawMblog.mblog.retweeted_status.page_info.type === 'article'
        ) {
          // 转发的是微博文章
          let pageInfo = rawMblog.mblog.retweeted_status.page_info
          let articleId = getArticleId(pageInfo.page_url)
          let articleRecord = await ApiWeibo.asyncGetWeiboArticle(articleId).catch(async (e) => {
            // 记录抓取失败信息 & 避免crash导致整个进程退出 
            this.log(`⚠️${author_uid}转发的微博文章${pageInfo.page_url}获取失败, 记入数据库, 待后续重试`)
            const errorInfo = e as Error

            await MFetchErrorRecord.asyncAddErrorRecord({
              author_uid: author_uid,
              resource_type: 'article',
              long_text_weibo_id: '',
              article_url: pageInfo.page_url,
              lastest_page_mid: '',
              lastest_page_offset: 0,
              debug_info_json: JSON.stringify(
                {
                  rawMblog,
                  page_url: pageInfo.page_url,
                  isRetweet: true
                }
              ),
              error_info_json: JSON.stringify({
                message: errorInfo.message,
                stack: errorInfo.stack
              })
            })

            return {}
          })
          if (_.isEmpty(articleRecord)) {
            // 文章详情获取失败, 不储存该记录
            continue
          }
          mblog.retweeted_status.article = articleRecord
        }
      }
      if (rawMblog?.mblog?.page_info?.type === 'article') {
        // 文章类型为微博文章
        let pageInfo = rawMblog.mblog.page_info
        let articleId = getArticleId(pageInfo.page_url)
        let articleRecord = await ApiWeibo.asyncGetWeiboArticle(articleId).catch(async (e) => {
          // 记录抓取失败信息 & 避免crash导致整个进程退出 
          this.log(`⚠️${author_uid}转发的微博文章${pageInfo.page_url}获取失败, 记入数据库, 待后续重试`)
          const errorInfo = e as Error

          await MFetchErrorRecord.asyncAddErrorRecord({
            author_uid: author_uid,
            resource_type: 'article',
            long_text_weibo_id: '',
            article_url: pageInfo.page_url,
            lastest_page_mid: '',
            lastest_page_offset: 0,
            debug_info_json: JSON.stringify(
              {
                rawMblog,
                page_url: pageInfo.page_url,
                isRetweet: false
              }
            ),
            error_info_json: JSON.stringify({
              message: errorInfo.message,
              stack: errorInfo.stack
            })
          })

          return {}
        })
        if (_.isEmpty(articleRecord)) {
          // 文章详情获取失败, 不储存该记录
          continue
        }
        mblog.article = articleRecord
      }
      mblogList.push(mblog)
    }

    this.log(`${target}抓取成功, 准备存入数据库`)
    for (let mblog of mblogList) {
      // 处理完毕, 将数据存入数据库中
      let id = mblog.id
      let author_uid = `${mblog.user.id}`
      let createAt = 0
      // 目前微博的created_at字段均为标准时区字符串格式
      createAt = this.parseMblogCreateTimestamp(mblog)
      mblog.created_timestamp_at = createAt
      let raw_json = JSON.stringify(mblog)
      let is_retweet = mblog.retweeted_status ? 1 : 0
      let is_article = mblog.article ? 1 : 0

      // 这里可能会出报SQLITE_BUSY: database is locked
      await MMblog.replaceInto({
        id,
        author_uid,
        is_retweet,
        is_article,
        raw_json,
        post_publish_at: mblog.created_timestamp_at,
      }).catch((e: Error) => {
        this.log('数据库插入出错 => ', {
          name: e?.name,
          message: e?.message,
          stack: e?.stack,
        })
        return
      })
    }
    this.log(`${target}成功存入数据库`)
    // 返回微博列表, 方便后续处理
    return {
      isSuccess: true,
      mblogList
    }
  }

  /**
   * 简单将微博发布时间解析为
   * @param mlog
   */
  parseMblogCreateTimestamp(mlog: TypeWeibo.TypeMblog) {
    let rawCreateAtStr = `${mlog.created_at}`
    if (rawCreateAtStr.includes('-') === false) {
      // Mon Sep 16 01:13:45 +0800 2019
      if (rawCreateAtStr.includes('+0800')) {
        // 去除一开始的'Sun '符号, 这个dayjs无法解析
        rawCreateAtStr = rawCreateAtStr.slice(4)
        // 'Sun Sep 15 00:35:14 +0800 2019' 时区模式
        return dayjs(rawCreateAtStr, Const_DayJs_Parse_Format_4_WeiboComApi).unix()
      }
      // '12小时前' | '4分钟前' | '刚刚' | '1小时前' 模式
      // 不含-符号, 表示是最近一天内, 直接认为是当前时间, 不进行细分
      return dayjs().unix()
    }
    if (rawCreateAtStr.length === '08-07'.length) {
      // 月日模式, 表示当前年份,手工补上年份
      return dayjs(`${dayjs().format('YYYY')}-${rawCreateAtStr}`).unix()
    }
    // 否则, 为'2012-01-02'  模式, 直接解析即可
    return dayjs(rawCreateAtStr).unix()
  }
}

export default FetchCustomer
