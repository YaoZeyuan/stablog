import Base from '~/src/command/base.js'
import knex from '~/src/library/knex.js'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import http from '~/src/library/http/index.js'
import TypeConfig from '~/src/type/namespace/config.js'
import CommonConfig from '~/src/config/common.js'
import shelljs from 'shelljs'
import DatabaseConfig from '~/src/config/database.js'
import PathConfig from '~/src/config/path.js'

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url))

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
    const { rebase: isRebase, skipUpgradeCheck = false } = options

    this.log('初始化文件夹')
    for (let uri of PathConfig.allPathList) {
      shelljs.mkdir('-p', uri)
    }
    this.log('文件夹初始化完毕')

    if (isRebase) {
      this.log('重建数据库')
      this.log('删除旧数据库')
      await knex.destroy()
      await removeDatabaseForRebase(DatabaseConfig.uri)
      this.log('旧数据库删除完毕')
    }
    this.log('初始化数据库')
    const sqlContent = fs.readFileSync(path.resolve(moduleDirectory, './init.sql')).toString()
    for (let sql of sqlContent.split(';')) {
      // 一次只能执行一行
      sql = sql.trim()
      if (sql.length) {
        await knex.raw(sql)
      }
    }
    this.log('数据库初始化完毕')

    if (skipUpgradeCheck) {
      this.log('已跳过在线更新检查')
      return
    }
    // 最后再检查更新
    this.log(`检查更新`)
    let remoteVersionConfig: TypeConfig.Version = await http
      .get(CommonConfig.checkUpgradeUri, {
        params: {
          now: new Date().toISOString(),
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

async function removeDatabaseForRebase(databasePath: string): Promise<void> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      fs.unlinkSync(databasePath)
      return
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code === 'ENOENT') return
      if ((code !== 'EBUSY' && code !== 'EPERM') || attempt === 9) throw error
      await new Promise<void>((resolve) => setTimeout(resolve, 100))
    }
  }
  if (fs.existsSync(databasePath)) {
    throw new Error(`数据库删除失败: ${databasePath}`)
  }
}

export default InitEnv
