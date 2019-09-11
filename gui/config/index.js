const ENV_DEV = 'development'
const ENV_PRODUCTION = 'production'
let _ = require('lodash')
let path = require('path')
const ChildProcess = require('child_process')

// 配置开发者的debug
let debug = {}

let prodConfig = {
  project: {
    name: 'zhihuhelp',
    version: '1.0',
    entry: { index: './gui/src/view/index.js' }
  },
  build: {
    // 服务器端配置
    env: ENV_PRODUCTION,
    index: path.resolve(__dirname, '../dist/index.html'),
    assetsSubDirectory: './', // 子文件夹前缀
    assetsPublicPath: '/', // 静态地址前缀，根据cdn环境配置改变
    bundleAnalyzerReport: process.env.npm_config_report
  },
  dev: {
    // 本地调试配置
    env: ENV_DEV,
    port: '8080', // 调试地址端口
    assetsSubDirectory: '.', // 子文件夹前缀
    assetsPublicPath: '/'
  },
  localServer: {
    filter: function (pathname, req) {
      // 本地调试vue的时候会有跨域问题，所以这里自定义一个过滤器进行检测，命中规则就自动转发到接口地址上去
      // 检测是否有接口标志关键字，有的话就转发过去
      return pathname.indexOf('/api/') !== -1
    },
    host: {
      target: 'http://127.0.0.1:3000', // 本地mock服务器地址
      changeOrigin: true, // needed for virtual hosted sites
      ws: true // proxy websockets
    }
  }
}

let mergeConfig = _.merge(prodConfig, debug)
module.exports = mergeConfig
