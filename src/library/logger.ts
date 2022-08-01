import dayjs from 'dayjs'
import _ from 'lodash'
import DATE_FORMAT from '~/src/constant/date_format'
import PathConfig from '~/src/config/path'
import fs from 'fs'

class Logger {
  private static formatArgument (...arg: Array<any>) {
    const triggerAt = dayjs().format(DATE_FORMAT.DISPLAY_BY_MILLSECOND)
    let stringLogItemList = []
    for (let logItem of [...arg]) {
      if (_.isString(logItem)) {
        stringLogItemList.push(` ${logItem} `)
      } else {
        stringLogItemList.push(JSON.stringify(logItem, null, 4))
      }
    }
    let logContent = `${triggerAt}:` + stringLogItemList.join('')
    return logContent
  }

  private static pushLogContentToFile (logContent: string) {
    fs.appendFileSync(PathConfig.runtimeLogUri, logContent + '\n')
    return
  }

  static log (...arg: Array<any>) {
    let logContent = Logger.formatArgument(...arg)
    // 将日志存入Electron全局变量中
    Logger.pushLogContentToFile(logContent)
    console.log(logContent)
  }
  static warn (...arg: Array<any>) {
    let logContent = Logger.formatArgument(...arg)
    Logger.pushLogContentToFile(logContent)
    console.warn(logContent)
  }
}

export default Logger
