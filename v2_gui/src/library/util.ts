import fs from 'fs'
class Util {
  static getFileContent(uri: string) {
    if (fs.existsSync(uri)) {
      let contentBuffer = fs.readFileSync(uri)
      return contentBuffer.toString()
    } else {
      return ''
    }
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
