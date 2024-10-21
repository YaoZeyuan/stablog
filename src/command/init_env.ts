import Base from '~/src/command/base'
import knex from '~/src/library/knex'
import fs from 'fs'
import path from 'path'
import http from '~/src/library/http'
import TypeConfig from '~/src/type/namespace/config'
import CommonConfig from '~/src/config/common'
import shelljs from 'shelljs'
import DatabaseConfig from '~/src/config/database'
import PathConfig from '~/src/config/path'

class InitEnv extends Base {
  static get signature() {
    return `
     Init:Env

     {--rebase=@false : 是否重建数据库  }
     `
  }

  static get description() {
    return '初始化运行环境'
  }

  async execute(args: any, options: any) {
    let { rebase: isRebase } = options

    this.log('初始化文件夹')
    for (let uri of PathConfig.allPathList) {
      shelljs.mkdir('-p', uri)
    }
    this.log('文件夹初始化完毕')

    if (isRebase) {
      this.log('重建数据库')
      this.log('删除旧数据库')
      shelljs.rm(DatabaseConfig.uri)
      this.log('旧数据库删除完毕')
    }
    this.log('初始化数据库')
    const sqlContent = fs.readFileSync(path.resolve(__dirname, './init.sql')).toString()
    for (let sql of sqlContent.split(';')) {
      // 一次只能执行一行
      sql = sql.trim()
      if (sql.length) {
        await knex.raw(sql)
      }
    }
    this.log('数据库初始化完毕')

    // 最后再检查更新
    this.log(`检查更新`)
    let remoteVersionConfig: TypeConfig.Version = await http
      .get(CommonConfig.checkUpgradeUri, {
        params: {
          now: new Date().toISOString,
        },
        timeout: 10 * 1000
      })
      .catch(e => {
        return {}
      })
    // 已经通过Electron拿到了最新cookie并写入了配置文件中, 因此不需要再填写配置文件了
    if (remoteVersionConfig.version > CommonConfig.version) {
      this.log('有新版本')
      this.log(`请到${remoteVersionConfig.downloadUrl}下载最新版: 稳部落`)
      this.log(`更新日期:${remoteVersionConfig.releaseAt}`)
      this.log(`更新说明:${remoteVersionConfig.releaseNote}`)
      return
    }
  }
}

export default InitEnv
