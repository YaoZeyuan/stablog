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

// @ts-ignore
// http.defaults.jar = cookieJar
class Http {
  /**
   * 封装get方法
   * @param url
   * @param config
   */
  static async get(url: string, config: AxiosRequestConfig = {}) {
    // 请求失败自动抛出异常
    const response = await http
      .get(
        url,
        // @ts-ignore
        {
          // @ts-ignore
          ...config,
          headers: {
            // 加上ua
            'user-agent': RequestConfig.ua,
            cookie: RequestConfig.cookie,
            ...config.headers,
          },
        },
      )
    const record = response?.['data'] ?? {}
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

  static rawClient = http
}

export default Http
