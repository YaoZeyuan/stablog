import Base from '~/src/command/generate/base'
import TypeWeibo, { TypeWeiboUserInfo, TypeMblog, TypeWeiboEpub, TypeWeiboListByDay } from '~/src/type/namespace/weibo'
import TypeTaskConfig from '~/src/type/namespace/task_config'
import PathConfig from '~/src/config/path'
import MMblog from '~/src/model/mblog'
import MMblogUser from '~/src/model/mblog_user'
import DATE_FORMAT from '~/src/constant/date_format'

import _ from 'lodash'
import json5 from 'json5'

import AnswerView from '~/src/view/answer'
import WeiboView from '~/src/view/weibo'
import PinView from '~/src/view/pin'
import ArticleView from '~/src/view/article'
import BaseView from '~/src/view/base'
import fs from 'fs'
import path from 'path'
import StringUtil from '~/src/library/util/string'
import moment from 'moment'

class GenerateCustomer extends Base {
  static get signature() {
    return `
        Generate:Customer
    `
  }

  static get description() {
    return '输出微博记录'
  }

  async execute(args: any, options: any): Promise<any> {
    this.log(`从${PathConfig.customerTaskConfigUri}中读取配置文件`)
    let fetchConfigJSON = fs.readFileSync(PathConfig.customerTaskConfigUri).toString()
    this.log('content =>', fetchConfigJSON)
    let customerTaskConfig: TypeTaskConfig.Customer = json5.parse(fetchConfigJSON)

    let bookname = customerTaskConfig.bookTitle
    let comment = customerTaskConfig.comment
    let imageQuilty = customerTaskConfig.imageQuilty
    let maxBlogInBook = customerTaskConfig.maxBlogInBook
    let configList = customerTaskConfig.configList
    let config = configList[0]

    let author_uid = config.uid
    let userInfo = await MMblogUser.asyncGetUserInfo(author_uid)
    if (_.isEmpty(userInfo)) {
      this.log(`未抓取到对应的用户数据, 自动跳过`)
      return
    }
    let screenName = userInfo.screen_name
    this.log(`开始输出用户${screenName}的微博备份数据`)
    // 将任务中的数据按照问题/文章/想法进行汇总

    this.log(`获取数据记录`)

    let mblogList = await MMblog.asyncGetMblogList(author_uid)

    this.log(`数据获取完毕, 共收录${mblogList.length}条微博`)

    let weiboEpubList = this.packageMblogList(mblogList, maxBlogInBook, userInfo)

    let bookCounter = 0
    for (let resourcePackage of weiboEpubList) {
      bookCounter++
      let booktitle = ''
      if (weiboEpubList.length <= 1) {
        booktitle = `${resourcePackage.userInfo.screen_name}-微博记录(${moment
          .unix(resourcePackage.startDayAt)
          .format(DATE_FORMAT.DISPLAY_BY_DAY)}~${moment
          .unix(resourcePackage.endDayAt)
          .format(DATE_FORMAT.DISPLAY_BY_DAY)})`
      } else {
        booktitle = `${resourcePackage.userInfo.screen_name}-微博记录-第${resourcePackage.bookIndex}/${
          resourcePackage.totalBookCount
        }卷(${moment.unix(resourcePackage.startDayAt).format(DATE_FORMAT.DISPLAY_BY_DAY)}~${moment
          .unix(resourcePackage.endDayAt)
          .format(DATE_FORMAT.DISPLAY_BY_DAY)})`
      }
      this.log(`输出电子书:${booktitle}`)
      await this.asyncGenerateEpub(booktitle, imageQuilty, resourcePackage)
      this.log(`电子书:${booktitle}输出完毕`)
    }
  }

  /**
   * 1. 将微博按时间顺序排列
   * 2. 将微博按天合并到一起
   * 3. 按配置单本电子书最大微博数, 切分成微博Epub列表
   * @param mblogList
   * @param maxBlogInBook
   * @param userInfo
   */
  packageMblogList(mblogList: Array<TypeMblog>, maxBlogInBook: number, userInfo: TypeWeiboUserInfo) {
    // 其次, 按天分隔微博
    let mblogListByDayMap: Map<string, TypeWeiboListByDay> = new Map()
    for (let mblog of mblogList) {
      let mblogCreateAtTimestamp = <number>mblog.created_timestamp_at
      let publishAtStr = moment.unix(mblogCreateAtTimestamp).format(DATE_FORMAT.DISPLAY_BY_DAY)
      let record = mblogListByDayMap.get(publishAtStr)
      if (record === undefined) {
        let a: TypeWeiboListByDay = {
          dayStartAt: moment
            .unix(mblogCreateAtTimestamp)
            .startOf(DATE_FORMAT.UNIT.DAY)
            .unix(),
          dayStartAtStr: publishAtStr,
          weiboList: [mblog],
        }
        record = a
      } else {
        record.weiboList.push(mblog)
      }
      mblogListByDayMap.set(publishAtStr, record)
    }
    // 然后, 按日期先后对记录
    let mblogListByDayList = []
    for (let record of mblogListByDayMap.values()) {
      record.weiboList.sort((itemA, itemB) => {
        let intAId = parseInt(itemA.id)
        let intBId = parseInt(itemB.id)
        return intAId - intBId
      })
      mblogListByDayList.push(record)
    }
    mblogListByDayList.sort((itemA, itemB) => {
      let intAStartAt = itemA.dayStartAt
      let intBStartAt = itemB.dayStartAt
      return intAStartAt - intBStartAt
    })
    // 解除引用依赖
    mblogListByDayList = _.cloneDeep(mblogListByDayList)
    // 最后, 按条目数拆分微博记录, 将微博列表分包
    let rawWeiboEpubList: Array<TypeWeiboEpub> = []
    // book index 应该从1开始
    let bookIndex = 1
    let bookCounter = 1
    let weiboEpubTemplate: TypeWeiboEpub = {
      bookIndex: bookIndex,
      startDayAt: 0,
      endDayAt: 0,
      userInfo: userInfo,
      screenName: userInfo.screen_name,
      weiboDayList: [],
      totalBookCount: 0,
      mblogInThisBookCount: 0,
      totalMblogCount: mblogList.length,
    }
    let weiboEpub = _.cloneDeep(weiboEpubTemplate)
    let bufEndDayAt = moment().unix()
    for (let mblogListByDay of mblogListByDayList) {
      // 备份一下, 循环结束时使用
      bufEndDayAt = mblogListByDay.dayStartAt

      if (weiboEpub.weiboDayList.length === 0) {
        // 首次添加
        weiboEpub.weiboDayList.push(mblogListByDay)
        weiboEpub.mblogInThisBookCount = mblogListByDay.weiboList.length
        weiboEpub.startDayAt = mblogListByDay.dayStartAt
        weiboEpub.bookIndex = bookIndex
      } else {
        weiboEpub.weiboDayList.push(mblogListByDay)
        weiboEpub.mblogInThisBookCount += mblogListByDay.weiboList.length
      }
      if (weiboEpub.mblogInThisBookCount > maxBlogInBook) {
        // 超出阈值, 该分卷了
        weiboEpub.endDayAt = mblogListByDay.dayStartAt
        let buffer = _.cloneDeep(weiboEpub)
        rawWeiboEpubList.push(buffer)
        // 重新起一个
        bookCounter = bookCounter + 1
        bookIndex = bookIndex + 1
        weiboEpub = _.cloneDeep(weiboEpubTemplate)
      }
    }
    // 循环结束, 记录最后一卷数据
    weiboEpub.endDayAt = bufEndDayAt
    let buffer = _.cloneDeep(weiboEpub)
    rawWeiboEpubList.push(buffer)
    // 最后, 格式化一下代码
    let weiboEpubList = []
    for (let record of rawWeiboEpubList) {
      record.totalBookCount = bookCounter
      weiboEpubList.push(_.cloneDeep(record))
    }
    // 得到最终结果, 可以渲染电子书了
    return weiboEpubList
  }

  async asyncGenerateEpub(
    bookname: string,
    imageQuilty: TypeTaskConfig.imageQuilty,
    epubResourcePackage: TypeWeiboEpub,
  ) {
    // 初始化资源, 重置所有静态类变量
    this.bookname = StringUtil.encodeFilename(`${bookname}`)
    this.imageQuilty = imageQuilty
    let { weiboDayList } = epubResourcePackage
    this.imgUriPool = new Set()

    // 初始化文件夹
    this.initStaticRecource()

    // 单独记录生成的元素, 以便输出成单页
    let totalElementListToGenerateSinglePage = []
    this.log(`生成微博记录html列表`)
    for (let weiboDayRecord of weiboDayList) {
      let title = weiboDayRecord.dayStartAtStr
      let content = WeiboView.render(weiboDayRecord.weiboList)
      content = this.processContent(content)
      fs.writeFileSync(path.resolve(this.htmlCacheHtmlPath, `${title}.html`), content)
      this.epub.addHtml(weiboDayRecord.dayStartAtStr, path.resolve(this.htmlCacheHtmlPath, `${title}.html`))

      // 单独记录生成的元素, 以便输出成单页文件
      // let contentElementList = []
      // for (let weiboDayRecord of weiboDayList) {
      //   let contentElement = BaseView.generateSingleAnswerElement(weiboDayRecord)
      //   contentElementList.push(contentElement)
      // }
      // let elememt = BaseView.generateQuestionElement(weiboDayRecord, contentElementList)
      // totalElementListToGenerateSinglePage.push(elememt)
    }

    // this.log(`生成单一html文件`)
    // // 生成全部文件
    // let pageElement = BaseView.generatePageElement(this.bookname, totalElementListToGenerateSinglePage)
    // let content = BaseView.renderToString(pageElement)
    // this.log(`内容渲染完毕, 开始对内容进行输出前预处理`)
    // content = this.processContent(content)
    // fs.writeFileSync(path.resolve(this.htmlCacheSingleHtmlPath, `${this.bookname}.html`), content)

    //  生成目录
    this.log(`生成目录`)
    let indexContent = BaseView.renderIndex(this.bookname, weiboDayList)
    fs.writeFileSync(path.resolve(this.htmlCacheHtmlPath, `index.html`), indexContent)
    this.epub.addIndexHtml('目录', path.resolve(this.htmlCacheHtmlPath, `index.html`))

    // 处理静态资源
    await this.asyncProcessStaticResource()

    this.log(`自定义电子书${this.bookname}生成完毕`)
  }
}

export default GenerateCustomer
