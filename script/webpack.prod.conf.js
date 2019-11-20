'use strict'
const path = require('path')
const utils = require('./utils')
const webpack = require('webpack')
const config = require('../config')
const merge = require('webpack-merge')
const baseWebpackConfig = require('./webpack.base.conf')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const OptimizeCSSPlugin = require('optimize-css-assets-webpack-plugin')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const TerserPlugin = require('terser-webpack-plugin')
const FriendlyErrorsPlugin = require('friendly-errors-webpack-plugin')

const env = config.build.env

const webpackConfig = merge(baseWebpackConfig, {
  mode: 'production',
  devtool: false,
  output: {
    filename: utils.assetsPath(`${config.project.version}/js/[chunkhash:7]/[name].js`), // 让生成的js按文件名分开，方便查找
    chunkFilename: utils.assetsPath(`${config.project.version}/js/[id].[chunkhash:7].js`),
    // 线上编译时应该是相对路径
    publicPath: './',
  },
  plugins: [
    // http://vuejs.github.io/vue-loader/en/workflow/production.html
    new webpack.DefinePlugin({
      'process.env': env
    }),
    new webpack.optimize.OccurrenceOrderPlugin(),
    // Compress extracted CSS. We are using this plugin so that possible
    // duplicated CSS from different components can be deduped.
    new OptimizeCSSPlugin({
      cssProcessorOptions: {
        safe: true
      }
    }),
    // https://github.com/ampedandwired/html-webpack-plugin
    new HtmlWebpackPlugin({
      filename: 'index.html',
      template: './gui/public/index.html',
      inject: true,
      minify: {
        removeComments: true,
        collapseWhitespace: true,
        removeAttributeQuotes: true
        // more options:
        // https://github.com/kangax/html-minifier#options-quick-reference
      },
      // necessary to consistently work with multiple chunks via CommonsChunkPlugin
      chunks: [
        'index',
        'manifest',
        'vendor'
      ],
      chunksSortMode: 'dependency'// 按照依赖关系注入script标签，否则【一定】会造成代码无法运行！
    }),
    new FriendlyErrorsPlugin(),
    new CopyWebpackPlugin([
      {
        // 配置静态文件路径
        from: path.resolve(__dirname, '../standalone'),
        to: config.build.assetsSubDirectory,
        ignore: ['.*']
      }
    ])
  ],
  // 混淆，压缩代码
  optimization: {
    // 本地使用不需要压缩
    minimize: false,
    minimizer: [
      // 响应官方号召, 转为使用TerserPlugin进行压缩
      // 不指定压缩插件会导致程序无法停止(这是webpack的一个bug, 将来应该会消失)
      new TerserPlugin({
        cache: true,
        parallel: true,
        sourceMap: true
      })
    ]
  }
})

if (config.build.bundleAnalyzerReport) {
  const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin
  webpackConfig.plugins.push(new BundleAnalyzerPlugin())
}

module.exports = webpackConfig
