import Base from '~/src/command/base'
import MBlog from '~/src/model/mblog'
import fs from 'fs'

class CommandDebug extends Base {
  static get signature() {
    return `
    debug
     `
  }

  static get description() {
    return '专业Debug'
  }

  async execute() {
    // let result = await MBlog.autoUpdate()
    // this.log(`debug it`)
    // console.log(result)
  }
}

export default CommandDebug
