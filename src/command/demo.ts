import Base from '~/src/command/base.js'
import http from '~/src/library/http/index.js'
import fs from 'fs'

class CommandDemo extends Base {
  static get signature() {
    return `
     Command:Demo
     `
  }

  static get description() {
    return 'demo命令'
  }

  async execute() {
    this.log(`demo命令`)
  }
}

export default CommandDemo
