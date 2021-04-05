// Modules to control application life and create native browser window
import Electron, { Menu } from 'electron'
import CommonUtil from '~/src/library/util/common'
import ConfigHelperUtil from '~/src/library/util/config_helper'
import PathConfig from '~/src/config/path'
import Logger from '~/src/library/logger'
import DispatchTaskCommand from '~/src/command/dispatch_task'
import MUser from '~/src/model/mblog_user'
import MBlog from '~/src/model/mblog'
import fs from 'fs'
import _ from 'lodash'
import sharp from 'sharp'
import path from 'path'

let argv = process.argv
let isDebug = argv.includes('--debug')
let { app, BrowserWindow, ipcMain, session, shell } = Electron
// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow: Electron.BrowserWindow

// 关闭https证书校验
app.commandLine.appendSwitch('ignore-certificate-errors', 'true')
// 解除node.js内存限制
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=8192');

let isRunning = false
// subWindow需要放在外边, 以便在全局中传递
let subWindow: InstanceType<typeof BrowserWindow> = null

function createWindow() {
  if (process.platform === 'darwin') {
    const template = [
      {
        label: 'Application',
        submenu: [
          {
            label: 'Quit',
            accelerator: 'Command+Q',
            click: function () {
              app.quit()
            },
          },
        ],
      },
      {
        label: 'Edit',
        submenu: [
          { label: 'Copy', accelerator: 'CmdOrCtrl+C', selector: 'copy:' },
          { label: 'Paste', accelerator: 'CmdOrCtrl+V', selector: 'paste:' },
        ],
      },
    ]
    Menu.setApplicationMenu(Menu.buildFromTemplate(template))
  } else {
    Menu.setApplicationMenu(null)
  }

  const { screen } = Electron
  const { width, height } = screen.getPrimaryDisplay().workAreaSize
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width,
    height,
    // 自动隐藏菜单栏
    autoHideMenuBar: true,
    // 窗口的默认标题
    title: '稳部落',
    // 在屏幕中间展示窗口
    center: true,
    // 展示原生窗口栏
    frame: true,
    // 禁用web安全功能 --> 个人软件, 要啥自行车
    webPreferences: {
      // 开启 DevTools.
      devTools: true,
      // 禁用同源策略, 允许加载任何来源的js
      webSecurity: false,
      // 允许 https 页面运行 http url 里的资源
      allowRunningInsecureContent: true,
      // 启用node支持
      nodeIntegration: true,
      nodeIntegrationInWorker: true,
      nodeIntegrationInSubFrames: true,

      // contextIsolation: false,
      // 启用remote模块支持
      enableRemoteModule: true,
      // 启用webview标签
      webviewTag: true,
    },
  })

  // and load the index.html of the app.
  if (isDebug) {
    // 本地调试 & 打开控制台
    mainWindow.loadURL('http://127.0.0.1:8000')
    mainWindow.webContents.openDevTools()
  } else {
    // 线上地址
    mainWindow.loadFile('./gui/dist/index.html')
  }
  // 通过Electron自身将html渲染为图片, 借此将代码体积由300mb压缩至90mb
  subWindow = new BrowserWindow({
    enableLargerThanScreen: true,
    width: 760,
    height: 10,
    // 配置最大高度, 该值默认值为屏幕高度, 如果大于该高度, 会出现滚动条
    maxHeight: 10000,
    // 负责渲染的子窗口不需要显示出来, 避免被用户误关闭
    show: false
  })

  async function debugCaputure() {
    let targetSource = "file:///F:/www/share/github/stablog/%E7%A8%B3%E9%83%A8%E8%90%BD%E8%BE%93%E5%87%BA%E7%9A%84%E7%94%B5%E5%AD%90%E4%B9%A6/%E5%85%94%E4%B8%BB%E5%B8%AD-%E5%BE%AE%E5%8D%9A%E6%95%B4%E7%90%86(2021-03-08~2021-03-27)/html_to_pdf/2021%EF%BC%8D03%EF%BC%8D27%2013%EF%BC%9A27%EF%BC%9A40_4619352240819112.html"
    let demoUri = path.resolve(__dirname, "../demo.jpg")

    const Const_Max_Webview_Render_Height_Px = 5000
    const Const_Default_Webview_Width = 760
    const Const_Default_Webview_Height = 10

    let webview = subWindow.webContents
    let globalSubWindow = subWindow

    await webview.loadURL(targetSource);
    // this.log("setContentSize -> ", Const_Default_Webview_Width, Const_Default_Webview_Height)
    await globalSubWindow.setContentSize(
      Const_Default_Webview_Width,
      Const_Default_Webview_Height,
    );
    // @alert 注意, 在这里有可能卡死, 表现为卡住停止执行. 所以需要在外部加一个超时限制
    // this.log("resize page, executeJavaScript ")
    let scrollHeight = await webview.executeJavaScript(
      `document.children[0].children[1].scrollHeight`,
    );

    let jpgContent: Buffer
    if (scrollHeight > Const_Max_Webview_Render_Height_Px) {
      // html页面太大, 需要分页输出, 最后再合成一张图片返回
      let imgContentList: any[] = []
      let remainHeight = scrollHeight
      await subWindow.setContentSize(Const_Default_Webview_Width, Const_Max_Webview_Render_Height_Px);
      // console.log("remainHeight => ", remainHeight)
      // console.log("Const_Max_Height_Px => ", Const_Max_Height_Px)

      let mergeImg = sharp({
        create: {
          width: Const_Default_Webview_Width,
          height: scrollHeight,
          channels: 4,
          background: {
            r: 255, g: 255, b: 255, alpha: 1,
          },
        }
      }).jpeg({ quality: 100 })

      while (remainHeight >= Const_Max_Webview_Render_Height_Px) {
        let imgIndex = imgContentList.length;
        let currentOffsetHeight = Const_Max_Webview_Render_Height_Px * imgIndex
        // 先移动到offset高度
        let command = `document.children[0].children[1].scrollTop = ${currentOffsetHeight}`
        await webview.executeJavaScript(command);

        // 然后对界面截屏
        // js指令执行后, 滚动到指定位置还需要时间, 所以截屏前需要sleep一下
        await CommonUtil.asyncSleep(1000 * 0.5)
        let nativeImg = await webview.capturePage();
        let content = await nativeImg.toJPEG(100)
        remainHeight = remainHeight - Const_Max_Webview_Render_Height_Px

        imgContentList.push(
          {
            input: content,
            top: Const_Max_Webview_Render_Height_Px * imgIndex,
            left: 0,
          }
        )
      }
      if (remainHeight > 0) {
        // 最后捕捉剩余高度页面

        // 首先调整页面高度
        await subWindow.setContentSize(Const_Default_Webview_Width, remainHeight);
        // 然后走流程, 捕捉界面
        let currentOffsetHeight = Const_Max_Webview_Render_Height_Px * imgContentList.length
        let imgIndex = imgContentList.length;

        // 先移动到offset高度
        let command = `document.children[0].children[1].scrollTop = ${currentOffsetHeight}`
        await webview.executeJavaScript(command);
        // 然后对界面截屏
        // js指令执行后, 滚动到指定位置还需要时间, 所以截屏前需要sleep一下
        await CommonUtil.asyncSleep(1000 * 0.5)
        let nativeImg = await webview.capturePage();

        let content = await nativeImg.toJPEG(100)
        imgContentList.push(
          {
            input: content,
            top: Const_Max_Webview_Render_Height_Px * imgIndex,
            left: 0,
          }
        )
      }

      // 最后将imgContentList合并为一张图片
      mergeImg.composite(
        imgContentList
      )

      jpgContent = await mergeImg.toBuffer()

    } else {
      // 小于最大宽度, 只要截屏一次就可以
      await subWindow.setContentSize(Const_Default_Webview_Width, scrollHeight);

      // this.log("setContentSize with scrollHeight -> ", scrollHeight)
      let nativeImg = await webview.capturePage();
      jpgContent = await nativeImg.toJPEG(100);
    }

    console.log("demoUri => ", demoUri)
    fs.writeFileSync(demoUri, jpgContent)
  }

  // debugCaputure()

  // Emitted when the window is closed.
  mainWindow.on('closed', function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null
    // 主窗口关闭时, 子窗口需要随之关闭
    subWindow.close()
    subWindow = null
  })

  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    // 设置ua
    details.requestHeaders['User-Agent'] =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/71.0.3578.98 Safari/537.36'
    // 设置reffer
    details.requestHeaders['Referer'] = 'https://m.weibo.cn/'
    callback({ cancel: false, requestHeaders: details.requestHeaders })
  })

  global.pathConfig = PathConfig
  // 向html代码注入MUser, 方便查询
  global.mUser = MUser
  global.mBlog = MBlog
  // 向html代码中注入子窗口, 方便将html渲染为图片
  global.subWindow = subWindow
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', function () {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow()
  }
})

ipcMain.on('openOutputDir', async event => {
  shell.showItemInFolder(PathConfig.outputPath)
  event.returnValue = true
  return
})

ipcMain.on('startCustomerTask', async event => {
  if (isRunning) {
    event.returnValue = '目前尚有任务执行, 请稍后'
    return
  }
  isRunning = true
  Logger.log('开始工作')
  let cookieContent = ''
  await new Promise((resolve, reject) => {
    // 获取页面cookie
    session.defaultSession.cookies.get({}, (error, cookieList) => {
      for (let cookie of cookieList) {
        cookieContent = `${cookie.name}=${cookie.value};${cookieContent}`
      }
      // 顺利获取cookie列表
      resolve()
    })
  })
  // 将cookie更新到本地配置中
  let config = CommonUtil.getConfig()
  _.set(config, ['request', 'cookie'], cookieContent)
  fs.writeFileSync(PathConfig.configUri, JSON.stringify(config, null, 4))
  Logger.log(`任务配置生成完毕`)
  Logger.log(`重新载入cookie配置`)
  ConfigHelperUtil.reloadConfig()
  Logger.log(`开始执行任务`)
  event.returnValue = 'success'
  let dispatchTaskCommand = new DispatchTaskCommand()
  await dispatchTaskCommand.handle({
    subWindow
  }, {})
  Logger.log(`所有任务执行完毕, 打开电子书文件夹 => `, PathConfig.outputPath)
  // 输出打开文件夹
  shell.showItemInFolder(PathConfig.outputPath)
  isRunning = false
})



// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
