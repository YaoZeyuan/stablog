import logger from '~/src/library/logger'
import fs from 'fs'
import PathConfig from '~/src/config/path'
import TypeConfig from '~/src/type/namespace/config'
class Common {
  static promiseList: Array<Promise<any>> = []
  // 并发数限制到10即可
  static maxBuf = 10
  /**
   * 添加promise, 到指定容量后再执行
   * 警告, 该函数只能用于独立任务. 如果任务中依然调用asyncAppendPromiseWithDebounce方法, 会导致任务队列异常, 运行出非预期结果(外层函数结束后内层代码仍处于未完成,进行中状态)
   */
  static async asyncAppendPromiseWithDebounce(promise: Promise<any>, forceDispatch = false) {
    Common.promiseList.push(promise)
    if (Common.promiseList.length >= Common.maxBuf || forceDispatch) {
      // 在执行的时候, 需要清空公共的promiseList数组.
      // 否则, 会出现: 执行公共PromiseList中第一个任务时, 第一个任务又向PromiseList中添加了一个待执行任务, 然后又从第一个任务开始执行(但因为第一个任务此时正在执行, 不可能执行一个正在执行的任务, 就会导致node崩溃, 而且不会打印错误)
      let taskList = Common.promiseList
      Common.promiseList = []
      logger.log(`任务队列已满, 开始执行任务, 共${taskList.length}个任务待执行`)
      // 模拟allSettled方法, 需要所有任务都完成后才能继续
      let wrappedPromises = taskList.map(p =>
        Promise.resolve(p).then(
          val => ({ state: 'fulfilled', value: val }),
          err => ({ state: 'rejected', reason: err }),
        ),
      )
      await Promise.all(wrappedPromises)
      logger.log(`任务队列内所有任务执行完毕`)
    }
    return
  }

  /**
   * 派发所有未发出的Promise请求
   */
  static async asyncDispatchAllPromiseInQueen() {
    await Common.asyncAppendPromiseWithDebounce(true, true)
    return true
  }

  /**
   * 延迟执行函数, 返回一个 Promise
   * @param {number} ms
   */
  static async asyncSleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  static getUuid() {
    function s4() {
      return Math.floor((1 + Math.random()) * 0x10000)
        .toString(36)
        .substring(1)
    }

    let uuid = `${s4()}-${s4()}-${s4()}-${s4()}`
    return uuid
  }

  static getConfig() {
    if (fs.existsSync(PathConfig.configUri) === false) {
      // 没有就初始化一份
      fs.writeFileSync(
        PathConfig.configUri,
        JSON.stringify(
          {
            request: {
              ua:
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/71.0.3578.98 Safari/537.36',
              cookie: '',
            },
          },
          null,
          4,
        ),
      )
    }
    let configJson = fs.readFileSync(PathConfig.configUri)
    let config: TypeConfig.Local
    try {
      config = JSON.parse(configJson.toString())
    } catch (e) {
      config = {
        request: {
          ua:
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/71.0.3578.98 Safari/537.36',
          cookie: '',
        },
      }
    }
    return config
  }

  static getPackageJsonConfig() {
    let configJson = fs.readFileSync(PathConfig.packageJsonUri)
    let config
    try {
      config = JSON.parse(configJson.toString())
    } catch (e) {
      config = {}
    }
    return config
  }
}

export default Common
