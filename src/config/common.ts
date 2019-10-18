import CommonUtil from '~/src/library/util/common'

let packageJson = CommonUtil.getPackageJsonConfig()
let version = parseFloat(packageJson.version)
class Common {
  static readonly version = version
  // 感谢github-page, 免费cdn
  static readonly checkUpgradeUri = 'http://api.bookflaneur.cn/stablog/version'
}
export default Common
