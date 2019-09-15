import Base from '~/src/command/generate/base'
import TypeWeibo from '~/src/type/namespace/weibo'
import TypeTaskConfig from '~/src/type/namespace/task_config'
import PathConfig from '~/src/config/path'
import MMblog from '~/src/model/mblog'
import MMblogUser from '~/src/model/mblog_user'

import _ from 'lodash'
import json5 from 'json5'

import AnswerView from '~/src/view/answer'
import PinView from '~/src/view/pin'
import ArticleView from '~/src/view/article'
import BaseView from '~/src/view/base'
import fs from 'fs'
import path from 'path'
import StringUtil from '~/src/library/util/string'

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
    fs.writeFileSync(`${PathConfig.htmlOutputPath}/test.json`, JSON.stringify(mblogList, null, 4))
    return

    this.log(`将任务中的数据按照问题/文章/想法进行汇总`)
    let taskIndex = 0
    for (let taskConfig of customerTaskConfig.configList) {
      taskIndex = taskIndex + 1
      this.log(
        `处理第${taskIndex}/${customerTaskConfig.configList.length}个任务, 任务类型:${taskConfig.type}, 任务备注:${taskConfig.comment}`,
      )
      let taskType = taskConfig.type
      let targetId = `${taskConfig.id}`
    }
    // 将回答按照问题合并在一起
    let uniqQuestionMap: {
      [questionId: string]: {
        [answerId: string]: TypeAnswer.Record
      }
    } = {}
    for (let answer of answerList) {
      if (uniqQuestionMap[answer.question.id]) {
        uniqQuestionMap[answer.question.id][answer.id] = answer
      } else {
        uniqQuestionMap[answer.question.id] = {
          [answer.id]: answer,
        }
      }
    }

    for (let questionId of Object.keys(uniqQuestionMap)) {
      let answerMap = uniqQuestionMap[questionId]
      let answerList = []
      for (let answerId of Object.keys(answerMap)) {
        let answer = answerMap[answerId]
        answerList.push(answer)
      }
      questionList.push(answerList)
    }

    this.log(`所有数据获取完毕, 最终结果为=>`)
    this.log(`问题 => ${questionList.length}个`)
    this.log(`文章 => ${articleList.length}篇`)
    this.log(`想法 => ${pinList.length}条`)
    this.log(`按配置排序`)
    // 需要倒过来排, 这样排出来的结果才和预期一致
    let reverseOrderByList = _.cloneDeep(orderByList)
    reverseOrderByList.reverse()
    for (let orderByConfig of reverseOrderByList) {
      // 需要额外对questionList中的answerList进行排序
      let bufQuestionList = []
      switch (orderByConfig.orderBy) {
        case 'voteUpCount':
          for (let answerList of questionList) {
            answerList.sort((item1, item2) => {
              if (orderByConfig.order === 'asc') {
                return item1.voteup_count - item2.voteup_count
              } else {
                return item2.voteup_count - item1.voteup_count
              }
            })
            bufQuestionList.push(answerList)
          }
          questionList = bufQuestionList

          questionList.sort((item1, item2) => {
            let item1VoteUpCount = 0
            let item2VoteUpCount = 0
            for (let answerInItem1 of item1) {
              item1VoteUpCount += answerInItem1.voteup_count
            }
            for (let answerInItem2 of item2) {
              item2VoteUpCount += answerInItem2.voteup_count
            }
            if (orderByConfig.order === 'asc') {
              return item1VoteUpCount - item2VoteUpCount
            } else {
              return item2VoteUpCount - item1VoteUpCount
            }
          })
          articleList.sort((item1, item2) => {
            let item1VoteUpCount = item1.voteup_count
            let item2VoteUpCount = item2.voteup_count
            if (orderByConfig.order === 'asc') {
              return item1VoteUpCount - item2VoteUpCount
            } else {
              return item2VoteUpCount - item1VoteUpCount
            }
          })
          pinList.sort((item1, item2) => {
            let item1VoteUpCount = item1.like_count
            let item2VoteUpCount = item2.like_count
            if (orderByConfig.order === 'asc') {
              return item1VoteUpCount - item2VoteUpCount
            } else {
              return item2VoteUpCount - item1VoteUpCount
            }
          })
          break
        case 'commentCount':
          for (let answerList of questionList) {
            answerList.sort((item1, item2) => {
              if (orderByConfig.order === 'asc') {
                return item1.comment_count - item2.comment_count
              } else {
                return item2.comment_count - item1.comment_count
              }
            })
            bufQuestionList.push(answerList)
          }
          questionList = bufQuestionList

          questionList.sort((item1, item2) => {
            let item1CommentCount = 0
            let item2CommentCount = 0
            for (let answerInItem1 of item1) {
              item1CommentCount += answerInItem1.comment_count
            }
            for (let answerInItem2 of item2) {
              item2CommentCount += answerInItem2.comment_count
            }
            if (orderByConfig.order === 'asc') {
              return item1CommentCount - item2CommentCount
            } else {
              return item2CommentCount - item1CommentCount
            }
          })
          articleList.sort((item1, item2) => {
            let item1CommentCount = item1.comment_count
            let item2CommentCount = item2.comment_count
            if (orderByConfig.order === 'asc') {
              return item1CommentCount - item2CommentCount
            } else {
              return item2CommentCount - item1CommentCount
            }
          })
          pinList.sort((item1, item2) => {
            let item1CommentCount = item1.comment_count
            let item2CommentCount = item2.comment_count
            if (orderByConfig.order === 'asc') {
              return item1CommentCount - item2CommentCount
            } else {
              return item2CommentCount - item1CommentCount
            }
          })
          break
        case 'createAt':
          for (let answerList of questionList) {
            answerList.sort((item1, item2) => {
              if (orderByConfig.order === 'asc') {
                return item1.created_time - item2.created_time
              } else {
                return item2.created_time - item1.created_time
              }
            })
            bufQuestionList.push(answerList)
          }
          questionList = bufQuestionList

          questionList.sort((item1, item2) => {
            let item1MinCreateAt = 99999999999999999999999
            let item1MaxCreateAt = 0
            let item2MinCreateAt = 99999999999999999999999
            let item2MaxCreateAt = 0
            for (let answerInItem1 of item1) {
              if (answerInItem1.created_time > item1MaxCreateAt) {
                item1MaxCreateAt = answerInItem1.created_time
              }
              if (answerInItem1.created_time < item1MinCreateAt) {
                item1MinCreateAt = answerInItem1.created_time
              }
            }
            for (let answerInItem2 of item2) {
              if (answerInItem2.created_time > item2MaxCreateAt) {
                item2MaxCreateAt = answerInItem2.created_time
              }
              if (answerInItem2.created_time < item2MinCreateAt) {
                item2MinCreateAt = answerInItem2.created_time
              }
            }
            if (orderByConfig.order === 'asc') {
              return item1MinCreateAt - item2MinCreateAt
            } else {
              return item1MaxCreateAt - item2MaxCreateAt
            }
          })
          articleList.sort((item1, item2) => {
            if (orderByConfig.order === 'asc') {
              return item1.created - item2.created
            } else {
              return item2.created - item1.created
            }
          })
          pinList.sort((item1, item2) => {
            if (orderByConfig.order === 'asc') {
              return item1.created - item2.created
            } else {
              return item2.created - item1.created
            }
          })
          break
        case 'updateAt':
          for (let answerList of questionList) {
            answerList.sort((item1, item2) => {
              if (orderByConfig.order === 'asc') {
                return item1.updated_time - item2.updated_time
              } else {
                return item2.updated_time - item1.updated_time
              }
            })
            bufQuestionList.push(answerList)
          }
          questionList = bufQuestionList

          questionList.sort((item1, item2) => {
            let item1MinUpdateAt = 99999999999999999999999
            let item1MaxUpdateAt = 0
            let item2MinUpdateAt = 99999999999999999999999
            let item2MaxUpdateAt = 0
            for (let answerInItem1 of item1) {
              if (answerInItem1.updated_time > item1MaxUpdateAt) {
                item1MaxUpdateAt = answerInItem1.updated_time
              }
              if (answerInItem1.updated_time < item1MinUpdateAt) {
                item1MinUpdateAt = answerInItem1.updated_time
              }
            }
            for (let answerInItem2 of item2) {
              if (answerInItem2.updated_time > item2MaxUpdateAt) {
                item2MaxUpdateAt = answerInItem2.updated_time
              }
              if (answerInItem2.updated_time < item2MinUpdateAt) {
                item2MinUpdateAt = answerInItem2.updated_time
              }
            }
            if (orderByConfig.order === 'asc') {
              return item1MinUpdateAt - item2MinUpdateAt
            } else {
              return item1MaxUpdateAt - item2MaxUpdateAt
            }
          })
          articleList.sort((item1, item2) => {
            if (orderByConfig.order === 'asc') {
              return item1.updated - item2.updated
            } else {
              return item2.updated - item1.updated
            }
          })
          pinList.sort((item1, item2) => {
            if (orderByConfig.order === 'asc') {
              return item1.updated - item2.updated
            } else {
              return item2.updated - item1.updated
            }
          })
          break
      }
    }

    // 按最大允许值切分列表
    let epubResourceList: Array<EpubResourcePackage> = []
    let fileCounter = 0

    let splitQuestionList: Array<Array<TypeAnswer.Record>> = []
    let splitArticleList: Array<TypeArticle.Record> = []
    let splitPinList: Array<TypePin.Record> = []

    for (let answerList of questionList) {
      splitQuestionList.push(answerList)
      fileCounter++
      if (fileCounter >= maxQuestionOrArticleInBook) {
        epubResourceList.push({
          questionList: splitQuestionList,
          articleList: splitArticleList,
          pinList: splitPinList,
        })
        splitQuestionList = []
        splitArticleList = []
        splitPinList = []
        fileCounter = 0
      }
    }

    for (let article of articleList) {
      splitArticleList.push(article)
      fileCounter++
      if (fileCounter >= maxQuestionOrArticleInBook) {
        epubResourceList.push({
          questionList: splitQuestionList,
          articleList: splitArticleList,
          pinList: splitPinList,
        })
        splitQuestionList = []
        splitArticleList = []
        splitPinList = []
        fileCounter = 0
      }
    }

    for (let pin of pinList) {
      splitPinList.push(pin)
      fileCounter++
      if (fileCounter >= maxQuestionOrArticleInBook) {
        epubResourceList.push({
          questionList: splitQuestionList,
          articleList: splitArticleList,
          pinList: splitPinList,
        })
        splitQuestionList = []
        splitArticleList = []
        splitPinList = []
        fileCounter = 0
      }
    }
    // 将剩余未被收集的资源, 一起打成一个包
    if (splitQuestionList.length || splitArticleList.length || splitPinList.length) {
      epubResourceList.push({
        questionList: splitQuestionList,
        articleList: splitArticleList,
        pinList: splitPinList,
      })
    }

    let bookCounter = 0
    for (let resourcePackage of epubResourceList) {
      bookCounter++
      let booktitle = ''
      if (epubResourceList.length <= 1) {
        booktitle = bookname
      } else {
        booktitle = `${bookname}-第${bookCounter}卷`
      }
      this.log(`输出电子书:${booktitle}`)
      await this.generateEpub(booktitle, imageQuilty, resourcePackage)
      this.log(`电子书:${booktitle}输出完毕`)
    }
  }

  async generateEpub(
    bookname: string,
    imageQuilty: TypeTaskConfig.imageQuilty,
    epubResourcePackage: EpubResourcePackage,
  ) {
    // 初始化资源, 重置所有静态类变量
    this.bookname = StringUtil.encodeFilename(`${bookname}`)
    this.imageQuilty = imageQuilty
    let { questionList, articleList, pinList } = epubResourcePackage
    this.imgUriPool = new Set()

    // 初始化文件夹
    this.initStaticRecource()

    // 单独记录生成的元素, 以便输出成单页
    let totalElementListToGenerateSinglePage = []
    this.log(`生成问题html列表`)
    for (let answerRecordList of questionList) {
      let title = answerRecordList[0].question.id
      let content = AnswerView.render(answerRecordList)
      content = this.processContent(content)
      fs.writeFileSync(path.resolve(this.htmlCacheHtmlPath, `${title}.html`), content)
      this.epub.addHtml(answerRecordList[0].question.title, path.resolve(this.htmlCacheHtmlPath, `${title}.html`))

      // 单独记录生成的元素, 以便输出成单页文件
      let contentElementList = []
      for (let answerRecord of answerRecordList) {
        let contentElement = BaseView.generateSingleAnswerElement(answerRecord)
        contentElementList.push(contentElement)
      }
      let elememt = BaseView.generateQuestionElement(answerRecordList[0].question, contentElementList)
      totalElementListToGenerateSinglePage.push(elememt)
    }

    this.log(`生成文章列表`)
    for (let articleRecord of articleList) {
      let title = articleRecord.id
      let content = ArticleView.render(articleRecord)
      content = this.processContent(content)
      fs.writeFileSync(path.resolve(this.htmlCacheHtmlPath, `${title}.html`), content)
      this.epub.addHtml(articleRecord.title, path.resolve(this.htmlCacheHtmlPath, `${title}.html`))

      // 单独记录生成的元素, 以便输出成单页文件
      let elememt = BaseView.generateSingleArticleElement(articleRecord)
      totalElementListToGenerateSinglePage.push(elememt)
    }

    this.log(`生成想法列表`)
    for (let pinRecord of pinList) {
      let title = pinRecord.id
      let content = PinView.render(pinRecord)
      content = this.processContent(content)
      fs.writeFileSync(path.resolve(this.htmlCacheHtmlPath, `${title}.html`), content)
      this.epub.addHtml(pinRecord.excerpt_title, path.resolve(this.htmlCacheHtmlPath, `${title}.html`))

      // 单独记录生成的元素, 以便输出成单页文件
      let elememt = BaseView.generateSinglePinElement(pinRecord)
      totalElementListToGenerateSinglePage.push(elememt)
    }

    this.log(`生成单一html文件`)
    // 生成全部文件
    let pageElement = BaseView.generatePageElement(this.bookname, totalElementListToGenerateSinglePage)
    let content = BaseView.renderToString(pageElement)
    this.log(`内容渲染完毕, 开始对内容进行输出前预处理`)
    content = this.processContent(content)
    fs.writeFileSync(path.resolve(this.htmlCacheSingleHtmlPath, `${this.bookname}.html`), content)

    //  生成目录
    this.log(`生成目录`)
    let firstAnswerInQuestionToRenderIndexList = []
    for (let answerRecordList of questionList) {
      // 只取回答列表中的第一个元素, 以便生成目录
      firstAnswerInQuestionToRenderIndexList.push(answerRecordList[0])
    }
    let indexContent = BaseView.renderIndex(this.bookname, [
      ...firstAnswerInQuestionToRenderIndexList,
      ...articleList,
      ...pinList,
    ])
    fs.writeFileSync(path.resolve(this.htmlCacheHtmlPath, `index.html`), indexContent)
    this.epub.addIndexHtml('目录', path.resolve(this.htmlCacheHtmlPath, `index.html`))

    // 处理静态资源
    await this.asyncProcessStaticResource()

    this.log(`自定义电子书${this.bookname}生成完毕`)
  }
}

export default GenerateCustomer
