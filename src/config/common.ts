import CommonUtil from '~/src/library/util/common'

let packageJson = CommonUtil.getPackageJsonConfig()
let version = parseFloat(packageJson.version)
class Common {
  static readonly version = version
  // 感谢github-page, 免费cdn
  static readonly checkUpgradeUri = 'https://www.easy-mock.com/mock/5d9b49fc896b9432186c1fa5/stablog/version'
}
export default Common
