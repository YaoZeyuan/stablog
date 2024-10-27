import CommonUtil from '~/src/library/util/common'

let packageJson = CommonUtil.getPackageJsonConfig()
let version = parseFloat(packageJson.version)
class Common {
  static readonly version = version
  // 感谢jsdeliver, 免费cdn
  static readonly checkUpgradeUri = 'https://gitee.com/yaozeyuan/stablog/raw/master/upgrade_config/version.json'
}
export default Common
