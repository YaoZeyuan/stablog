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

import WeiboView from '~/src/view/weibo'
import BaseView from '~/src/view/base'
import fs from 'fs'
import path from 'path'
import StringUtil from '~/src/library/util/string'
import moment from 'moment'

// 将本地html渲染为img
import puppeteer from 'puppeteer'

// 将img输出为pdf
import PDFKit from 'pdfkit'
import TaskConfig from '~/src/type/namespace/task_config'

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
  CUSTOMER_CONFIG_DATE_FORMAT = DATE_FORMAT.DISPLAY_BY_DAY
  CUSTOMER_CONFIG_bookname: TaskConfig.Customer['bookTitle'] = ''
  CUSTOMER_CONFIG_comment: TaskConfig.Customer['comment'] = ''
  CUSTOMER_CONFIG_mergeBy: TaskConfig.Customer['mergeBy'] = 'day'
  CUSTOMER_CONFIG_mergeCount: TaskConfig.Customer['mergeCount'] = 1000
  CUSTOMER_CONFIG_postAtOrderBy: TaskConfig.Customer['postAtOrderBy'] = 'asc'
  CUSTOMER_CONFIG_imageQuilty: TaskConfig.Customer['imageQuilty'] = 'default'
  CUSTOMER_CONFIG_maxBlogInBook: TaskConfig.Customer['maxBlogInBook'] = 1000

  async execute(args: any, options: any): Promise<any> {
    this.log(`从${PathConfig.customerTaskConfigUri}中读取配置文件`)
    let fetchConfigJSON = fs.readFileSync(PathConfig.customerTaskConfigUri).toString()
    this.log('content =>', fetchConfigJSON)
    let customerTaskConfig: TypeTaskConfig.Customer = json5.parse(fetchConfigJSON)

    this.CUSTOMER_CONFIG_bookname = customerTaskConfig.bookTitle
    this.CUSTOMER_CONFIG_comment = customerTaskConfig.comment
    this.CUSTOMER_CONFIG_mergeBy = customerTaskConfig.mergeBy
    // 根据mergeBy类别, 生成日期格式化参数
    switch (this.CUSTOMER_CONFIG_mergeBy) {
      case 'day':
        this.CUSTOMER_CONFIG_DATE_FORMAT = DATE_FORMAT.DISPLAY_BY_DAY
        break
      case 'month':
        this.CUSTOMER_CONFIG_DATE_FORMAT = DATE_FORMAT.DISPLAY_BY_MONTH
        break
      case 'year':
        this.CUSTOMER_CONFIG_DATE_FORMAT = DATE_FORMAT.DISPLAY_BY_YEAR
        break
      default:
        this.CUSTOMER_CONFIG_DATE_FORMAT = DATE_FORMAT.DISPLAY_BY_DAY
        break
    }
    this.CUSTOMER_CONFIG_mergeCount = customerTaskConfig.mergeCount
    this.CUSTOMER_CONFIG_postAtOrderBy = customerTaskConfig.postAtOrderBy
    this.CUSTOMER_CONFIG_imageQuilty = customerTaskConfig.imageQuilty
    this.CUSTOMER_CONFIG_maxBlogInBook = customerTaskConfig.maxBlogInBook
    let configList = customerTaskConfig.configList
    for (let config of configList) {
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
      mblogList.sort((a, b) => {
        // 先进行排序
        let aSortBy = a.created_timestamp_at
        let bSortBy = b.created_timestamp_at
        if (a.created_timestamp_at === b.created_timestamp_at) {
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
        this.log(`输出第${bookCounter}/${weiboEpubList.length}本电子书:${booktitle}`)
        await this.asyncGenerateEbook(bookCounter, booktitle, resourcePackage)
        this.log(`第第${bookCounter}/${weiboEpubList.length}本电子书:${booktitle}输出完毕`)
      }
    }
  }

  /**
   * 1. 将微博按时间顺序排列
   * 2. 将微博按配置合并到一起
   * 3. 按配置单本电子书最大微博数, 切分成微博Epub列表
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
      if (this.CUSTOMER_CONFIG_mergeBy === 'count') {
        // 按条数分页
        splitByStr = `${Math.ceil(index / this.CUSTOMER_CONFIG_mergeCount)}`
      } else {
        // 按日期分页
        splitByStr = moment.unix(mblogCreateAtTimestamp).format(this.CUSTOMER_CONFIG_DATE_FORMAT)
      }
      let record = mblogListByMergeBy.get(splitByStr)
      if (record === undefined) {
        let a: TypeWeiboListByDay = {
          title:
            this.CUSTOMER_CONFIG_mergeBy === 'count'
              ? `${moment.unix(mblogCreateAtTimestamp).format(this.CUSTOMER_CONFIG_DATE_FORMAT)}-${moment
                  .unix(mblogCreateAtTimestamp)
                  .format(this.CUSTOMER_CONFIG_DATE_FORMAT)}`
              : `${moment.unix(mblogCreateAtTimestamp).format(this.CUSTOMER_CONFIG_DATE_FORMAT)}`,
          dayStartAt: moment
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
        }
        if (this.CUSTOMER_CONFIG_mergeBy === 'count') {
          record.title = `${moment.unix(record.postStartAt).format(this.CUSTOMER_CONFIG_DATE_FORMAT)}-${moment
            .unix(record.postEndAt)
            .format(this.CUSTOMER_CONFIG_DATE_FORMAT)}`
        }
      }
      mblogListByMergeBy.set(splitByStr, record)
    }
    // 然后, 按日期先后对记录
    let mblogListByDayList = []
    for (let record of mblogListByMergeBy.values()) {
      mblogListByDayList.push(record)
    }
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
      if (weiboEpub.mblogInThisBookCount > this.CUSTOMER_CONFIG_maxBlogInBook) {
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

  /**
   * 生成电子书(html/pdf)
   * @param bookCounter
   * @param bookname
   * @param epubResourcePackage
   */
  async asyncGenerateEbook(bookCounter: number, bookname: string, epubResourcePackage: TypeWeiboEpub) {
    // 初始化资源, 重置所有静态类变量
    this.bookname = StringUtil.encodeFilename(`${bookname}`)
    this.imageQuilty = this.CUSTOMER_CONFIG_imageQuilty
    let { weiboDayList } = epubResourcePackage
    this.imgUriPool = new Set()

    // 初始化文件夹
    this.initStaticRecource()

    this.log(`生成微博记录html列表`)
    let htmlUriList = []
    for (let weiboDayRecord of weiboDayList) {
      let title = weiboDayRecord.title
      let content = WeiboView.render(weiboDayRecord.weiboList)
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
    await this.generatePdf(weiboDayList)
    // 输出完毕后, 将结果复制到dist文件夹中
    await this.asyncCopyToDist()
    this.log(`第${bookCounter}本电子书${this.bookname}生成完毕`)
  }

  async generatePdf(weiboDayList: TypeWeiboEpub['weiboDayList']) {
    // 启动Chrome
    const browser = await puppeteer.launch({
      defaultViewport: {
        width: 750,
        height: 1, // 要设的足够小
      },
    })
    let page = await browser.newPage()

    let pdfDocument
    let pdfSaveStream = fs.createWriteStream(path.resolve(this.htmlCachePdfPath, `${this.bookname}.pdf`))
    // 先加一页, 避免出现空白页
    let dayIndex = 0
    for (let weiboDayRecord of weiboDayList) {
      dayIndex++
      this.log(`正在处理第${dayIndex}/${weiboDayList.length}批微博记录`)
      let weiboIndex = 0
      for (let weiboRecord of weiboDayRecord.weiboList) {
        weiboIndex++
        this.log(
          `正在处理第${dayIndex}/${weiboDayList.length}批下,第${weiboIndex}/${weiboDayRecord.weiboList.length}条微博`,
        )
        let content = WeiboView.render([weiboRecord])
        content = this.processContent(content)
        let htmlUri = path.resolve(this.htmlCacheHtmlPath, `demo.html`)
        fs.writeFileSync(htmlUri, content)
        await page.setViewport({
          width: 750,
          height: 1,
        })
        await page.goto(htmlUri)
        let imageBuffer = await page.screenshot({ type: 'jpeg', quality: 70, fullPage: true, omitBackground: true })
        if (imageBuffer.length < 1000) {
          // 图片渲染失败
          this.log(`第${dayIndex}/${weiboDayList.length}条微博渲染失败, 自动跳过`)
          continue
        } else {
          this.log(`第${dayIndex}/${weiboDayList.length}条微博渲染成功`)
          let size = await imageSize.imageSize(imageBuffer)
          let { width, height } = size
          this.log(`图片size=>`, { width, height })
          if (!width || width <= 0 || !height || height <= 0) {
            this.log(`第${dayIndex}/${weiboDayList.length}条微博截图捕获失败, 自动跳过`)
            continue
          }
          if (pdfDocument === undefined) {
            // 初始化pdf类
            pdfDocument = new PDFKit({
              margin: 0,
              layout: 'landscape',
              size: [height, width], // a smaller document for small badge printers
            })
            pdfDocument.pipe(pdfSaveStream)
          } else {
            // 将图片数据添加到pdf文件中
            pdfDocument.addPage({
              margin: 0,
              layout: 'landscape',
              size: [height, width], // a smaller document for small badge printers
            })
          }
          pdfDocument.image(imageBuffer)
        }
      }
    }
    await page.close()
    await browser.close()
    if (pdfDocument) {
      pdfDocument.end()
      // 等待pdf文件写入完毕
      await new Promise((resolve, reject) => {
        pdfSaveStream.on('finish', function() {
          // do stuff with the PDF file
          resolve()
        })
      })
    }
    this.log(`pdf输出完毕`)
  }
}

export default GenerateCustomer
