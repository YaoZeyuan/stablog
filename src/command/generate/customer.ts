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
import moment from 'moment'
import * as mozjpeg from "mozjpeg-js"

// 将img输出为pdf
import TaskConfig from '~/src/type/namespace/task_config'
import jsPDF from 'jspdf'
import { BrowserWindow } from 'electron'

const Const_Render_Html_Timeout_Second = 15

// 硬编码传入
let globalSubWindow: InstanceType<typeof BrowserWindow> = null
const Const_Default_Webview_Width = 760;
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
  CUSTOMER_CONFIG_DATE_FORMAT = DATE_FORMAT.DISPLAY_BY_DAY
  CUSTOMER_CONFIG_bookname: TaskConfig.Customer['bookTitle'] = ''
  CUSTOMER_CONFIG_comment: TaskConfig.Customer['comment'] = ''
  CUSTOMER_CONFIG_mergeBy: TaskConfig.Customer['mergeBy'] = 'day'
  CUSTOMER_CONFIG_mergeCount: TaskConfig.Customer['mergeCount'] = 1000
  CUSTOMER_CONFIG_postAtOrderBy: TaskConfig.Customer['postAtOrderBy'] = 'asc'
  CUSTOMER_CONFIG_imageQuilty: TaskConfig.Customer['imageQuilty'] = 'default'
  CUSTOMER_CONFIG_pdfQuilty: TaskConfig.Customer['pdfQuilty'] = 70
  CUSTOMER_CONFIG_maxBlogInBook: TaskConfig.Customer['maxBlogInBook'] = 1000
  CUSTOMER_CONFIG_outputStartAtMs: TaskConfig.Customer['outputStartAtMs'] = 0
  CUSTOMER_CONFIG_outputEndAtMs: TaskConfig.Customer['outputEndAtMs'] =
    moment()
      .add(1, 'year')
      .unix() * 1000
  CUSTOMER_CONFIG_isSkipGeneratePdf: TaskConfig.Customer['isSkipGeneratePdf'] = false
  CUSTOMER_CONFIG_isSkipFetch: TaskConfig.Customer['isSkipFetch'] = false

  async execute(args: any, options: any): Promise<any> {
    let { subWindow } = args
    globalSubWindow = subWindow
    this.log(`从${PathConfig.customerTaskConfigUri}中读取配置文件`)
    let fetchConfigJSON = fs.readFileSync(PathConfig.customerTaskConfigUri).toString()
    this.log('content =>', fetchConfigJSON)
    let customerTaskConfig: TypeTaskConfig.Customer = json5.parse(fetchConfigJSON)

    this.CUSTOMER_CONFIG_bookname = customerTaskConfig.bookTitle
    this.CUSTOMER_CONFIG_comment = customerTaskConfig.comment
    this.CUSTOMER_CONFIG_mergeBy = customerTaskConfig.mergeBy
    this.CUSTOMER_CONFIG_outputStartAtMs = customerTaskConfig.outputStartAtMs
    this.CUSTOMER_CONFIG_outputEndAtMs = customerTaskConfig.outputEndAtMs
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
    this.CUSTOMER_CONFIG_pdfQuilty = customerTaskConfig.pdfQuilty || 60 // 加上默认值
    this.CUSTOMER_CONFIG_maxBlogInBook = customerTaskConfig.maxBlogInBook
    this.CUSTOMER_CONFIG_isSkipFetch = customerTaskConfig.isSkipFetch
    this.CUSTOMER_CONFIG_isSkipGeneratePdf = customerTaskConfig.isSkipGeneratePdf
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

      let mblogList = await MMblog.asyncGetMblogList(
        author_uid,
        this.CUSTOMER_CONFIG_outputStartAtMs / 1000,
        this.CUSTOMER_CONFIG_outputEndAtMs / 1000,
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
          booktitle = `${resourcePackage.userInfo.screen_name}-微博整理(${moment
            .unix(resourcePackage.startDayAt)
            .format(DATE_FORMAT.DISPLAY_BY_DAY)}~${moment
              .unix(resourcePackage.endDayAt)
              .format(DATE_FORMAT.DISPLAY_BY_DAY)})`
        } else {
          booktitle = `${resourcePackage.userInfo.screen_name}-微博整理-第${resourcePackage.bookIndex}/${resourcePackage.totalBookCount
            }卷(${moment.unix(resourcePackage.startDayAt).format(DATE_FORMAT.DISPLAY_BY_DAY)}~${moment
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
          record.dayStartAt = moment
            .unix(mblogCreateAtTimestamp)
            .startOf(DATE_FORMAT.UNIT.DAY)
            .unix()
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
      bufEndDayAt = mblogListByDay.postEndAt

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
        weiboEpub.endDayAt = mblogListByDay.postEndAt
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
    // 重载基类中的imageQuilty
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
    if (this.CUSTOMER_CONFIG_isSkipGeneratePdf) {
      this.log(`isSkipGeneratePdf为${this.CUSTOMER_CONFIG_isSkipGeneratePdf}, 自动跳过pdf输出阶段`)
    } else {
      let weiboDayConfigList = await this.transWeiboRecord2Image(weiboDayList)
      await this.generatePdf(weiboDayConfigList)
    }
    // 输出完毕后, 将结果复制到dist文件夹中
    await this.asyncCopyToDist()
    this.log(`第${bookCounter}本电子书${this.bookname}生成完毕`)
  }

  async transWeiboRecord2Image(weiboDayList: TypeWeiboEpub['weiboDayList']) {
    // 首先生成单条微博对应的静态html文件, 以及对应配置
    let dayIndex = 0
    let weiboDayConfigList: TypeTransConfigPackageList = []
    for (let weiboDayRecord of weiboDayList) {
      dayIndex++
      this.log(`开始将记录${weiboDayRecord.title}(第${dayIndex}/${weiboDayList.length}项)下的微博渲染为图片`)
      let weiboRecordImgList: TypeTransConfigPackage = {
        title: weiboDayRecord.title,
        dayIndex,
        configList: []
      }
      let weiboIndex = 0
      for (let weiboRecord of weiboDayRecord.weiboList) {
        weiboIndex++
        let baseFileTitle = `${dayIndex}_${weiboIndex}`
        this.log(
          `正在渲染记录${weiboDayRecord.title}(第${dayIndex}/${weiboDayList.length}项)下第${weiboIndex}/${weiboDayRecord.weiboList.length}条微博`,
        )
        let content = WeiboView.render([weiboRecord])
        content = this.processContent(content)
        let htmlUri = path.resolve(this.htmlCacheHtmlPath, `${baseFileTitle}.html`)
        let imageUri = path.resolve(this.html2ImageCachePath, `${baseFileTitle}.jpg`)
        fs.writeFileSync(htmlUri, content)
        let transConfigItem: TypeTransConfigItem = {
          dayIndex,
          weiboIndex,
          htmlUri,
          imageUri,
        }
        // 渲染图片, 重复尝试3次, 避免因为意外导致js执行超时
        let isRenderSuccess = await this.html2Image(transConfigItem)
        if (isRenderSuccess === false) {
          this.log(`${transConfigItem.htmlUri}第1次渲染失败, 渲染时间超过${Const_Render_Html_Timeout_Second}s, 自动退出. 进行第2次尝试`)
          isRenderSuccess = await this.html2Image(transConfigItem)
          if (isRenderSuccess === true) {
            this.log(`${transConfigItem.htmlUri}渲染成功`)
          }
        }
        if (isRenderSuccess === false) {
          this.log(`${transConfigItem.htmlUri}第2次渲染失败, 渲染时间超过${Const_Render_Html_Timeout_Second}s, 自动退出. 进行第2次尝试`)
          isRenderSuccess = await this.html2Image(transConfigItem)
          if (isRenderSuccess === true) {
            this.log(`${transConfigItem.htmlUri}渲染成功`)
          } else {
            this.log(`${transConfigItem.htmlUri}渲染失败`)
          }
        }
        weiboRecordImgList.configList.push(transConfigItem)
      }
      weiboDayConfigList.push(weiboRecordImgList)
    }
    // 处理完毕, 返回配置内容
    return weiboDayConfigList
  }

  /**
   * 将html渲染为图片, 成功返回true, 渲染失败或超时返回false
   * @param pageConfig 
   */
  async html2Image(pageConfig: TypeTransConfigItem): Promise<boolean> {
    let webview = globalSubWindow.webContents;
    let subWindow = globalSubWindow

    return await new Promise((reslove, reject) => {
      let timmerId = setTimeout(() => {
        // 增加20s超时退出限制
        globalSubWindow.reload()
        reslove(false)
      }, Const_Render_Html_Timeout_Second * 1000)

      let render = async () => {
        // this.log("load url -> ", pageConfig.htmlUri)
        await webview.loadURL(pageConfig.htmlUri);
        // this.log("setContentSize -> ", Const_Default_Webview_Width, Const_Default_Webview_Height)
        await globalSubWindow.setContentSize(
          Const_Default_Webview_Width,
          Const_Default_Webview_Height,
        );
        // @alert 注意, 在这里有可能卡死, 表现为卡住停止执行. 所以需要在外部加一个超时限制
        // this.log("resize page, executeJavaScript ")
        let scrollHeight = await webview.executeJavaScript(
          `document.children[0].children[1].scrollHeight`,
        );
        // this.log('scrollHeight => ', scrollHeight);
        // this.log("setContentSize with scrollHeight -> ", scrollHeight)
        await subWindow.setContentSize(Const_Default_Webview_Width, scrollHeight);
        // 生成图片
        // this.log('start generateImage');
        let nativeImg = await webview.capturePage();
        let jpgContent = nativeImg.toJPEG(100);
        // 基于mozjpeg压缩图片
        let out = mozjpeg.encode(jpgContent, {
          //处理质量 百分比
          quality: 80
        });
        jpgContent = out.data
        fs.writeFileSync(
          path.resolve(pageConfig.imageUri),
          jpgContent,
        );
        // this.log('generateImage complete');
        // 每张图片最大渲染时间不能超过10s
        clearTimeout(timmerId)
        reslove(true)
      }

      render()
    })

  }

  async generatePdf(weiboDayList: TypeTransConfigPackageList) {

    let doc = new jsPDF({
      unit: 'px',
      format: [Const_Default_Webview_Width, 500],
      orientation: "landscape"
    })
    let fontUri = path.resolve(__dirname, '../../public/font/alibaba_PuHuiTi_Regular.ttf')
    let fontContent = fs.readFileSync(fontUri)
    let fontName = "alibaba_PuHuiTi_Regular"

    doc.addFileToVFS(`${fontName}.ttf`, fontContent.toString("base64"))
    doc.addFont(`${fontName}.ttf`, fontName, "normal")
    doc.setFont(fontName, "normal");
    doc.setFontSize(32)

    // demo =>  yaozeyuan93-微博整理(2011-07-07~2012-01-25)
    let rawBooktitle = this.bookname
    let contentList = rawBooktitle.split(`-微博整理`)
    let accountName = contentList[0]
    let timeRangeStr = contentList[1]
    timeRangeStr = timeRangeStr.replace("(", "")
    timeRangeStr = timeRangeStr.replace(")", "")

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
    addLine("微博整理")
    addLine(accountName)
    addLine(timeRangeStr)
    addLine("")
    addLine("该文件由稳部落自动生成")
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
        let imgUri = weiboRecord.imageUri
        if (fs.existsSync(imgUri) === false) {
          // 图片渲染失败
          this.log(`第${weiboIndex}/${weiboDayRecord.configList.length}条微博渲染失败, 自动跳过`)
          continue
        } else {
          let imageBuffer = fs.readFileSync(imgUri)

          let size = await imageSize.imageSize(imageBuffer)
          let { width, height } = size
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
              height: height
            })
          currentPageNo = currentPageNo + 1
        }
      }
    }
    // 开始补充导航栏
    var node = doc.outline.add(null, '首页', { pageNumber: 1 });
    for (let outlineConfig of outlineConfigList) {
      doc.outline.add(node, outlineConfig.title, { pageNumber: outlineConfig.pageNo });

    }

    await doc.save(path.resolve(this.htmlCachePdfPath, `${this.bookname}.pdf`), { returnPromise: true })
    this.log(`pdf输出完毕`)
  }
}
export default GenerateCustomer
