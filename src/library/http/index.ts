import axios, { AxiosRequestConfig } from 'axios'
import RequestConfig from '~/src/config/request'
import logger from '~/src/library/logger'
import request from 'request-promise'
import _ from 'lodash'

// 创建axios实例
const http = axios.create({
  timeout: RequestConfig.timeoutMs,
  headers: {
    // 加上ua
    'User-Agent': RequestConfig.ua,
    cookie: RequestConfig.cookie,
  },
})

class Http {
  /**
   * 封装get方法
   * @param url
   * @param config
   */
  static async get(url: string, config: AxiosRequestConfig = {}) {
    const response = await http.get(url, config).catch(e => {
      logger.log(`网络请求失败, 您的账号可能因抓取频繁被知乎认为有风险, 在浏览器中访问知乎首页,输入验证码即可恢复`)
      logger.log(`错误内容=> message:${e.message}, stack=>${e.stack}`)
      return {}
    })
    const record = _.get(response, ['data'], {})
    return record
  }

  /**
   * axios封装的arraybuffer由于使用了stream, 重复次数多了之后会出现stream卡死的情况, 且不可恢复
   * 因此改用request封装图片下载请求
   * @param url
   */
  static async downloadImg(url: string): Promise<request.RequestPromise> {
    return await request({
      url,
      method: 'get',
      // 数据以二进制形式返回
      encoding: null,
      timeout: RequestConfig.timeoutMs,
    })
  }
}

export default Http
