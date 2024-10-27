import Base from '~/src/command/generate/base'
import { TypeWeiboUserInfo, TypeMblog, TypeWeiboEpub, TypeWeiboListByDay } from '~/src/type/namespace/weibo'
import TypeTaskConfig from '~/src/type/namespace/task_config'
import PathConfig from '~/src/config/path'
import MMblog from '~/src/model/mblog'
import MMblogUser from '~/src/model/mblog_user'
import DATE_FORMAT from '~/src/constant/date_format'
import imageSize from 'image-size'
import _ from 'lodash'
import json5 from 'json5'
import { TypeTransConfigItem, TypeTransConfigPackageList, TypeTransConfigPackage } from "./trans_config"

import WeiboView from '~/src/view/weibo'
import BaseView from '~/src/view/base'
import fs from 'fs'
import path from 'path'
import StringUtil from '~/src/library/util/string'
import dayjs from 'dayjs'
import * as mozjpeg from "mozjpeg-js"
import sharp from "sharp"

// 将img输出为pdf
import TaskConfig from '~/src/type/namespace/task_config'
import jsPDF from '~/src/library/pdf/jspdf.node.js'
import { BrowserWindow } from 'electron'
import CommonUtil from '~/src/library/util/common'

/**
 * 单张页面渲染时间不能超过120秒(降低屏幕高度后, 渲染时间增加, 所以对应的最大等待时间也要增加)
 */
const Const_Render_Html_Timeout_Second = 120
/**
 * 宽为760px的图片, 在电脑端打开正常, 但是pdf中会被拉伸到全屏大小, 成为原先的200%, 导致模糊.
 * 为了保证pdf中图片清晰, 因此需要在截图时, 主动x2. 代价是pdf文件更大, 但可接受
 */
const Pixel_Zoom_Rate = 2
/**
 * 渲染webview最大高度(经实验, 当Electron窗口高度超过16380时, 会直接黑屏卡死, 所以需要专门限制下)
 */
const Const_Max_Webview_Render_Height_Px = 2000 * Pixel_Zoom_Rate
/**
 * webview中, js滚动返回和实际完成滚动时间不一致, 因此需要额外休眠等待. 等待时间过短会截取到错误图片
 */
const Const_Webview_Js_Scroll_Sleep_Second = 0.5
/**
 * 单卷中最多只能有5000条微博
 */
const Const_Max_Mblog_In_Single_Book = 5000
/**
 * 在宽度为760的前提下, sharp最多支持的jpg高度(正常值为60000, 安全起见取50000)
 * 超大图片在手机上也很难打开, 因此将分页高度改为25000, 这样每张图高30000px, 还算可以接受
 */
const Const_Max_Jpge_Height_In_Sharp_Px = 25000
/**
 * 屏幕分辨率是否正常
 * 
 * 高分屏下，截图截出来的实际像素和指定像素值不一致.
 * 设定宽度为760，但实际截屏结果为1520，会大2倍
 * 如果  Screen_Display_Rate 不一致， 需要提前对截图结果进行处理。 否则后续图片合并会失败
 */
let Is_Normal_Display_Rate = true
/**
 * jpg图片压缩比率
 * 实测显示, 对于相同内容文件, 压缩80%时体积1600kb, 50%时体积1000kb, 但pdf质量上没有肉眼可见区别
 */
const Const_Jpeg_Compress_Rate = 60


// 硬编码传入
let globalSubWindow: InstanceType<typeof BrowserWindow> = null
// 图片放大后, 页面宽度也要等比例放大
const Const_Default_Webview_Width = 760 * Pixel_Zoom_Rate;
const Const_Default_Webview_Height = 10;
class GenerateCustomer extends Base {
  static get signature() {
    return `
        Generate:Customer
    `
  }

  static get description() {
    return '输出微博记录'
  }

  /**
   * 配置项
   */
  /**
   * 分类依据
   */
  CONST_CONFIG_DATE_FORMAT = DATE_FORMAT.DATABASE_BY_DAY
  CUSTOMER_CONFIG_bookname: TaskConfig.Customer['bookTitle'] = ''
  CUSTOMER_CONFIG_comment: TaskConfig.Customer['comment'] = ''
  CUSTOMER_CONFIG_volumeSplitBy: TaskConfig.Customer['volumeSplitBy'] = 'single'
  CUSTOMER_CONFIG_volumeSplitCount: TaskConfig.Customer['volumeSplitCount'] = 10000
  CUSTOMER_CONFIG_postAtOrderBy: TaskConfig.Customer['postAtOrderBy'] = 'asc'
  CUSTOMER_CONFIG_imageQuilty: TaskConfig.Customer['imageQuilty'] = 'default'
  CUSTOMER_CONFIG_outputStartAtMs: TaskConfig.Customer['outputStartAtMs'] = 0
  CUSTOMER_CONFIG_outputEndAtMs: TaskConfig.Customer['outputEndAtMs'] =
    dayjs()
      .add(1, 'year')
      .unix() * 1000
  CUSTOMER_CONFIG_isSkipGeneratePdf: TaskConfig.Customer['isSkipGeneratePdf'] = false
  CUSTOMER_CONFIG_isRegenerateHtml2PdfImage: TaskConfig.Customer['isRegenerateHtml2PdfImage'] = false
  CUSTOMER_CONFIG_isSkipFetch: TaskConfig.Customer['isSkipFetch'] = false
  CUSTOMER_CONFIG_isOnlyArticle: TaskConfig.Customer['isOnlyArticle'] = false
  CUSTOMER_CONFIG_isOnlyOriginal: TaskConfig.Customer['isOnlyOriginal'] = false

  async detectIsNormalScreenRate() {
    // 首先先计算屏幕缩放比
    let webview = globalSubWindow.webContents;
    await globalSubWindow.setContentSize(
      Const_Default_Webview_Width,
      Const_Default_Webview_Height,
    );
    // 利用百度首页. 测试分辨率是否正常
    await webview.loadURL("https://m.baidu.com")
    let nativeImg = await webview.capturePage();
    let content = await nativeImg.toJPEG(100)
    let realWidth = imageSize.imageSize(content).width || Const_Default_Webview_Width
    Is_Normal_Display_Rate = realWidth / Const_Default_Webview_Width === 1
  }

  async execute(args: any, options: any): Promise<any> {
    let { subWindow } = args
    globalSubWindow = subWindow

    await this.detectIsNormalScreenRate()

    this.log(`从${PathConfig.customerTaskConfigUri}中读取配置文件`)
    let fetchConfigJSON = fs.readFileSync(PathConfig.customerTaskConfigUri).toString()
    this.log('content =>', fetchConfigJSON)
    let customerTaskConfig: TypeTaskConfig.Customer = json5.parse(fetchConfigJSON)

    this.CUSTOMER_CONFIG_bookname = customerTaskConfig.bookTitle
    this.CUSTOMER_CONFIG_comment = customerTaskConfig.comment
    this.CUSTOMER_CONFIG_outputStartAtMs = customerTaskConfig.outputStartAtMs
    this.CUSTOMER_CONFIG_outputEndAtMs = customerTaskConfig.outputEndAtMs

    this.CUSTOMER_CONFIG_volumeSplitBy = customerTaskConfig.volumeSplitBy
    this.CUSTOMER_CONFIG_volumeSplitCount = customerTaskConfig.volumeSplitCount
    this.CUSTOMER_CONFIG_postAtOrderBy = customerTaskConfig.postAtOrderBy
    this.CUSTOMER_CONFIG_imageQuilty = customerTaskConfig.imageQuilty
    this.CUSTOMER_CONFIG_isSkipFetch = customerTaskConfig.isSkipFetch
    this.CUSTOMER_CONFIG_isSkipGeneratePdf = customerTaskConfig.isSkipGeneratePdf
    this.CUSTOMER_CONFIG_isRegenerateHtml2PdfImage = customerTaskConfig.isRegenerateHtml2PdfImage
    this.CUSTOMER_CONFIG_isOnlyArticle = customerTaskConfig.isOnlyArticle
    this.CUSTOMER_CONFIG_isOnlyOriginal = customerTaskConfig.isOnlyOriginal

    let configList = customerTaskConfig.configList
    for (let config of configList) {
      let author_uid = config.uid
      // 配置当前生成的用户uid, 便于缓存
      this.currentAuthorUid = author_uid
      let userInfo = await MMblogUser.asyncGetUserInfo(author_uid)
      if (_.isEmpty(userInfo)) {
        this.log(`未抓取到对应的用户数据, 自动跳过`)
        return
      }
      let screenName = userInfo.screen_name
      this.log(`开始输出用户${screenName}的微博备份数据`)
      // 将任务中的数据按照问题/文章/想法进行汇总

      this.log(`获取数据记录`)

      let article_status_in = [0, 1]
      let retweet_status_in = [0, 1]
      if (this.CUSTOMER_CONFIG_isOnlyOriginal) {
        retweet_status_in = [0]
      }

      if (this.CUSTOMER_CONFIG_isOnlyArticle) {
        article_status_in = [1]
      }

      let mblogList = await MMblog.asyncGetMblogList(
        author_uid,
        this.CUSTOMER_CONFIG_outputStartAtMs / 1000,
        this.CUSTOMER_CONFIG_outputEndAtMs / 1000,
        retweet_status_in,
        article_status_in
      )
      mblogList.sort((a, b) => {
        // 先进行排序
        // 根据接口 https://m.weibo.cn/feed/friends?max_id=4448802586999203 可以确认, id为确认时间线的关键
        // 经测试, 仅通过id并不靠谱, 因此还是要使用发布日期作为排序依据.
        // 同一日期内再用id排序
        let aSortBy = a.created_timestamp_at
        let bSortBy = b.created_timestamp_at
        if (a.created_timestamp_at === b.created_timestamp_at) {
          // 日期相同时, 以id作为排序依据
          aSortBy = parseInt(a.id)
          bSortBy = parseInt(b.id)
        }
        if (this.CUSTOMER_CONFIG_postAtOrderBy === 'asc') {
          return aSortBy! - bSortBy!
        } else {
          return bSortBy! - aSortBy!
        }
      })

      this.log(`数据获取完毕, 共收录${mblogList.length}条微博`)

      let weiboEpubList = this.packageMblogList(mblogList, userInfo)

      let bookCounter = 0
      for (let resourcePackage of weiboEpubList) {
        bookCounter++
        let booktitle = ''
        if (weiboEpubList.length <= 1) {
          booktitle = `${resourcePackage.userInfo.screen_name}-微博整理-(${dayjs
            .unix(resourcePackage.startDayAt)
            .format(DATE_FORMAT.DISPLAY_BY_DAY)}~${dayjs
              .unix(resourcePackage.endDayAt)
              .format(DATE_FORMAT.DISPLAY_BY_DAY)})`
        } else {
          booktitle = `${resourcePackage.userInfo.screen_name}-微博整理-第${resourcePackage.bookIndex}/${resourcePackage.totalBookCount
            }卷-(${dayjs.unix(resourcePackage.startDayAt).format(DATE_FORMAT.DISPLAY_BY_DAY)}~${dayjs
              .unix(resourcePackage.endDayAt)
              .format(DATE_FORMAT.DISPLAY_BY_DAY)})`
        }
        this.log(`输出第${bookCounter}/${weiboEpubList.length}本电子书:${booktitle}`)
        await this.asyncGenerateEbook(bookCounter, booktitle, resourcePackage)
        this.log(`第${bookCounter}/${weiboEpubList.length}本电子书:${booktitle}输出完毕`)
      }
    }
  }

  /**
   * 1. 将微博按时间顺序排列
   * 2. 将微博按配置合并到一起
   * 3. 按配置
   *    1.  单本电子书最大微博数, 切分成微博Epub列表
   *    2.  按年切分成微博Epub列表
   * @param mblogList
   * @param userInfo
   */
  packageMblogList(mblogList: Array<TypeMblog>, userInfo: TypeWeiboUserInfo) {
    // 其次, 按天分隔微博
    let mblogListByMergeBy: Map<string, TypeWeiboListByDay> = new Map()
    let index = 0
    for (let mblog of mblogList) {
      index++
      let splitByStr = ''
      let mblogCreateAtTimestamp = <number>mblog.created_timestamp_at
      // 按日期分页
      splitByStr = dayjs.unix(mblogCreateAtTimestamp).format(this.CONST_CONFIG_DATE_FORMAT)
      let record = mblogListByMergeBy.get(splitByStr)
      if (record === undefined) {
        let a: TypeWeiboListByDay = {
          title:
            `${dayjs.unix(mblogCreateAtTimestamp).format(this.CONST_CONFIG_DATE_FORMAT)}`,
          dayStartAt: dayjs
            .unix(mblogCreateAtTimestamp)
            .startOf(DATE_FORMAT.UNIT.DAY)
            .unix(),
          weiboList: [mblog],
          splitByStr: splitByStr,
          postStartAt: mblogCreateAtTimestamp,
          postEndAt: mblogCreateAtTimestamp,
        }
        record = a
      } else {
        record.weiboList.push(mblog)
        // 更新文件标题
        if (mblogCreateAtTimestamp > record.postEndAt) {
          record.postEndAt = mblogCreateAtTimestamp
        }
        if (mblogCreateAtTimestamp < record.postStartAt) {
          record.postStartAt = mblogCreateAtTimestamp
          record.dayStartAt = dayjs
            .unix(mblogCreateAtTimestamp)
            .startOf(DATE_FORMAT.UNIT.DAY)
            .unix()
        }
      }
      mblogListByMergeBy.set(splitByStr, record)
    }
    // 然后, 按日期先后对记录
    let mblogListByDayList_OrderByPostStartAt = []
    for (let record of mblogListByMergeBy.values()) {
      mblogListByDayList_OrderByPostStartAt.push(record)
    }
    // 按记录开始日期从早到晚排序
    mblogListByDayList_OrderByPostStartAt.sort((a, b) => {
      return a.postStartAt - b.postStartAt
    })

    // 解除引用依赖
    mblogListByDayList_OrderByPostStartAt = _.cloneDeep(mblogListByDayList_OrderByPostStartAt)
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
    let bufEndDayAt = dayjs().unix()

    // 将按时间顺序排列的日级别微博记录, 处理为电子书数据包
    for (let mblogListByDay of mblogListByDayList_OrderByPostStartAt) {
      // 备份一下, 循环结束时使用
      bufEndDayAt = mblogListByDay.postEndAt

      if (weiboEpub.weiboDayList.length === 0) {
        // 首次添加
        weiboEpub.weiboDayList.push(mblogListByDay)
        weiboEpub.mblogInThisBookCount = mblogListByDay.weiboList.length
        weiboEpub.startDayAt = mblogListByDay.dayStartAt
        weiboEpub.bookIndex = bookIndex
      } else {
        // 首先检测是否超过了单卷最大数量(超过10000条, 由于pdf生成库本身的限制, 会导致pdf生成速度巨慢)
        if (weiboEpub.mblogInThisBookCount > Const_Max_Mblog_In_Single_Book) {
          // 超出单卷最大微博数, 需要进行分卷
          weiboEpub.endDayAt = weiboEpub.weiboDayList[weiboEpub.weiboDayList.length - 1].postEndAt
          let buffer = _.cloneDeep(weiboEpub)
          rawWeiboEpubList.push(buffer)
          // 重新起一个
          bookCounter = bookCounter + 1
          bookIndex = bookIndex + 1
          weiboEpub = _.cloneDeep(weiboEpubTemplate)
          // 初始化新容器
          weiboEpub.startDayAt = mblogListByDay.dayStartAt
          weiboEpub.bookIndex = bookIndex
        } else {
          // 然后在考虑其他情况
          if (this.CUSTOMER_CONFIG_volumeSplitBy !== 'single') {
            // 如果分卷依据不是single, 那么要先按照设定的分卷条件, 检查是否需要进行分卷
            switch (this.CUSTOMER_CONFIG_volumeSplitBy) {
              case 'year':
                {
                  if (dayjs.unix(weiboEpub.startDayAt).format("YYYY") !== dayjs.unix(mblogListByDay.dayStartAt).format("YYYY")) {
                    // 发生换年, 需要进行分卷
                    weiboEpub.endDayAt = weiboEpub.weiboDayList[weiboEpub.weiboDayList.length - 1].postEndAt
                    let buffer = _.cloneDeep(weiboEpub)
                    rawWeiboEpubList.push(buffer)
                    // 重新起一个
                    bookCounter = bookCounter + 1
                    bookIndex = bookIndex + 1
                    weiboEpub = _.cloneDeep(weiboEpubTemplate)
                    // 初始化新容器
                    weiboEpub.startDayAt = mblogListByDay.dayStartAt
                    weiboEpub.bookIndex = bookIndex
                  }
                }
                break;
              case 'month':
                {
                  if (dayjs.unix(weiboEpub.startDayAt).format("YYYY-MM") !== dayjs.unix(mblogListByDay.dayStartAt).format("YYYY-MM")) {
                    // 发生换月, 需要进行分卷
                    weiboEpub.endDayAt = weiboEpub.weiboDayList[weiboEpub.weiboDayList.length - 1].postEndAt
                    let buffer = _.cloneDeep(weiboEpub)
                    rawWeiboEpubList.push(buffer)
                    // 重新起一个
                    bookCounter = bookCounter + 1
                    bookIndex = bookIndex + 1
                    weiboEpub = _.cloneDeep(weiboEpubTemplate)
                    // 初始化新容器
                    weiboEpub.startDayAt = mblogListByDay.dayStartAt
                    weiboEpub.bookIndex = bookIndex
                  }
                }
                break;
              case 'count':
              default:
                {
                  if (weiboEpub.mblogInThisBookCount > this.CUSTOMER_CONFIG_volumeSplitCount) {
                    // 超出单卷最大微博数, 需要进行分卷
                    weiboEpub.endDayAt = weiboEpub.weiboDayList[weiboEpub.weiboDayList.length - 1].postEndAt
                    let buffer = _.cloneDeep(weiboEpub)
                    rawWeiboEpubList.push(buffer)
                    // 重新起一个
                    bookCounter = bookCounter + 1
                    bookIndex = bookIndex + 1
                    weiboEpub = _.cloneDeep(weiboEpubTemplate)
                    // 初始化新容器
                    weiboEpub.startDayAt = mblogListByDay.dayStartAt
                    weiboEpub.bookIndex = bookIndex
                  }
                }
            }
          }
        }
        weiboEpub.weiboDayList.push(mblogListByDay)
        weiboEpub.mblogInThisBookCount = weiboEpub.mblogInThisBookCount + mblogListByDay.weiboList.length
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

  /**
   * 生成电子书(html/pdf)
   * @param bookCounter
   * @param bookname
   * @param epubResourcePackage
   */
  async asyncGenerateEbook(bookCounter: number, bookname: string, epubResourcePackage: TypeWeiboEpub) {
    // 初始化资源, 重置所有静态类变量
    this.bookname = StringUtil.encodeFilename(`${bookname}`)
    // 重载基类中的imageQuilty
    this.imageQuilty = this.CUSTOMER_CONFIG_imageQuilty
    let { weiboDayList } = epubResourcePackage
    this.imgUriPool = new Set()

    // 若配置跳过图片缓存, 则重置
    if (this.CUSTOMER_CONFIG_isRegenerateHtml2PdfImage) {
      this.log(`配置了重新生成将html转为pdf的图片, 清空pdf图片生成缓存`)
      this.resetHtml2pdfImageCache()
    }

    // 初始化文件夹
    this.initStaticRecource()

    this.log(`生成微博记录html列表`)
    let htmlUriList = []
    let recordCounter = 0
    for (let weiboDayRecord of weiboDayList) {
      // 生成前一页, 后一页导航栏
      recordCounter++
      let beforeRecord = weiboDayList[recordCounter - 2]
      let nextRecord = weiboDayList[recordCounter]

      let title = weiboDayRecord.title
      let content = WeiboView.render(weiboDayRecord.weiboList, {
        renderGuideLine: true,
        nextRecord: nextRecord,
        beforeRecord: beforeRecord
      })
      content = this.processContent(content)
      let htmlUri = path.resolve(this.htmlCacheHtmlPath, `${title}.html`)
      fs.writeFileSync(htmlUri, content)
      // 渲染页面
      htmlUriList.push(htmlUri)
    }

    //  生成目录
    this.log(`生成目录`)
    let indexContent = BaseView.renderIndex(this.bookname, weiboDayList)
    fs.writeFileSync(path.resolve(this.htmlCacheHtmlPath, `index.html`), indexContent)

    // 处理静态资源
    await this.asyncProcessStaticResource()
    if (this.CUSTOMER_CONFIG_isSkipGeneratePdf) {
      this.log(`isSkipGeneratePdf为${this.CUSTOMER_CONFIG_isSkipGeneratePdf}, 自动跳过pdf输出阶段`)
    } else {
      let weiboDayConfigList = await this.transWeiboDayList2Image(weiboDayList)
      // 保存配置,方便调试
      fs.writeFileSync(path.resolve(this.html2ImageCache_ImagePath, `output.json`), JSON.stringify(weiboDayConfigList))
      await this.generatePdf(weiboDayConfigList)
    }
    // 输出完毕后, 将结果复制到dist文件夹中
    await this.asyncCopyToDist()
    this.log(`第${bookCounter}本电子书${this.bookname}生成完毕`)
  }

  async transWeiboDayList2Image(weiboDayList: TypeWeiboEpub['weiboDayList']) {
    // 首先生成单条微博对应的静态html文件, 以及对应配置
    let dayIndex = 0
    let weiboDayConfigList: TypeTransConfigPackageList = []
    for (let weiboDayRecord of weiboDayList) {
      dayIndex++
      this.log(`开始将记录${weiboDayRecord.title}(第${dayIndex}/${weiboDayList.length}项)下的微博渲染为图片`)
      let weiboRecordImgList: TypeTransConfigPackage = {
        title: weiboDayRecord.title,
        dayIndex,
        postStartAt: weiboDayRecord.postStartAt,
        postEndAt: weiboDayRecord.postEndAt,
        configList: []
      }
      let weiboIndex = 0
      for (let weiboRecord of weiboDayRecord.weiboList) {
        weiboIndex++

        this.log(
          `将记录${weiboDayRecord.title}(第${dayIndex}/${weiboDayList.length}项)下第${weiboIndex}/${weiboDayRecord.weiboList.length}条微博渲染为图片`,
        )
        let { htmlUri, imageUriList, htmlContent } = await this.transWeiboRecord2Image(weiboRecord)

        let transConfigItem: TypeTransConfigItem = {
          dayIndex,
          weiboIndex,
          htmlUri,
          imageUriList,
          htmlContent
        };

        weiboRecordImgList.configList.push(transConfigItem)
      }
      weiboDayConfigList.push(weiboRecordImgList)
    }
    // 处理完毕, 返回配置内容
    return weiboDayConfigList
  }

  async transWeiboRecord2Image(weiboRecord: TypeMblog) {
    // 以微博创建时间和微博id作为唯一key
    let baseFileTitle = `${dayjs.unix(weiboRecord.created_timestamp_at).format("YYYY-MM-DD HH：mm：ss")}_${weiboRecord.id}`

    let htmlUri = path.resolve(this.html2ImageCache_HtmlPath, `${baseFileTitle}.html`)
    let imageUriList: string[] = []
    let baseImageUri = path.resolve(this.html2ImageCache_ImagePath, `${baseFileTitle}_`)
    let content = WeiboView.render([weiboRecord])
    content = this.processContent(content)

    let transConfigItem = {
      htmlUri,
      imageUriList,
      htmlContent: content
    }
    for (let i = 0; i < 20; i++) {
      imageUriList.push(baseImageUri + `${i}.jpg`)
    }
    let existUriList: string[] = []
    for (let checkImgUri of imageUriList) {
      // 若已生成过文件, 则不需要重新生成, 自动跳过即可
      // 只要有一个文件生成, 就视为已生成
      if (fs.existsSync(checkImgUri)) {
        existUriList.push(checkImgUri)
      } else {
        // 到第一个不存在的图片自动停止
        break;
      }
    }
    if (existUriList.length > 0) {
      // 只要有一张图片存在, 就视为渲染成功
      transConfigItem.imageUriList = existUriList
      return transConfigItem
    }




    fs.writeFileSync(htmlUri, content)
    {
      // 渲染图片, 重复尝试3次, 避免因为意外导致js执行超时
      let { imageUriList, isRenderSuccess } = await this.html2Image(htmlUri, baseImageUri)
      if (isRenderSuccess === true) {
        transConfigItem.imageUriList = imageUriList
        return transConfigItem
      }
    }

    this.log(`${transConfigItem.htmlUri}第1次渲染失败, 渲染时间超过${Const_Render_Html_Timeout_Second}s, 自动退出. 进行第2次尝试`)

    {
      let { imageUriList, isRenderSuccess } = await this.html2Image(htmlUri, baseImageUri)
      if (isRenderSuccess === true) {
        this.log(`${transConfigItem.htmlUri}渲染成功`)
        transConfigItem.imageUriList = imageUriList
        return transConfigItem
      }
    }
    this.log(`${transConfigItem.htmlUri}第2次渲染失败, 渲染时间超过${Const_Render_Html_Timeout_Second}s, 自动退出. 进行第2次尝试`)
    {
      let { imageUriList, isRenderSuccess } = await this.html2Image(htmlUri, baseImageUri)
      if (isRenderSuccess === true) {
        this.log(`${transConfigItem.htmlUri}渲染成功`)
        transConfigItem.imageUriList = imageUriList
        return transConfigItem
      }
    }
    this.log(`${transConfigItem.htmlUri}第3次渲染失败, 渲染时间超过${Const_Render_Html_Timeout_Second}s, 自动退出. 不再尝试`)

    // 每生成一张图片休眠1s, 避免界面卡死
    await CommonUtil.asyncSleep(1000 * 0.1)
    return transConfigItem
  }


  /**
   * 将html渲染为图片, 成功返回true, 渲染失败或超时返回false
   * @param pageConfig 
   */
  async html2Image(htmlUri: string, baseImageUri: string): Promise<{ imageUriList: string[], isRenderSuccess: boolean }> {
    let webview = globalSubWindow.webContents;
    let subWindow = globalSubWindow
    if (htmlUri.startsWith("file://") === false && htmlUri.startsWith("http://") === false) {
      // mac上载入文件时, 必须要有file://前缀
      htmlUri = 'file://' + htmlUri
    }

    return await new Promise((reslove, reject) => {
      let timmerId = setTimeout(() => {
        // 增加20s超时退出限制
        globalSubWindow.reload()
        reslove({ imageUriList: [], isRenderSuccess: false })
      }, Const_Render_Html_Timeout_Second * 1000)

      let render = async () => {
        // 先载入html文件
        // this.log("load url -> ", pageConfig.htmlUri)
        await webview.loadURL(htmlUri);
        // this.log("setContentSize -> ", Const_Default_Webview_Width, Const_Default_Webview_Height)
        // 然后设置分辨率, Const_Default_Webview_Width x Const_Default_Webview_Height, 这里是正常的
        await globalSubWindow.setContentSize(
          Const_Default_Webview_Width,
          Const_Default_Webview_Height,
        );
        // 若希望文件清晰, 分辨率需进行放大
        globalSubWindow.webContents.setZoomFactor(Pixel_Zoom_Rate)

        // 放大后页面scrollHeight为css值, 需要乘以放大系数后, 才是实际像素值
        // @alert 注意, 在这里有可能卡死, 表现为卡住停止执行. 所以需要在外部加一个超时限制
        // this.log("resize page, executeJavaScript ")
        let scrollHeight = await webview.executeJavaScript(
          `document.children[0].children[1].scrollHeight`,
        ) * Pixel_Zoom_Rate;

        let imageUriList: string[] = []
        if (scrollHeight > Const_Max_Webview_Render_Height_Px) {
          // html页面太大, 需要分页输出, 最后再合成一张图片返回
          let imgContentList: {
            input: Buffer,
            top: number,
            left: 0,
            // 本张图片高度
            imgHeightPx: number,
          }[] = []
          let remainHeight = scrollHeight
          await subWindow.setContentSize(Const_Default_Webview_Width, Const_Max_Webview_Render_Height_Px);

          while (remainHeight >= Const_Max_Webview_Render_Height_Px) {
            let imgIndex = imgContentList.length;
            // 在页面内滚动时, 需要将实际像素重新转为逻辑像素
            let currentOffsetHeight = Const_Max_Webview_Render_Height_Px / Pixel_Zoom_Rate * imgIndex
            // 先移动到offset高度
            let command = `document.children[0].children[1].scrollTop = ${currentOffsetHeight}`
            await webview.executeJavaScript(command);

            // 然后对界面截屏
            // js指令执行后, 滚动到指定位置还需要时间, 所以截屏前需要sleep一下
            await CommonUtil.asyncSleep(1000 * Const_Webview_Js_Scroll_Sleep_Second)
            let nativeImg = await webview.capturePage();
            let content = await nativeImg.toJPEG(100)


            if (Is_Normal_Display_Rate === false) {
              // 不等于1则需要缩放
              content = await sharp(content).resize(Const_Default_Webview_Width).toBuffer()
            }


            remainHeight = remainHeight - Const_Max_Webview_Render_Height_Px

            imgContentList.push(
              {
                input: content,
                top: Const_Max_Webview_Render_Height_Px * imgIndex,
                left: 0,
                imgHeightPx: Const_Max_Webview_Render_Height_Px,
              }
            )
          }
          if (remainHeight > 0) {
            // 最后捕捉剩余高度页面

            // 首先调整页面高度
            await subWindow.setContentSize(Const_Default_Webview_Width, remainHeight);
            // 然后走流程, 捕捉界面
            // 在页面内滚动时, 需要将实际像素重新转为逻辑像素
            let currentOffsetHeight = Const_Max_Webview_Render_Height_Px / Pixel_Zoom_Rate * imgContentList.length
            let imgIndex = imgContentList.length;

            // 先移动到offset高度
            let command = `document.children[0].children[1].scrollTop = ${currentOffsetHeight}`
            await webview.executeJavaScript(command);
            // 然后对界面截屏
            // js指令执行后, 滚动到指定位置还需要时间, 所以截屏前需要sleep一下
            await CommonUtil.asyncSleep(1000 * Const_Webview_Js_Scroll_Sleep_Second)
            let nativeImg = await webview.capturePage();

            let content = await nativeImg.toJPEG(100)

            if (Is_Normal_Display_Rate === false) {
              // 不等于1则需要缩放
              content = await sharp(content).resize(Const_Default_Webview_Width).toBuffer()
            }

            imgContentList.push(
              {
                input: content,
                top: Const_Max_Webview_Render_Height_Px * imgIndex,
                left: 0,
                imgHeightPx: remainHeight,
              }
            )
          }

          // 拿到所有分页图后, 将图片分组合并
          let currentTotalHeight = 0;
          let currentImgContentList: any[] = [];
          let currentImgIndex = 0;
          let currentHeightOffset = 0
          // 先颠倒一下, 方便pop
          imgContentList.reverse()
          while (imgContentList.length > 0) {
            let item = imgContentList.pop()
            let rawTop = item!.top
            let rawImgHeightPx = item!.imgHeightPx
            // 高度差需要减去偏移量
            item!.top = item!.top - currentHeightOffset
            currentTotalHeight += item!.imgHeightPx
            currentImgContentList.push(item)

            // 对元素分组处理
            if (currentTotalHeight > Const_Max_Jpge_Height_In_Sharp_Px) {
              // 保存偏移量, 下一组元素要统一减去上一组的偏移量
              currentHeightOffset = rawTop + rawImgHeightPx

              let imgUri = baseImageUri + `${currentImgIndex}.jpg`
              let mergeImg = sharp({
                create: {
                  width: Const_Default_Webview_Width,
                  height: currentTotalHeight,
                  channels: 4,
                  background: {
                    r: 255, g: 255, b: 255, alpha: 1,
                  },
                }
              }).jpeg()
              mergeImg.composite(
                currentImgContentList
              )
              let jpgContent = await mergeImg.toBuffer().catch(e => {
                this.log("mergeImg error => ", e)
                return new Buffer("")
              })
              let out = mozjpeg.encode(jpgContent, {
                //处理质量 百分比
                quality: Const_Jpeg_Compress_Rate
              });
              jpgContent = out.data
              fs.writeFileSync(
                path.resolve(imgUri),
                jpgContent,
              );
              imageUriList.push(imgUri)
              currentImgIndex = currentImgIndex + 1
              currentTotalHeight = 0
              currentImgContentList = []
            }
          }
          // 处理剩余元素
          if (currentImgContentList.length > 0) {
            let imgUri = baseImageUri + `${currentImgIndex}.jpg`
            let mergeImg = sharp({
              create: {
                width: Const_Default_Webview_Width,
                height: currentTotalHeight,
                channels: 4,
                background: {
                  r: 255, g: 255, b: 255, alpha: 1,
                },
              }
            }).jpeg()
            mergeImg.composite(
              currentImgContentList
            )
            let jpgContent = await mergeImg.toBuffer().catch(e => {
              this.log("mergeImg error => ", e)
              return new Buffer("")
            })
            let out = mozjpeg.encode(jpgContent, {
              //处理质量 百分比
              quality: Const_Jpeg_Compress_Rate
            });
            jpgContent = out.data
            fs.writeFileSync(
              path.resolve(imgUri),
              jpgContent,
            );
            imageUriList.push(imgUri)
            currentImgIndex = currentImgIndex + 1
            currentTotalHeight = 0
            currentImgContentList = []
          }
        } else {
          // 小于最大宽度, 只要截屏一次就可以
          await subWindow.setContentSize(Const_Default_Webview_Width, scrollHeight);

          // this.log("setContentSize with scrollHeight -> ", scrollHeight)
          let nativeImg = await webview.capturePage();
          let jpgContent = await nativeImg.toJPEG(100);

          if (Is_Normal_Display_Rate === false) {
            // 不等于1则需要缩放
            jpgContent = await sharp(jpgContent).resize(Const_Default_Webview_Width).toBuffer()
          }

          let out = mozjpeg.encode(jpgContent, {
            //处理质量 百分比
            quality: Const_Jpeg_Compress_Rate
          });
          jpgContent = out.data
          let imageUri = baseImageUri + '0.jpg'
          fs.writeFileSync(
            path.resolve(imageUri),
            jpgContent,
          );
          imageUriList.push(imageUri)
        }

        // this.log(`jpgContent 输出完毕. length => ${jpgContent.length}`)

        // this.log('generateImage complete');
        // 每张图片最大渲染时间不能超过10s
        clearTimeout(timmerId)
        reslove({ imageUriList, isRenderSuccess: true })
      }

      render().catch(e => {
        const error = e as Error

        this.log(`${htmlUri}转换图片失败. 错误信息:`, {
          "message": error?.message,
          "stack": error?.stack,
        })
        reslove({ imageUriList: [], isRenderSuccess: false })
      })
    })

  }

  async generatePdf(weiboDayList: TypeTransConfigPackageList) {

    let doc = new jsPDF({
      unit: 'px',
      format: [Const_Default_Webview_Width, 700],
      orientation: "landscape"
    })
    // let fontUri = path.resolve(__dirname, '../../public/font/mi_sans_normal_thin.ttf')
    // // 瘦身后的字体, 只支持以下文字
    // // !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[]^_`abcdefghijklmnopqrstuvwxyz{|}~第卷微博整理该文件由稳部落自动生成项目主页
    // let fontName = "mi_sans_normal_thin" 
    // 恢复使用方正书宋字体
    let fontUri = path.resolve(__dirname, '../../public/font/fangzheng_shusong_normal.ttf')
    let fontName = "fangzheng_shusong_normal"
    let fontContent = fs.readFileSync(fontUri)

    doc.addFileToVFS(`${fontName}.ttf`, fontContent.toString("base64"))
    doc.addFont(`${fontName}.ttf`, fontName, "normal")
    doc.setFont(fontName, "normal");
    doc.setFontSize(32)

    // demo =>  yaozeyuan93-微博整理-第1/2卷-(2011-07-07~2012-01-25)
    let rawBooktitle = this.bookname
    let contentList = rawBooktitle.split(`-微博整理-`)
    let accountName = contentList[0]

    let timeRangeStartAt = contentList[1].indexOf('(')
    let timeRangeEndAt = contentList[1].indexOf(')')
    let timeRangeStr = contentList[1].slice(timeRangeStartAt + '('.length, timeRangeEndAt)

    let columnStartAt = contentList[1].indexOf('第')
    let columnEndAt = contentList[1].indexOf('卷')
    let columnStr = ''
    if (columnStartAt >= 0) {
      // 先把关键语句提取出来, 后续根据需要再处理
      columnStr = contentList[1].slice(columnStartAt + '第'.length, columnEndAt)
      columnStr = `-第${columnStr}卷`
    }


    let lineAt = 0
    let lineHeight = 40
    let paddingLeft = Const_Default_Webview_Width / 2

    function addLine(content: string) {
      lineAt = lineAt + 1
      doc.text(content, paddingLeft, lineHeight * lineAt, {
        align: 'center',
      })
    }
    function addLink(content: string) {
      lineAt = lineAt + 1
      doc.setTextColor("blue")
      doc.textWithLink(content, paddingLeft, lineHeight * lineAt, {
        align: 'center',
        url: content
      })
    }
    addLine("")
    addLine(accountName)
    addLine(`微博整理${columnStr}`)
    addLine(timeRangeStr)
    addLine("")
    addLine("该文件由稳部落自动生成")
    addLine("")
    addLine("pdf本身支持天级别目录&文本检索, 但需要阅读器支持")
    addLine("电脑端推荐通过 Chrome浏览器/福昕阅读器 打开")
    addLine("手机端推荐通过 多看阅读 打开")
    addLine("")
    addLine("项目主页")
    addLink("https://www.yaozeyuan.online/stablog")


    let currentPageNo = 2
    let outlineConfigList: {
      title: string,
      pageNo: number,
    }[] = []
    // 先加一页, 避免出现空白页
    let dayIndex = 0
    for (let weiboDayRecord of weiboDayList) {
      dayIndex++
      this.log(`将页面${weiboDayRecord.title}(第${dayIndex}/${weiboDayList.length}项)添加到pdf文件中`)
      let weiboIndex = 0
      outlineConfigList.push({
        title: weiboDayRecord.title,
        pageNo: currentPageNo,
      })

      for (let weiboRecord of weiboDayRecord.configList) {
        weiboIndex++
        this.log(
          `正在添加页面${weiboDayRecord.title}(第${dayIndex}/${weiboDayList.length}项)下,第${weiboIndex}/${weiboDayRecord.configList.length}条微博`,
        )
        for (let i = 0; i < weiboRecord.imageUriList.length; i++) {
          let imgUri = weiboRecord.imageUriList[i];
          if (fs.existsSync(imgUri) === false) {
            this.log(`第${weiboIndex}/${weiboDayRecord.configList.length}条微博, ${imgUri}渲染失败, 自动跳过`)
            continue
          }
          const fileContent = fs.readFileSync(imgUri)
          if (fileContent.byteLength === 0) {
            this.log(`第${weiboIndex}/${weiboDayRecord.configList.length}条微博, ${imgUri}图片体积为0, 为非法文件, 自动跳过`)
            continue
          }

          let imageBuffer = fs.readFileSync(imgUri)

          let size: { width: number | undefined, height: number | undefined } = { width: 0, height: 0 }
          try {
            size = await imageSize.imageSize(imageBuffer)
          } catch (e) {
            this.log(`第${weiboIndex}/${weiboDayRecord.configList.length}条微博, ${imgUri}图片宽高解析失败, 为非法文件, 自动跳过&自动删除图片`)
            fs.unlinkSync(imgUri)
          }
          let { width = 0, height = 0 } = size
          if (!width || width <= 0 || !height || height <= 0) {
            this.log(`第${weiboIndex}/${weiboDayRecord.configList.length}条微博截图捕获失败, 自动跳过`)
            continue
          }

          doc.addPage([width, height], width > height ? "landscape" : "portrait")
          doc.addImage(
            {
              imageData: imageBuffer,
              x: 0,
              y: 0,
              width: width,
              height: height,
            })
          if (i === 0) {
            // 只在第一页添加文字
            doc.setFontSize(0.001)
            doc.text(weiboRecord.htmlContent, 0, 0, {
              // align: 'center',
            })
          }
          currentPageNo = currentPageNo + 1
          if (currentPageNo % 10 === 0) {
            // 休眠0.1秒, 避免因频繁添加页面导致界面卡死
            await CommonUtil.asyncSleep(1000 * 0.1)
          }
        }
      }
    }
    // 开始补充导航栏
    var node = doc.outline.add(null, '首页', { pageNumber: 1 });
    // 通过hack的方式, 生成年月日三级目录
    type Type_Node = {
      node: any,
      pageNo: number,
      children: {
        [key: string]: Type_Node
      }
    }

    let node_map: {
      [year: string]: Type_Node
    } = {}
    for (let outlineConfig of outlineConfigList) {
      let [year, month, day] = outlineConfig.title.split('-');
      if (node_map[year] === undefined) {
        // 初始化年份
        let yearNode = doc.outline.add(node, year, { pageNumber: outlineConfig.pageNo });
        node_map[year] = {
          node: yearNode,
          pageNo: outlineConfig.pageNo,
          children: {}
        }
        let monthNode = doc.outline.add(yearNode, `${year}-${month}`, { pageNumber: outlineConfig.pageNo });
        node_map[year] = {
          node: yearNode,
          pageNo: outlineConfig.pageNo,
          children: {
            [month]: {
              node: monthNode,
              pageNo: outlineConfig.pageNo,
              children: {}
            }
          }
        }
        let dayNode = doc.outline.add(monthNode, `${year}-${month}-${day}`, { pageNumber: outlineConfig.pageNo });
        node_map[year] = {
          node: yearNode,
          pageNo: outlineConfig.pageNo,
          children: {
            [month]: {
              node: monthNode,
              pageNo: outlineConfig.pageNo,
              children: {
                [day]: {
                  node: dayNode,
                  pageNo: outlineConfig.pageNo,
                  children: {}
                }
              }
            }
          }
        }
        continue;
      }
      if (node_map[year]['children'][month] === undefined) {
        // 初始化月份
        let yearNode = node_map[year]['node']
        let monthNode = doc.outline.add(yearNode, `${year}-${month}`, { pageNumber: outlineConfig.pageNo });
        node_map[year]['children'][month] = {
          node: monthNode,
          pageNo: outlineConfig.pageNo,
          children: {}
        }
        let dayNode = doc.outline.add(monthNode, `${year}-${month}-${day}`, { pageNumber: outlineConfig.pageNo });
        node_map[year]['children'][month]['children'][day] = {
          node: dayNode,
          pageNo: outlineConfig.pageNo,
          children: {}
        }
        continue;
      }
      // 否则, 添加日期节点
      let yearNode = node_map[year]['node']
      let monthNode = node_map[year]['children'][month]['node']
      let dayNode = doc.outline.add(monthNode, `${year}-${month}-${day}`, { pageNumber: outlineConfig.pageNo });
      node_map[year]['children'][month]['children'][day] = {
        node: dayNode,
        pageNo: outlineConfig.pageNo,
        children: {}
      }
    }

    await doc.save(path.resolve(this.htmlCachePdfPath, `${this.bookname}.pdf`), { returnPromise: true })
    this.log(`pdf输出完毕`)
  }
}
export default GenerateCustomer
