import { invokeDesktop } from './desktop'

class Util {
  static async getFileContent(uri: string) {
    return invokeDesktop<string>('get-file-content', {
      uri
    })
  }

  static async writeFileContent(uri: string, content: string) {
    return invokeDesktop<boolean>('write-file-content', {
      uri,
      content
    })
  }

  /**
   * 延迟执行函数, 返回一个 Promise
   * @param {number} ms
   */
  static asyncSleepMs(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

export default Util
