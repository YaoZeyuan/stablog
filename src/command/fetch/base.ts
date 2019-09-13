import Base from '~/src/command/base'

class FetchBase extends Base {
  max = 20
  static get signature() {
    return `
        Fetch:Base
        `
  }

  static get description() {
    return '抓取微博数据'
  }
}

export default FetchBase
