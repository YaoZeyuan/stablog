let path = require('path')
let currentPath = path.resolve(__dirname)
let iconUri = path.resolve(currentPath, './src/public/image/icon.ico')
let icnsUri = path.resolve(currentPath, './src/public/image/icon.icns')
let installGifUri = path.resolve(currentPath, './src/public/image/install.gif')

// forge打包配置
module.exports = {
  packagerConfig: {
    // 配置说明: https://electron.github.io/electron-packager/main/interfaces/electronpackager.options.html#out
    name: '稳部落',
    appBundleId:"stablog"
    // 不使用asar
    asar: false,
    icon: iconUri,
    out: 'release',
    // 需要在打包结果中忽略的列表
    ignore: [
      // 部分路径默认忽略, 参考 => https://electron.github.io/electron-packager/main/interfaces/electronpackager.options.html#ignore
      'node_modules/.bin',
    ],
  },
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'stablog-稳部落',
        setupIcon: iconUri,
        iconUrl: iconUri,
        loadingGif: installGifUri,
      },
    },
    {
      name: '@electron-forge/maker-deb',
      config: {},
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {},
    },
  ],
}
