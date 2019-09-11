import _ from 'lodash'
import CommonUtil from '~/src/library/util/common'

// 优先使用远程发放的配置
let config = CommonUtil.getConfig()

class Request {
  static timeoutMs = 20 * 1000
  static ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/71.0.3578.98 Safari/537.36'
  static cookie = _.get(config, ['request', 'cookie'], '')
}
export default Request
