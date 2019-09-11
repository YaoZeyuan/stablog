'use strict'
const path = require('path')
const utils = require('./utils')
const config = require('../config')
const vueLoaderConfig = require('./vue-loader.conf')
const VueLoaderPlugin = require('vue-loader/lib/plugin')
let projectRoot = path.resolve(__dirname, '../')

module.exports = {
  cache: true, // 开启webpack的默认缓存
  entry: config.project.entry,
  output: {
    path: path.resolve(__dirname, `../dist`),
    filename: '[name].js',
    // 这项配置需要根据运行环境决定, dev => './', prod => '/'
    // electron下根路径应该是index.html所在目录
    // publicPath: '/'
  },
  // 指定在electron中运行
  target: 'electron-renderer',
  resolve: {
    extensions: ['.ts','.tsx','.js', '.jsx', '.vue', '.json'],
    alias: {
      'vue$': 'vue/dist/vue.esm.js',
      '~': path.resolve(__dirname, '../../../') // 真正的根目录
    }
  },
  module: {
    rules: [
      {
        test: /\.vue$/,
        loader: 'vue-loader',
        options: vueLoaderConfig
      },
      {
        test: /\.tsx?$/,
        use: [
            // tsc编译后，再用babel处理
            {loader: 'babel-loader',},
            {
                loader: 'ts-loader',
                options: {
                    // 加快编译速度
                    transpileOnly: true,
                    // 指定特定的ts编译配置，为了区分脚本的ts配置
                    configFile: path.resolve(__dirname, '../config/tsconfig.json')
                }
            }
        ],
        exclude: /node_modules/
      },
      {
        test: /\.js$/,
        loader: ['babel-loader?cacheDirectory=true'],
        include: [path.join(projectRoot, 'src')],
        exclude: [path.join(projectRoot, 'node_modules')]
      },
      // 它会应用到普通的 `.css` 文件
      // 以及 `.vue` 文件中的 `<style>` 块
      {
        test: /\.css$/,
        use: [
          'vue-style-loader',
          'css-loader'
        ]
      },
      {
        test: /\.less$/,
        use: [
          'vue-style-loader',
          'css-loader',
          'less-loader'
        ]
      },
      {
        test: /\.sass$/,
        use: [
          'vue-style-loader',
          'css-loader',
          'sass-loader'
        ]
      },
      {
        test: /\.saas$/,
        use: [
          'vue-style-loader',
          'css-loader',
          'saas-loader'
        ]
      },
      {
        test: /\.stylus$/,
        use: [
          'vue-style-loader',
          'css-loader',
          'stylus-loader'
        ]
      },
      {
        test: /\.styl$/,
        use: [
          'vue-style-loader',
          'css-loader',
          'stylus-loader'
        ]
      },
      {
        // 图片资源处理器
        // 10kb以下数据直接转为base64,否则置于img/文件夹中
        test: /\.(png|jpe?g|gif|svg)(\?.*)?$/,
        loader: 'url-loader',
        options: {
          limit: 10240,
          name: utils.assetsPath(`${config.project.version}/img/[name].[hash:7].[ext]`)
        }
      },
      {
        // 媒体资源处理器
        // 10kb以下数据直接转为base64,否则置于media/文件夹中
        test: /\.(mp4|webm|ogg|mp3|wav|flac|aac)(\?.*)?$/,
        loader: 'url-loader',
        options: {
          limit: 10240,
          name: utils.assetsPath(`${config.project.version}/media/[name].[hash:7].[ext]`)
        }
      },
      {
        // 字体资源处理器
        // 10kb以下数据直接转为base64,否则置于fonts/文件夹中
        test: /\.(woff2?|eot|ttf|otf)(\?.*)?$/,
        loader: 'url-loader',
        options: {
          limit: 10240,
          name: utils.assetsPath(`${config.project.version}/fonts/[name].[hash:7].[ext]`)
        }
      }
    ]
  },
  plugins: [
    new VueLoaderPlugin()
  ]
}
