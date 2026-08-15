import Base from '~/src/command/fetch/base.js'
import TypeTaskConfig from '~/src/type/namespace/task_config.js'
import PathConfig from '~/src/config/path.js'
import fs from 'fs'
import _ from 'lodash'
import json5 from 'json5'
import dayjs from 'dayjs'

import ApiWeibo from '~/src/api/weibo.js'
import MMblog from '~/src/model/mblog.js'
import MMblogUser from '~/src/model/mblog_user.js'
import MFetchErrorRecord from '~/src/model/fetch_error_record.js'
import CommonUtil from '~/src/library/util/common.js'
import * as TypeWeibo from '~/src/type/namespace/weibo.js'
import Util from '~/src/library/util/common.js'
import querystring from 'query-string'
// dayjs需要安装插件后, 才能支持识别复杂文本串
import customParseFormat from 'dayjs/plugin/customParseFormat.js'
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
    // 旧页码抓取器已退出 workflow，仅保留给历史调试入口编译使用。
    let customerTaskConfig = json5.parse(fetchConfigJSON) as TypeTaskConfig.Customer & {
      fetchStartAtPageNo?: number
      fetchEndAtPageNo?: number
      onlyRetry?: boolean
    }
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
        throw new Error(`用户${uid}信息获取失败，请检查登录状态`)
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
        throw new Error(`未能获取到用户${userInfo.screen_name}对应的containerId`)
      }
      this.log(`开始抓取用户${userInfo.screen_name}微博记录`)
      let mblogCardList = await ApiWeibo.asyncGetWeiboList(uid)
      if (_.isEmpty(mblogCardList)) {
        throw new Error(`用户${userInfo.screen_name}首屏微博记录为空，无法确认抓取结果完整性`)
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
      if (customerTaskConfig.onlyRetry) {
        this.log(`启用了仅抓取失败项配置, 本次仅抓取失败部分`)
        await this.retryFetch(uid)
        this.log(`${userInfo.screen_name}的重抓逻辑执行完毕`)
        continue
      }

      let maxFetchPageNo = this.fetchEndAtPageNo <= totalPageCount ? this.fetchEndAtPageNo : totalPageCount
      this.log(`本次抓取的页码范围为:${this.fetchStartAtPageNo}~${maxFetchPageNo}`)

      // 记录最近一次成功的微博mid, 方便后续重抓
      let lastest_page_mid = '0'
      let lastest_page_offset = 0 // 从0开始记录, 在fetchMblogListAndSaveToDb中自动加1
      let lastest_page_mblog = {}

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
            lastest_page_mblog
          })
          if (fetchRes.isSuccess === true) {
            lastest_page_mblog = fetchRes.mblogList[fetchRes.mblogList.length - 1] ?? {}
            // @ts-ignore
            lastest_page_mid = lastest_page_mblog?.mid ?? '0'
            // 有1次成功则归0
            lastest_page_offset = 0
            lastest_page_mblog = {}
          } else {
            // 失败时mid不需要变
            // lastest_page_mid 
            // 最近成功微博也不需要变
            // lastest_page_mblog
            // 仅page_offset递增1
            lastest_page_offset = lastest_page_offset + 1
          }
          // 微博的反爬虫措施太强, 只能用每20s抓一次的方式拿数据🤦‍♂️
          this.log(`已抓取${page}/${totalPageCount}页记录, 休眠${Const_Fetch_Wati_Seconds}s, 避免被封`)
          await Util.asyncSleep(Const_Fetch_Wati_Seconds * 1000)
        }
      }
      this.log(`用户${userInfo.screen_name}的微博数据抓取完毕`)

      this.log(`针对抓取用户${userInfo.screen_name}过程中的失败任务, 执行重抓逻辑`)
      await this.retryFetch(uid)
      this.log(`重抓逻辑执行完毕`)
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
    lastest_page_offset = 1,
    lastest_page_mblog,
  }: { author_uid: string, page: number, totalPage: number, lastest_page_mid: string, lastest_page_offset: number, lastest_page_mblog: any }) {
    let target = `第${page}/${totalPage}页微博记录`
    this.log(`准备抓取${target}`)
    let rawMBlogRes = await this.asyncGetWeiboList({ author_uid, page, totalPage })

    if (rawMBlogRes.isSuccess === false) {
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
        }),
        mblog_json: JSON.stringify(lastest_page_mblog)
      })
      await Util.asyncSleep(1000 * Const_Retry_Wait_Seconds)
      return {
        isSuccess: false,
        mblogList: []
      }
    }
    let mblogList: Array<TypeWeibo.TypeMblog> = []

    let rawMblogFetchIndex = 0
    // 此处要根据微博类型进行具体定制
    for (let rawMblog of rawMBlogRes.recordList) {
      rawMblogFetchIndex++
      let mblog = rawMblog.mblog
      if (_.isEmpty(mblog) || _.isEmpty(mblog.user)) {
        // 数据为空自动跳过
        continue
      }
      const hydrateBlogRes = await this.asyncHydrateMBlog({
        author_uid,
        mblog
      })
      this.log(`第${rawMblogFetchIndex}/${rawMBlogRes.recordList.length}条微博详情请求完毕, 休眠1s`)
      if (hydrateBlogRes.hasFetch) {
        // 仅发生抓取时, 需要额外休眠1s
        await Util.asyncSleep(1000)
      }
      if (rawMblogFetchIndex > 1 && rawMblogFetchIndex % 10 === 0) {
        // 避免频繁请求导致被封ip
        this.log(`累计抓取${rawMblogFetchIndex}条微博, 额外休眠${Const_Retry_Wait_Seconds}s`)
        await Util.asyncSleep(1000 * Const_Retry_Wait_Seconds)
      }
      // 不管成功或失败, 都应把数据记录下来
      // if (hydrateBlogRes.isSuccess === false) {
      //   continue
      // }

      mblogList.push(hydrateBlogRes.record)
    }

    this.log(`${target}抓取成功, 准备存入数据库`)
    for (let mblog of mblogList) {
      // 处理完毕, 将数据存入数据库中
      await this.asyncReplaceMblogIntoDb(mblog)
    }
    this.log(`${target}成功存入数据库`)
    // 返回微博列表, 方便后续处理
    return {
      isSuccess: true,
      mblogList
    }
  }

  /**
   * 简单将微博发布时间解析为时间戳
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


  /**
   * 运行完成后, 自动进行重抓
   * @param author_uid 
   * @returns 
   */
  async retryFetch(author_uid: string) {
    const fetchErrorRecordList = await MFetchErrorRecord.asyncGetErrorRecordList(author_uid)
    this.log(`准备抓取${author_uid}中, 所有失败的记录, 共${fetchErrorRecordList.length}项`)

    const pageFetchFailedList = fetchErrorRecordList.filter(item => item.resource_type === 'weibo_page')
    this.log(`首先获取加载失败的页面`)
    for (let errorPageConfig of pageFetchFailedList) {
      this.log(`从mid${errorPageConfig.lastest_page_mid}后, 有${errorPageConfig.lastest_page_offset}页加载失败, 开始重新获取`)
      const res = await this.asyncFetchBySinceMid({
        author_uid,
        "mid": errorPageConfig.lastest_page_mid,
        "needFetchPage": errorPageConfig.lastest_page_offset,
      })
      if (res.isSuccess === false) {
        this.log(`重新获取mid:${errorPageConfig.lastest_page_mid}对应的${errorPageConfig.lastest_page_offset}页失败, 跳过该部分`)
        continue
      }
      this.log(`获取mid:${errorPageConfig.lastest_page_mid}对应的${errorPageConfig.lastest_page_offset}页成功, 录入数据库`)
      let refetchMblogIndex = 0
      for (let mblog of res.recordList) {
        refetchMblogIndex++
        if (_.isEmpty(mblog)) {
          // 为空自动跳过
          continue
        }
        const hydrateBlogRes = await this.asyncHydrateMBlog({
          author_uid,
          mblog
        })
        // 处理完毕, 将数据存入数据库中
        await this.asyncReplaceMblogIntoDb(hydrateBlogRes.record)
        this.log(`第${refetchMblogIndex}/${res.recordList.length}条微博详情请求完毕, 休眠1s`)
        if (hydrateBlogRes.hasFetch) {
          // 仅发生抓取时, 需要额外休眠1s
          await Util.asyncSleep(1000)
        }
        if (refetchMblogIndex > 1 && refetchMblogIndex % 10 === 0) {
          // 避免频繁请求导致被封ip
          this.log(`累计抓取${refetchMblogIndex}条微博, 额外休眠${Const_Retry_Wait_Seconds}s`)
          await Util.asyncSleep(1000 * Const_Retry_Wait_Seconds)
        }
      }
      // 然后删除旧记录
      await MFetchErrorRecord.asyncRemoveErrorRecord({
        author_uid,
        resource_type: errorPageConfig.resource_type,
        "lastest_page_mid": errorPageConfig.lastest_page_mid,
        "lastest_page_offset": errorPageConfig.lastest_page_offset,
        "long_text_weibo_id": errorPageConfig.long_text_weibo_id,
        "article_url": errorPageConfig.article_url
      })
    }
    this.log(`页面重抓完毕, 开始收集微博文章/长文本抓取异常的项`)

    const retryMblogConfigList = fetchErrorRecordList
      .filter(item => ["article", 'long_text_weibo'].includes(item.resource_type))
      .filter(item => {
        try {
          JSON.parse(item.mblog_json)
          return true
        } catch (e) {
          this.log(`记录的mblog_json解析失败, 自动跳过`, item)
          return false
        }
      })
    this.log(`准备等待重新抓取的微博记录整理完毕, 共${retryMblogConfigList.length}项`)
    let retryMblogConfigIndex = 0
    for (let retryMblogConfig of retryMblogConfigList) {
      let mblog = JSON.parse(retryMblogConfig.mblog_json)
      if (mblog.mblog !== undefined) {
        // @todo(待移除) 适配旧版本中, 嵌套两层的场景
        mblog = mblog.mblog
      }
      retryMblogConfigIndex++
      this.log(`开始处理第${retryMblogConfigIndex}/${retryMblogConfigList.length}项, id:${retryMblogConfig.id}`)
      const hydrateBlogRes = await this.asyncHydrateMBlog({
        author_uid,
        mblog
      })
      this.log(`第${retryMblogConfigIndex}/${retryMblogConfigList.length}条微博详情请求完毕, 休眠1s`)
      if (hydrateBlogRes.hasFetch) {
        // 仅发生抓取时, 需要额外休眠1s
        await Util.asyncSleep(1000)
      }
      if (retryMblogConfigIndex > 1 && retryMblogConfigIndex % 10 === 0) {
        // 避免频繁请求导致被封ip
        this.log(`累计抓取${retryMblogConfigIndex}条微博, 额外休眠${Const_Retry_Wait_Seconds}s`)
        await Util.asyncSleep(1000 * Const_Retry_Wait_Seconds)
      }
      // 处理完毕, 将数据存入数据库中
      if (hydrateBlogRes.isSuccess) {
        this.log(`第${retryMblogConfigIndex}/${retryMblogConfigList.length}项抓取失败任务, id:${retryMblogConfig.id}处理完毕, 将新数据更新至数据库中, 移除失败记录`)
        await this.asyncReplaceMblogIntoDb(hydrateBlogRes.record)
        // 然后删除旧记录
        await MFetchErrorRecord.asyncRemoveErrorRecord({
          author_uid,
          resource_type: retryMblogConfig.resource_type,
          "lastest_page_mid": retryMblogConfig.lastest_page_mid,
          "lastest_page_offset": retryMblogConfig.lastest_page_offset,
          "long_text_weibo_id": retryMblogConfig.long_text_weibo_id,
          "article_url": retryMblogConfig.article_url
        })
      } else {
        this.log(`第${retryMblogConfigIndex}/${retryMblogConfigList.length}项微博, mid:${mblog.mid}水合失败, 自动跳过, 待后续重抓`)
      }
    }
    this.log(`author_uid:${author_uid}对应的补抓任务执行完毕`)
    return
  }

  /**
   * 获取微博列表, 添加retry机制
   */
  private async asyncGetWeiboList({ author_uid, page, totalPage }: {
    author_uid: string,
    page: number
    totalPage: number
  }) {
    // 最多重试5次
    const maxRetryCount = 5
    let retryCount = 0;
    let isSuccess = false;
    let rawMBlogRes: Awaited<ReturnType<typeof ApiWeibo.asyncStep3GetWeiboList>> = {
      recordList: [],
      isSuccess: false,
      errorInfo: {}
    }
    while (retryCount < maxRetryCount && isSuccess === false) {
      rawMBlogRes = await ApiWeibo.asyncStep3GetWeiboList(this.requestConfig.st, author_uid, page)
      if (rawMBlogRes.isSuccess) {
        isSuccess = true
        return {
          recordList: rawMBlogRes.recordList,
          isSuccess: true,
          errorInfo: {}
        }
      }
      this.log(`经ApiV1接口抓取第${page}/${totalPage}页数据失败(${retryCount + 1}/${maxRetryCount}), 等待${Const_Retry_Wait_Seconds}s后重试`)
      // 更新st
      let newSt = await ApiWeibo.asyncStep2FetchApiConfig(this.requestConfig.st)
      this.requestConfig.st = newSt
      retryCount++
      await Util.asyncSleep(1000 * Const_Retry_Wait_Seconds)
    }
    this.log(`第${page}/${totalPage}页经过${maxRetryCount}次重试后仍失败, 跳过对该页面的抓取, 待后续重试`)
    return {
      recordList: [],
      isSuccess: false,
      errorInfo: rawMBlogRes.errorInfo
    }

  }

  /**
   * 从mid处, 连续获取needFetchPage条微博记录
   * @param mid 
   * @param needFetchPage 
   */
  private async asyncFetchBySinceMid({ author_uid, mid, needFetchPage }: { author_uid: string, mid: string, needFetchPage: number }): Promise<{
    recordList: TypeWeibo.TypeMblog[],
    isSuccess: boolean,
    errorInfo: any
  }> {
    const weiboList: TypeWeibo.TypeMblog[] = []
    // 最多重试5次
    const maxRetryCount = 5
    for (let offsetPage = 0; offsetPage < needFetchPage; offsetPage++) {
      let retryCount = 0;
      let isSuccess = false;
      this.log(`开始获取author_uid:${author_uid}从mid:${mid}开始的第${offsetPage + 1}/${needFetchPage}页的数据`)
      while (retryCount < maxRetryCount && isSuccess === false) {
        const res = await ApiWeibo.asyncGetWeiboListBySinceId({
          st: this.requestConfig.st,
          since_id: mid,
          author_uid
        })
        if (res.isSuccess) {
          // 请求成功后则无需重试
          this.log(`第${retryCount + 1}次请求成功, 将获取到的微博记录添加至结果列表中`)
          isSuccess = true
          // 将结果录入列表中
          weiboList.push(...res.recordList.map(item => item.mblog))
          continue
        } else {
          // 否则, 增加一次重试次数
          this.log(`第${retryCount + 1}次请求失败, 等待${Const_Retry_Wait_Seconds}s后重试`)
          retryCount++
          await Util.asyncSleep(1000 * Const_Retry_Wait_Seconds)
        }
      }
      if (isSuccess === false) {
        this.log(`第${offsetPage + 1}页经过${maxRetryCount}次重试后仍失败, 跳过对该记录的补录`)
        return {
          recordList: [],
          isSuccess: false,
          errorInfo: {}
        }
      }
    }
    return {
      recordList: weiboList,
      isSuccess: true,
      errorInfo: {}
    }
  }


  /**
   * 补全微博数据(eg: 长微博/微博文章)
   * @param mblog 
   */
  private async asyncHydrateMBlog({
    author_uid,
    mblog
  }: {
    author_uid: string, mblog: TypeWeibo.TypeMblog
  }): Promise<{
    isSuccess: boolean,
    record: TypeWeibo.TypeMblog
    hasFetch: boolean
  }> {
    // 最多重试5次
    const maxRetryCount = 5
    if (_.isEmpty(mblog)) {
      return {
        isSuccess: false,
        record: mblog,
        hasFetch: false,
      }
    }

    let hasFetch = false
    const asyncGetLongTextWeibo = async ({ bid }: { bid: string }) => {
      let retryCount = 0
      let isSuccess = false

      let errorInfo: Error = new Error()
      while (retryCount < maxRetryCount && isSuccess === false) {
        this.log(`${author_uid}的微博${mblog.id}为长微博${bid}, 第${retryCount + 1}/${maxRetryCount}次尝试获取长微博内容`)
        try {
          const result = await ApiWeibo.asyncGetLongTextWeibo({
            bid,
            st: this.requestConfig.st
          })
          this.log(`${author_uid}的微博${mblog.id}对应的长微博${bid}获取成功`)
          return result
        } catch (e) {
          errorInfo = e as Error
          retryCount++
          this.log(`第${retryCount}/${maxRetryCount}次获取${author_uid}的微博${mblog.id}对应的长微博${bid}获取失败, 休眠${Const_Retry_Wait_Seconds}s后重试`)
          await Util.asyncSleep(1000 * Const_Retry_Wait_Seconds)

          // 更新st
          let newSt = await ApiWeibo.asyncStep2FetchApiConfig(this.requestConfig.st)
          this.log(`更新st, 新st值:${newSt}`)
          this.requestConfig.st = newSt
        }
      }
      this.log(`${maxRetryCount}次获取${author_uid}的微博${mblog.id}对应的长微博${bid}获取均失败, 录入数据库`)

      // 有uniq索引限制, 可以多次replace, 不会出现重复
      await MFetchErrorRecord.asyncAddErrorRecord({
        author_uid: author_uid,
        resource_type: 'long_text_weibo',
        long_text_weibo_id: mblog.bid,
        article_url: '',
        lastest_page_mid: '',
        lastest_page_offset: 0,
        debug_info_json: JSON.stringify(
          {
            isRetweet: false
          }
        ),
        error_info_json: JSON.stringify({
          message: errorInfo.message,
          stack: errorInfo.stack
        }),
        mblog_json: JSON.stringify(mblog)
      })
      return undefined
    }

    const asyncGetArticle = async ({ articleId, page_url }: { articleId: string, page_url: string }) => {
      let retryCount = 0
      let isSuccess = false

      let errorInfo: Error = new Error()
      while (retryCount < maxRetryCount && isSuccess === false) {
        this.log(`${author_uid}的微博${mblog.id}为微博文章${articleId}, 第${retryCount + 1}/${maxRetryCount}次尝试获取文章内容`)
        try {
          const result = await ApiWeibo.asyncGetWeiboArticle(articleId)
          this.log(`${author_uid}的微博${mblog.id}对应的微博文章${articleId}获取成功`)
          return result
        } catch (e) {
          errorInfo = e as Error
          retryCount++
          this.log(`第${retryCount}/${maxRetryCount}次获取${author_uid}的微博${mblog.id}对应的微博文章${articleId}获取失败, 休眠${Const_Retry_Wait_Seconds}s后重试`)
          await Util.asyncSleep(1000 * Const_Retry_Wait_Seconds)
          // 更新st
          let newSt = await ApiWeibo.asyncStep2FetchApiConfig(this.requestConfig.st)
          this.log(`更新st, 新st值:${newSt}`)
          this.requestConfig.st = newSt
        }
      }
      this.log(`${maxRetryCount}次获取${author_uid}的微博${mblog.id}对应的微博文章${articleId}获取均失败, 录入数据库`)

      // 有uniq索引限制, 可以多次replace, 不会出现重复
      await MFetchErrorRecord.asyncAddErrorRecord({
        author_uid: author_uid,
        resource_type: 'article',
        long_text_weibo_id: '',
        article_url: page_url,
        lastest_page_mid: '',
        lastest_page_offset: 0,
        debug_info_json: JSON.stringify(
          {
            page_url: page_url,
            isRetweet: true
          }
        ),
        error_info_json: JSON.stringify({
          message: errorInfo.message,
          stack: errorInfo.stack
        }),
        mblog_json: JSON.stringify(mblog)
      })
      return undefined
    }

    // 检查是否是长微博
    if (mblog.isLongText === true) {
      hasFetch = true
      // 长微博需要调取api重新获得微博内容
      let bid = mblog.bid
      let realMblog = <TypeWeibo.TypeMblog>await asyncGetLongTextWeibo({ bid })
      if (realMblog === undefined) {
        // 获取失败, 自动返回
        return {
          isSuccess: false,
          record: mblog,
          hasFetch
        }
      }
      return {
        isSuccess: true,
        record: realMblog,
        hasFetch,
      }
    }

    if (_.isEmpty(mblog.retweeted_status) == false && mblog.retweeted_status !== undefined) {
      if (mblog.retweeted_status.isLongText === true) {
        hasFetch = true
        // 转发微博属于长微博
        let bid = mblog.retweeted_status.bid
        let realRetweetMblog: TypeWeibo.TypeMblog | undefined = undefined
        realRetweetMblog = <TypeWeibo.TypeMblog>await asyncGetLongTextWeibo({ bid })
        if (realRetweetMblog === undefined) {
          // 获取失败, 自动返回
          return {
            isSuccess: false,
            record: mblog,
            hasFetch
          }
        }
        mblog.retweeted_status = realRetweetMblog
      }
      if (
        mblog.retweeted_status !== undefined &&
        mblog.retweeted_status.page_info !== undefined &&
        mblog.retweeted_status.page_info.type === 'article'
      ) {
        // 转发的是微博文章
        let pageInfo = mblog.retweeted_status.page_info
        let articleId = this.getArticleId(pageInfo.page_url)
        hasFetch = true
        let articleRecord = await asyncGetArticle({
          articleId,
          page_url: pageInfo.page_url
        })
        if (_.isEmpty(articleRecord)) {
          // 文章详情获取失败, 不储存该记录
          return {
            isSuccess: false,
            record: mblog,
            hasFetch
          }
        }
        mblog.retweeted_status.article = articleRecord
      }
    }
    if (mblog?.page_info?.type === 'article') {
      // 文章类型为微博文章
      let pageInfo = mblog.page_info
      let articleId = this.getArticleId(pageInfo.page_url)
      hasFetch = true
      let articleRecord = await asyncGetArticle({
        articleId,
        page_url: pageInfo.page_url
      })
      if (_.isEmpty(articleRecord)) {
        // 文章详情获取失败, 不储存该记录
        return {
          isSuccess: false,
          record: mblog,
          hasFetch
        }
      }
      mblog.article = articleRecord
    }
    return {
      isSuccess: true,
      record: mblog,
      hasFetch
    }
  }

  /**
   * 将单条微博数据存入数据库中
   * @param mblog 
   * @returns 
   */
  async asyncReplaceMblogIntoDb(mblog: TypeWeibo.TypeMblog) {
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
    })
    return true
  }
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
  private getArticleId(rawUrl = '') {
    if (!rawUrl) {
      return ''
    }
    // 需要多次解析，才能将url完全解码成正常文本
    let decodeUrl = decodeURI(decodeURI(decodeURI(rawUrl)))
    if (!decodeUrl) {
      return ''
    }
    if (decodeUrl.includes('id=') && decodeUrl.includes('/ttarticle/p/show')) {
      // 说明是新格式 https://weibo.com/ttarticle/p/show?id=2309404619352241471539&luicode=10000011&lfid=2304131221171697_-_WEIBO_SECOND_PROFILE_WEIBO
      let rawQuery = querystring.parseUrl(decodeUrl).query
      let articleId = rawQuery?.id as string || ''
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
}

export default FetchCustomer
