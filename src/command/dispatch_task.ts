import Base from '~/src/command/base'
import knex from '~/src/library/knex'
import fs from 'fs'
import path from 'path'
import http from '~/src/library/http'
import TypeTaskConfig from '~/src/type/namespace/task_config'
import CommonConfig from '~/src/config/common'
import shelljs from 'shelljs'
import DatabaseConfig from '~/src/config/database'
import PathConfig from '~/src/config/path'
import InitEnvCommand from '~/src/command/init_env'
import FetchCustomerCommand from '~/src/command/fetch/customer'

import GenerateCustomerCommand from '~/src/command/generate/customer'

class DispatchCommand extends Base {
  static get signature() {
    return `
      Dispatch:Task
     `
  }

  static get description() {
    return '根据task_config_list.json配置, 分发任务'
  }

  async execute(args: any, options: any) {
    this.log(`检查更新`)
    let taskConfigListJson = fs.readFileSync(PathConfig.customerTaskConfigUri)
    let taskConfigList: Array<TypeTaskConfig.Record> = JSON.parse(taskConfigListJson.toString())
    // 初始化运行环境
    let initCommand = new InitEnvCommand()
    await initCommand.handle({}, {})
    this.log(`创建任务实例`)
    let fetchCommand = new FetchCustomerCommand()
    let generateCommand = new GenerateCustomerCommand()
    this.log(`执行抓取命令`)
    await fetchCommand.handle({}, {})
    this.log(`抓取命令执行完毕`)
    this.log(`执行生成电子书命令`)
    await generateCommand.handle({}, {})
    this.log(`生成电子书命令执行完毕`)
    this.log(`所有命令执行完毕`)
  }
}

export default DispatchCommand
