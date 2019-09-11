import Base from '~/src/command/base'
import http from '~/src/library/http'

class CommandDemo extends Base {
  static get signature () {
    return `
     Command:Demo

     {name?:[可选]称谓}

     {--onlyFlag:[必传]flag,只有true/false两个值}
     {--logName=@value:[必传]日志文件名}
     {--isTest?=@value:[可选]是否处于测试环境}
     `
  }

  static get description () {
    return 'demo命令'
  }

  async execute () {
    this.log('获取回答列表')
  }
}

export default CommandDemo
