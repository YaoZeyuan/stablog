let path = require("path");
let currentPath = path.resolve(__dirname);
let iconUri = path.resolve(currentPath, "./src/public/image/icon.ico");
let icnsUri = path.resolve(currentPath, "./src/public/image/icon.icns");
let installGifUri = path.resolve(currentPath, "./src/public/image/install.gif");

// forge打包配置
module.exports = {
  packagerConfig: {
    name: "稳部落",
    // 不使用asar
    asar: false,
    icon: iconUri,
    // 需要在打包结果中忽略的列表
    ignore: [
      // 部分路径默认忽略, 参考 => https://electron.github.io/electron-packager/main/interfaces/electronpackager.options.html#ignore
      "node_modules/.bin",
    ],
  },
  makers: [
    {
      name: "@electron-forge/maker-squirrel",
      config: {
        name: "my_app",
        setupIcon: iconUri,
        iconUrl: iconUri,
        loadingGif: installGifUri,
      },
    },
    {
      name: "@electron-forge/maker-deb",
      config: {},
    },
    {
      name: "@electron-forge/maker-rpm",
      config: {},
    },
  ],
};
