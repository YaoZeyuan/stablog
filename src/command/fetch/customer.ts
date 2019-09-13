import Base from '~/src/command/fetch/base'
import TypeTaskConfig from '~/src/type/namespace/task_config'
import PathConfig from '~/src/config/path'
import fs from 'fs'

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
    let taskConfigList: Array<TypeTaskConfig.Record> = customerTaskConfig.configList
    this.log(`开始执行抓取=>`)
    for (let taskConfig of taskConfigList) {
      let batchFetchAnswer = new BatchFetchAnswer()
      await batchFetchAnswer.fetchListAndSaveToDb(targetIdList)
    }
    this.log(`所有任务抓取完毕`)
  }
}

export default FetchCustomer
