'use strict'
const webpack = require('webpack')
const config = require('../config')
const merge = require('webpack-merge')
const baseWebpackConfig = require('./webpack.base.conf')
const FriendlyErrorsPlugin = require('friendly-errors-webpack-plugin')
const HtmlWebpackPlugin = require('html-webpack-plugin')

// add hot-reload related code to entry chunks
baseWebpackConfig.entry.index = [baseWebpackConfig.entry.index, 'webpack-hot-middleware/client']

module.exports = merge(baseWebpackConfig, {
  mode: 'development',
  output:{
    // 本地调试时应该是绝对路径
    publicPath: '/',
  },
  // cheap-module-eval-source-map is faster for development
  devtool: '#source-map', // eval-source-map只能看，不能调试，得不偿失
  plugins: [
    new webpack.DefinePlugin({
      'process.env': config.dev.env
    }),
    // https://github.com/glenjamin/webpack-hot-middleware#installation--usage
    new webpack.HotModuleReplacementPlugin(),
    new webpack.NoEmitOnErrorsPlugin(),
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
    new FriendlyErrorsPlugin()
  ]
})
