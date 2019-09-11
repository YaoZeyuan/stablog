'use strict'

process.env.NODE_ENV = 'production'

let _ = require('lodash')
let shell = require('shelljs')
let ora = require('ora')
let path = require('path')
let chalk = require('chalk')
let webpack = require('webpack')
let webpackConfig = require('./webpack.prod.conf')

let spinner = ora('building for production...')

console.log('清空缓存资源')
let distPath = path.resolve(__dirname, '../dist')
console.log(`dist_path => ${distPath}`)
if (typeof distPath !== 'string' || distPath.length < 3) {
  console.warn('distPath/mapPath长度过短，自动退出')
  shell.exit(10004)
}
shell.rm('-rf', distPath)
console.log('缓存资源清理完毕')
console.log('')

spinner.start()

webpack(webpackConfig, function (err, stats) {
  spinner.stop()
  if (err) throw err
  process.stdout.write(stats.toString({
    colors: true,
    modules: false,
    children: false,
    chunks: false,
    chunkModules: false
  }) + '\n\n')

  console.log(chalk.cyan('  Build complete.\n'))
  console.log(chalk.yellow(
    '  Tip: built files are meant to be served over an HTTP server.\n' +
    '  Opening index.html over file:// won\'t work.\n'
  ))

  console.log('项目编译完毕')
})
