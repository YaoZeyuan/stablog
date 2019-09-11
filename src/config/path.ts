import path from 'path'
class Path {
  // 根路径
  static readonly rootPath = path.resolve(__dirname, '../../')
  // 项目打包时只打包dist目录, 因此路径中不能带src
  static readonly resourcePath = path.resolve(path.resolve(__dirname, '../'), 'public')
  static readonly cachePath = path.resolve(Path.rootPath, '缓存文件')
  static readonly imgCachePath = path.resolve(Path.cachePath, 'imgPool')
  static readonly htmlCachePath = path.resolve(Path.cachePath, 'html')
  static readonly epubCachePath = path.resolve(Path.cachePath, 'epub')
  static readonly outputPath = path.resolve(Path.rootPath, '知乎助手输出的电子书')
  static readonly epubOutputPath = path.resolve(Path.outputPath, 'epub')
  static readonly htmlOutputPath = path.resolve(Path.outputPath, 'html')

  // package.json文件
  static readonly packageJsonUri = path.resolve(Path.rootPath, 'package.json')

  // 本地配置文件, 随时更新
  static readonly configUri = path.resolve(Path.rootPath, 'config.json')
  static readonly customerTaskConfigUri = path.resolve(Path.rootPath, 'customer_task_config.json')
  static readonly readListUri = path.resolve(Path.rootPath, 'read_list.txt')
  static readonly runtimeLogUri = path.resolve(Path.rootPath, 'runtime.log')

  static readonly allPathList = [
    Path.rootPath,
    Path.cachePath,
    Path.imgCachePath,
    Path.htmlCachePath,
    Path.outputPath,
    Path.epubOutputPath,
    Path.htmlOutputPath,
  ]
}

export default Path
