import CommonUtil from '~/src/library/util/common'

let packageJson = CommonUtil.getPackageJsonConfig()
let version = parseFloat(packageJson.version)
class Common {
  static readonly version = version
  // 感谢github-page, 免费cdn
  static readonly checkUpgradeUri = 'https://api.yaozeyuan.online/stablog/version'
}
export default Common
