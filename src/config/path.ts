import path from 'node:path'
import { fileURLToPath } from 'node:url'

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url))

class Path {
  // 根路径
  static readonly rootPath = path.resolve(moduleDirectory, '../../')
  // 项目打包时只打包dist目录, 因此路径中不能带src
  static readonly resourcePath = path.resolve(path.resolve(moduleDirectory, '../'), 'public')
  static cachePath = path.resolve(Path.rootPath, '缓存文件')
  static imgCachePath = path.resolve(Path.cachePath, 'imgPool')
  static htmlCachePath = path.resolve(Path.cachePath, 'html')
  static logPath = path.resolve(Path.rootPath, 'log')
  static outputPath = path.resolve(Path.rootPath, '稳部落输出的电子书')
  static htmlOutputPath = path.resolve(Path.outputPath)

  // package.json文件
  static readonly packageJsonUri = path.resolve(Path.rootPath, 'package.json')

  // 本地配置文件, 随时更新
  static configUri = path.resolve(Path.rootPath, 'config.json')
  static customerTaskConfigUri = path.resolve(Path.rootPath, 'customer_task_config.json')
  static readonly readListUri = path.resolve(Path.rootPath, 'read_list.txt')
  static get runtimeLogUri() {
    return path.resolve(Path.logPath, `runtime.${Path.formatLocalDate(new Date())}.log`)
  }

  static get runtimeJsonlUri() {
    return path.resolve(Path.logPath, `runtime.${Path.formatLocalDate(new Date())}.jsonl`)
  }

  static get allPathList() {
    return [Path.rootPath, Path.cachePath, Path.imgCachePath, Path.htmlCachePath, Path.logPath, Path.outputPath]
  }

  static setConfigUri(configUri: string) {
    Path.configUri = path.resolve(configUri)
  }

  static setCustomerTaskConfigUri(configUri: string) {
    Path.customerTaskConfigUri = path.resolve(configUri)
  }

  static setCachePath(cachePath: string) {
    Path.cachePath = path.resolve(cachePath)
    Path.imgCachePath = path.resolve(Path.cachePath, 'imgPool')
    Path.htmlCachePath = path.resolve(Path.cachePath, 'html')
  }

  static setLogPath(logPath: string) {
    Path.logPath = path.resolve(logPath)
  }

  static setOutputPath(outputPath: string) {
    Path.outputPath = path.resolve(outputPath)
    Path.htmlOutputPath = path.resolve(Path.outputPath)
  }

  private static formatLocalDate(date: Date) {
    const pad = (value: number) => `${value}`.padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  }
}

export default Path
