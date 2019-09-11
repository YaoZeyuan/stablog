import Base from '~/src/command/fetch/base'
import TypeTaskConfig from '~/src/type/namespace/task_config'
import PathConfig from '~/src/config/path'
import fs from 'fs'
import BatchFetchAnswer from '~/src/command/fetch/batch/answer'
import BatchFetchArticle from '~/src/command/fetch/batch/article'
import BatchFetchAuthorActivity from '~/src/command/fetch/batch/author_activity'
import BatchFetchAuthorAnswer from '~/src/command/fetch/batch/author_answer'
import BatchFetchAuthorAskQuestion from '~/src/command/fetch/batch/author_ask_question'
import BatchFetchAuthorPin from '~/src/command/fetch/batch/author_pin'
import BatchFetchCollection from '~/src/command/fetch/batch/collection'
import BatchFetchColumn from '~/src/command/fetch/batch/column'
import BatchFetchPin from '~/src/command/fetch/batch/pin'
import BatchFetchQuestion from '~/src/command/fetch/batch/question'
import BatchFetchTopic from '~/src/command/fetch/batch/topic'
import Logger from '~/src/library/logger'
import json5 from 'json5'

class FetchCustomer extends Base {
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
    this.log(`开始进行自定义抓取, 共有${customerTaskConfig.configList.length}个任务`)
    // 首先, 将任务进行汇总
    type TypeTaskPackage = {
      [key: string]: Array<string>
    }
    let taskListPackage: TypeTaskPackage = {}
    this.log(`合并抓取任务`)
    for (let taskConfig of customerTaskConfig.configList) {
      let taskType = taskConfig.type
      let targetId = `${taskConfig.id}`
      if (taskConfig.type in taskListPackage === false) {
        taskListPackage[taskType] = []
      }
      switch (taskConfig.type) {
        case 'author-ask-question':
          taskListPackage[taskConfig.type].push(targetId)
          break
        case 'author-answer':
          taskListPackage[taskConfig.type].push(targetId)
          break
        case 'author-pin':
          taskListPackage[taskConfig.type].push(targetId)
          break
        case 'topic':
          taskListPackage[taskConfig.type].push(targetId)
          break
        case 'collection':
          taskListPackage[taskConfig.type].push(targetId)
          break
        case 'column':
          taskListPackage[taskConfig.type].push(targetId)
          break
        case 'article':
          taskListPackage[taskConfig.type].push(targetId)
          break
        case 'question':
          taskListPackage[taskConfig.type].push(targetId)
          break
        case 'answer':
          taskListPackage[taskConfig.type].push(targetId)
          break
        case 'pin':
          taskListPackage[taskConfig.type].push(targetId)
          break
        case 'author-agree-article':
        case 'author-agree-answer':
        case 'author-watch-question':
          if (taskListPackage[taskConfig.type].includes(targetId) === false) {
            // 抓取用户活动记录工作量巨大, 因此在生成抓取任务时进行去重处理
            taskListPackage[taskConfig.type].push(targetId)
          }
          break
        default:
          this.log(`不支持的任务类型:${taskConfig.type}, 自动跳过`)
      }
    }

    this.log(`抓取任务合并完毕, 最终结果为=>`, taskListPackage)

    this.log(`开始派发自定义任务=>`)

    for (let taskType of Object.keys(taskListPackage)) {
      let targetIdList = taskListPackage[taskType]
      switch (taskType) {
        case 'author-ask-question':
          let batchFetchAuthorAskQuestion = new BatchFetchAuthorAskQuestion()
          await batchFetchAuthorAskQuestion.fetchListAndSaveToDb(targetIdList)
          break
        case 'author-answer':
          let batchFetchAuthorAnswer = new BatchFetchAuthorAnswer()
          await batchFetchAuthorAnswer.fetchListAndSaveToDb(targetIdList)
          break
        case 'author-pin':
          let batchFetchAuthorPin = new BatchFetchAuthorPin()
          await batchFetchAuthorPin.fetchListAndSaveToDb(targetIdList)
          break
        case 'topic':
          let batchFetchTopic = new BatchFetchTopic()
          await batchFetchTopic.fetchListAndSaveToDb(targetIdList)
          break
        case 'collection':
          let batchFetchCollection = new BatchFetchCollection()
          await batchFetchCollection.fetchListAndSaveToDb(targetIdList)
          break
        case 'column':
          let batchFetchColumn = new BatchFetchColumn()
          await batchFetchColumn.fetchListAndSaveToDb(targetIdList)
          break
        case 'article':
          let batchFetchArticle = new BatchFetchArticle()
          await batchFetchArticle.fetchListAndSaveToDb(targetIdList)
          break
        case 'question':
          let batchFetchQuestion = new BatchFetchQuestion()
          await batchFetchQuestion.fetchListAndSaveToDb(targetIdList)
          break
        case 'answer':
          let batchFetchAnswer = new BatchFetchAnswer()
          await batchFetchAnswer.fetchListAndSaveToDb(targetIdList)
          break
        case 'pin':
          let batchFetchPin = new BatchFetchPin()
          await batchFetchPin.fetchListAndSaveToDb(targetIdList)
          break
        case 'author-agree-article':
        case 'author-agree-answer':
        case 'author-watch-question':
          let batchFetchAuthorActivity = new BatchFetchAuthorActivity()
          await batchFetchAuthorActivity.fetchListAndSaveToDb(targetIdList)
          break
        default:
          this.log(`不支持的任务类型:${taskType}, 自动跳过`)
      }
    }
    this.log(`自定义任务抓取完毕`)
  }
}

export default FetchCustomer
