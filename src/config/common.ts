import CommonUtil from '~/src/library/util/common'

let packageJson = CommonUtil.getPackageJsonConfig()
let version = parseFloat(packageJson.version)
class Common {
  static readonly version = version
  // 感谢github-page, 免费cdn
  static readonly checkUpgradeUri = 'https://www.easy-mock.com/mock/5c680a151b1cdb683581355c/zhihuhelp/version'
}
export default Common
