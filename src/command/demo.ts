import Base from '~/src/command/base'
import http from '~/src/library/http'
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
