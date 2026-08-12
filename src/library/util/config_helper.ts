import RequestConfig from '~/src/config/request.js'
import CommonUtil from '~/src/library/util/common.js'
import _ from 'lodash'

class ConfigHelper {
  // 重新载入配置文件
  static reloadConfig() {
    let config = CommonUtil.getConfig()
    RequestConfig.cookie = _.get(config, ['request', 'cookie'], '')
  }
}

export default ConfigHelper
