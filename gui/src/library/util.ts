import fs from 'fs'
class Util {
  static getFileContent (uri: string) {
    if (fs.existsSync(uri)) {
      let contentBuffer = fs.readFileSync(uri)
      return contentBuffer.toString()
    } else {
      return ''
    }
  }
}

export default Util
