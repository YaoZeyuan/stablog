const electron = require('electron');
const ipcRenderer = electron.ipcRenderer;

class Util {
  static getFileContent(uri: string) {
    return ipcRenderer.sendSync('getFileContent', {
      uri
    })
  }

  static writeFileContent(uri: string, content: string) {
    return ipcRenderer.sendSync('writeFileContent', {
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
