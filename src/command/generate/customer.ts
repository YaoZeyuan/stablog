import Base from '~/src/command/generate/base'
import TypeTaskConfig from '~/src/type/namespace/task_config'
import TypeAnswer from '~/src/type/namespace/answer'
import TypePin from '~/src/type/namespace/pin'
import TypeArticle from '~/src/type/namespace/article'
import PathConfig from '~/src/config/path'
import MAuthorAskQuestion from '~/src/model/author_ask_question'
import MActivity from '~/src/model/activity'
import MTotalAnswer from '~/src/model/total_answer'
import MArticle from '~/src/model/article'
import MTopic from '~/src/model/topic'
import MCollection from '~/src/model/collection'
import MColumn from '~/src/model/column'
import MPin from '~/src/model/pin'
import _ from 'lodash'
import json5 from 'json5'

import AnswerView from '~/src/view/answer'
import PinView from '~/src/view/pin'
import ArticleView from '~/src/view/article'
import BaseView from '~/src/view/base'
import fs from 'fs'
import path from 'path'
import StringUtil from '~/src/library/util/string'

type EpubResourcePackage = {
  questionList: Array<Array<TypeAnswer.Record>>
  articleList: Array<TypeArticle.Record>
  pinList: Array<TypePin.Record>
}

class GenerateCustomer extends Base {
  static get signature() {
    return `
        Generate:Customer
    `
  }

  static get description() {
    return '输出自定义电子书'
  }

  async execute(args: any, options: any): Promise<any> {
    this.log(`从${PathConfig.customerTaskConfigUri}中读取配置文件`)
    let fetchConfigJSON = fs.readFileSync(PathConfig.customerTaskConfigUri).toString()
    this.log('content =>', fetchConfigJSON)
    let customerTaskConfig: TypeTaskConfig.Customer = json5.parse(fetchConfigJSON)

    let bookname = customerTaskConfig.bookTitle
    let comment = customerTaskConfig.comment
    let imageQuilty = customerTaskConfig.imageQuilty
    let maxQuestionOrArticleInBook = customerTaskConfig.maxQuestionOrArticleInBook
    let orderByList = customerTaskConfig.orderByList

    this.log(`开始输出自定义电子书, 共有${customerTaskConfig.configList.length}个任务`)
    // 将任务中的数据按照问题/文章/想法进行汇总
    let answerList: Array<TypeAnswer.Record> = []
    let questionList: Array<Array<TypeAnswer.Record>> = []
    let articleList: Array<TypeArticle.Record> = []
    let pinList: Array<TypePin.Record> = []

    this.log(`将任务中的数据按照问题/文章/想法进行汇总`)
    let taskIndex = 0
    for (let taskConfig of customerTaskConfig.configList) {
      taskIndex = taskIndex + 1
      this.log(
        `处理第${taskIndex}/${customerTaskConfig.configList.length}个任务, 任务类型:${taskConfig.type}, 任务备注:${
          taskConfig.comment
        }`,
      )
      let taskType = taskConfig.type
      let targetId = `${taskConfig.id}`
      switch (taskConfig.type) {
        case 'author-ask-question':
          this.log(`获取用户${targetId}所有提问过的问题`)
          let questionIdList = await MAuthorAskQuestion.asyncGetAuthorAskQuestionIdList(targetId)
          this.log(`用户${targetId}所有提问过的问题id列表获取完毕`)
          this.log(`开始获取用户${targetId}所有提问过的问题下的回答列表`)
          let answerListInAuthorAskQuestion = await MTotalAnswer.asyncGetAnswerListByQuestionIdList(questionIdList)
          this.log(`用户${targetId}所有提问过的问题下的回答列表获取完毕`)
          answerList = answerList.concat(answerListInAuthorAskQuestion)
          break
        case 'author-answer':
          this.log(`获取用户${targetId}所有回答过的答案`)
          let answerListInAuthorHasAnswer = await MTotalAnswer.asyncGetAnswerListByAuthorUrlToken(targetId)
          this.log(`用户${targetId}所有回答过的答案获取完毕`)
          answerList = answerList.concat(answerListInAuthorHasAnswer)
          break
        case 'author-pin':
          this.log(`获取用户${targetId}所有发表过的想法`)
          let pinListByAuthorPost = await MPin.asyncGetPinListByAuthorUrlToken(targetId)
          this.log(`用户${targetId}所有发表过的想法获取完毕`)
          pinList = pinList.concat(pinListByAuthorPost)
          break
        case 'topic':
          this.log(`获取话题${targetId}下所有精华回答id`)
          let answerIdListInTopic = await MTopic.asyncGetAnswerIdList(targetId)
          this.log(`话题${targetId}下精华回答id列表获取完毕`)
          this.log(`话题${targetId}下精华回答列表`)
          let answerListInTopic = await MTotalAnswer.asyncGetAnswerList(answerIdListInTopic)
          this.log(`话题${targetId}下精华回答列表获取完毕`)
          answerList = answerList.concat(answerListInTopic)
          break
        case 'collection':
          this.log(`获取收藏夹${targetId}下所有回答id`)
          let answerIdListInCollection = await MCollection.asyncGetAnswerIdList(targetId)
          this.log(`收藏夹${targetId}下回答id列表获取完毕`)
          this.log(`获取收藏夹${targetId}下回答列表`)
          let answerListInCollection = await MTotalAnswer.asyncGetAnswerList(answerIdListInCollection)
          this.log(`收藏夹${targetId}下回答列表获取完毕`)
          answerList = answerList.concat(answerListInCollection)
          break
        case 'column':
          this.log(`获取专栏${targetId}下所有文章`)
          let articleListInColumn = await MArticle.asyncGetArticleListByColumnId(targetId)
          this.log(`专栏${targetId}下所有文章获取完毕`)
          articleList = articleList.concat(articleListInColumn)
          break
        case 'article':
          this.log(`获取文章${targetId}`)
          let singleArticle = await MArticle.asyncGetArticle(targetId)
          if (_.isEmpty(singleArticle)) {
            this.log(`文章${targetId}不存在, 自动跳过`)
            continue
          }
          this.log(`文章${targetId}获取完毕`)
          articleList.push(singleArticle)
          break
        case 'question':
          this.log(`获取问题${targetId}下的回答列表`)
          let answerListInQuestion = await MTotalAnswer.asyncGetAnswerListByQuestionIdList([targetId])
          this.log(`问题${targetId}下的回答列表获取完毕`)
          answerList = answerList.concat(answerListInQuestion)
          break
        case 'answer':
          this.log(`获取回答${targetId}`)
          let singleAnswer = await MTotalAnswer.asyncGetAnswer(targetId)
          if (_.isEmpty(singleAnswer)) {
            this.log(`回答${targetId}不存在, 自动跳过`)
            continue
          }
          this.log(`回答${targetId}获取完毕`)
          answerList.push(singleAnswer)
          break
        case 'pin':
          this.log(`获取想法${targetId}`)
          let singlePin = await MPin.asyncGetPin(targetId)
          if (_.isEmpty(singlePin)) {
            this.log(`想法${targetId}不存在, 自动跳过`)
            continue
          }
          this.log(`想法${targetId}获取完毕`)
          pinList.push(singlePin)
          break
        case 'author-agree-article':
          this.log(`获取用户${targetId}赞同过的所有文章id`)
          let articleIdListInAuthorAgreeArticle = await MActivity.asyncGetAllActivityTargetIdList(
            targetId,
            MActivity.VERB_MEMBER_VOTEUP_ARTICLE,
          )
          this.log(`用户${targetId}赞同过的所有文章id获取完毕`)
          this.log(`获取用户${targetId}赞同过的所有文章`)
          let articleListInAuthorAgreeArticle = await MArticle.asyncGetArticleList(articleIdListInAuthorAgreeArticle)
          this.log(`用户${targetId}赞同过的所有文章获取完毕`)
          articleList = articleList.concat(articleListInAuthorAgreeArticle)
          break
        case 'author-agree-answer':
          this.log(`获取用户${targetId}赞同过的所有回答id`)
          let answerIdListInAuthorAgreeAnswer = await MActivity.asyncGetAllActivityTargetIdList(
            targetId,
            MActivity.VERB_ANSWER_VOTE_UP,
          )
          this.log(`用户${targetId}赞同过的所有回答id获取完毕`)
          this.log(`获取用户${targetId}赞同过的所有回答`)
          let answerListInAuthorAgreeAnswer = await MTotalAnswer.asyncGetAnswerList(answerIdListInAuthorAgreeAnswer)
          this.log(`用户${targetId}赞同过的所有回答获取完毕`)
          answerList = answerList.concat(answerListInAuthorAgreeAnswer)
          break
        case 'author-watch-question':
          this.log(`获取用户${targetId}关注过的所有问题id`)
          let questionIdListInAuthorWatchQuestion = await MActivity.asyncGetAllActivityTargetIdList(
            targetId,
            MActivity.VERB_QUESTION_FOLLOW,
          )
          this.log(`用户${targetId}关注过的所有问题id获取完毕`)
          this.log(`获取用户${targetId}关注过的所有问题id下的所有回答`)
          let answerListInAuthorWatchQuestion = await MTotalAnswer.asyncGetAnswerListByQuestionIdList(
            questionIdListInAuthorWatchQuestion,
          )
          this.log(`用户${targetId}关注过的所有问题id下的所有回答获取完毕`)
          answerList = answerList.concat(answerListInAuthorWatchQuestion)
          break
        default:
          this.log(`不支持的任务类型:${taskConfig.type}, 自动跳过`)
      }
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
