import logger from '~/src/library/logger.js'

class Base {
  static get signature() {
    return `
     Parse:Base

     {--onlyFlag:[必传]flag,只有true/false两个值}
     {--logName=@value:[必传]日志文件名}
     {--isTest?=@value:[可选]是否处于测试环境}
     `
  }

  static get description() {
    return '解析kafka日志, Base'
  }

  /**
   * 在最外层进行一次封装, 方便获得报错信息
   * @param args
   * @param options
   * @returns {Promise<void>}
   */
  async handle(args: any, options: any): Promise<any> {
    this.log('command start')
    try {
      const result = await this.execute(args, options)
      this.log('command finish')
      return result
    } catch (error) {
      const e = error instanceof Error ? error : new Error(String(error))
      this.log('catch error')
      this.log(e.stack ?? e.message)
      throw error
    }
  }

  /**
   * 空promise函数, 方便清空promise队列
   */
  async emptyPromiseFunction() {
    return
  }

  /**
   *
   * @param args
   * @param options
   */
  async execute(_args: any, _options: any): Promise<any> {}

  /**
   * 简易logger
   * @returns  null
   */
  async log(...argumentList: string[] | any): Promise<any> {
    logger.log(`[${this.constructor.name}]`, ...argumentList)
  }

  /**
   * 简易logger
   * @returns  null
   */
  async warn(...argumentList: unknown[]) {
    logger.warn(`[${this.constructor.name}]`, ...argumentList)
  }
}

export default Base
