// Modules to control application life and create native browser window
import Electron, { Menu } from 'electron'
import CommonUtil from '~/src/library/util/common.js'
import Logger from '~/src/library/logger.js'
import InitEnvCommand from '~/src/command/init_env.js'
import { registerIpcHandlers } from '~/src/interface/electron/ipc_handlers.js'
import { bootstrapApplication } from '~/src/application/bootstrap/application_bootstrap.js'
import { LogEventCode, LogLevel, LogStage, LogStatus } from '~/src/shared/logging/log_contract.js'
import fs from 'fs'
import sharp from 'sharp'
import path from 'path'
import os from 'os'
import { fileURLToPath } from 'node:url'

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url))

let argv = process.argv
let isDebug = argv.includes('--stablog-debug')
const isMacOS = os.platform() === 'darwin'
let { app, BrowserWindow, ipcMain, session, shell, dialog } = Electron
// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow: Electron.BrowserWindow | null = null

// 解除node.js内存限制
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=8192')
// 解除node.js内存限制
app.commandLine.appendSwitch('--js-flags', '--max-old-space-size=8192')

// subWindow需要放在外边, 以便在全局中传递
let subWindow: InstanceType<typeof BrowserWindow> | null = null

async function createWindow() {
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
      preload: path.resolve(moduleDirectory, 'preload.cjs'),
      // 开启 DevTools.
      devTools: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      nodeIntegration: false,
      contextIsolation: true,
      // 启用webview标签
      webviewTag: true,
    },
  })

  // 通过Electron自身将html渲染为图片, 借此将代码体积由300mb压缩至90mb
  subWindow = new BrowserWindow({
    enableLargerThanScreen: true,
    width: 760,
    height: 10,
    // 配置最大高度, 该值默认值为屏幕高度, 如果大于该高度, 会出现滚动条
    maxHeight: 10000,
    // 负责渲染的子窗口不需要显示出来, 避免被用户误关闭
    show: false,
  })

  async function debugCaputure() {
    let targetSource =
      'file:///C:/Users/yao/AppData/Local/Programs/stablog/resources/app/%E7%A8%B3%E9%83%A8%E8%90%BD%E8%BE%93%E5%87%BA%E7%9A%84%E7%94%B5%E5%AD%90%E4%B9%A6/ETF%E6%8B%AF%E6%95%91%E4%B8%96%E7%95%8C-%E5%BE%AE%E5%8D%9A%E6%95%B4%E7%90%86-%E7%AC%AC1%EF%BC%8F3%E5%8D%B7-(2015-09-28~2018-11-15)/html_to_pdf/2016-07-01%2011%EF%BC%9A31%EF%BC%9A16_3992391939353203.html'
    let demoUri = path.resolve(moduleDirectory, '../demo.jpg')

    // 图片放大系数, 系数越大, pdf越清晰, 文件体积越大
    const Pixel_Zoom_Radio = 2

    const Const_Max_Webview_Render_Height_Px = 2000 * Pixel_Zoom_Radio
    const Const_Default_Webview_Width = 760 * Pixel_Zoom_Radio
    const Const_Default_Webview_Height = 10

    if (subWindow === null) {
      throw new Error('渲染窗口尚未初始化')
    }
    let webview = subWindow.webContents
    let globalSubWindow = subWindow

    await webview.loadURL(targetSource)
    // this.log("setContentSize -> ", Const_Default_Webview_Width, Const_Default_Webview_Height)
    await globalSubWindow.setContentSize(Const_Default_Webview_Width, Const_Default_Webview_Height)
    // 扩大为200%
    await globalSubWindow.webContents.setZoomFactor(Pixel_Zoom_Radio)
    // @alert 注意, 在这里有可能卡死, 表现为卡住停止执行. 所以需要在外部加一个超时限制
    // this.log("resize page, executeJavaScript ")
    let scrollHeight = await webview.executeJavaScript(`document.children[0].children[1].scrollHeight`) * Pixel_Zoom_Radio

    let jpgContent: Buffer
    if (scrollHeight > Const_Max_Webview_Render_Height_Px) {
      // html页面太大, 需要分页输出, 最后再合成一张图片返回
      let imgContentList: any[] = []
      let remainHeight = scrollHeight
      await subWindow.setContentSize(Const_Default_Webview_Width, Const_Max_Webview_Render_Height_Px)
      // console.log("remainHeight => ", remainHeight)
      // console.log("Const_Max_Height_Px => ", Const_Max_Height_Px)

      let mergeImg = sharp({
        create: {
          width: Const_Default_Webview_Width,
          height: scrollHeight,
          channels: 4,
          background: {
            r: 255,
            g: 255,
            b: 255,
            alpha: 1,
          },
        },
      }).jpeg({ quality: 100 })

      while (remainHeight >= Const_Max_Webview_Render_Height_Px) {
        let imgIndex = imgContentList.length
        // 将实际像素转回逻辑像素
        let currentOffsetHeight = Const_Max_Webview_Render_Height_Px / Pixel_Zoom_Radio * imgIndex

        Logger.log(`[${remainHeight}]开始执行页面滚动`)
        // 先移动到offset高度
        let command = `document.children[0].children[1].scrollTop = ${currentOffsetHeight}`
        await webview.executeJavaScript(command)
        Logger.log(`[${remainHeight}]页面滚动执行完毕`)
        // 然后对界面截屏
        // js指令执行后, 滚动到指定位置还需要时间, 所以截屏前需要sleep一下
        await CommonUtil.asyncSleep(1000 * 0.5)
        let nativeImg = await webview.capturePage()
        let content = await nativeImg.toJPEG(100)
        remainHeight = remainHeight - Const_Max_Webview_Render_Height_Px

        imgContentList.push({
          input: content,
          top: Const_Max_Webview_Render_Height_Px * imgIndex,
          left: 0,
        })
      }
      if (remainHeight > 0) {
        // 最后捕捉剩余高度页面

        // 首先调整页面高度
        await subWindow.setContentSize(Const_Default_Webview_Width, remainHeight)
        // 然后走流程, 捕捉界面
        // 将实际像素转回逻辑像素
        let currentOffsetHeight = Const_Max_Webview_Render_Height_Px / Pixel_Zoom_Radio * imgContentList.length
        let imgIndex = imgContentList.length

        // 先移动到offset高度
        let command = `document.children[0].children[1].scrollTop = ${currentOffsetHeight}`
        await webview.executeJavaScript(command)
        // 然后对界面截屏
        // js指令执行后, 滚动到指定位置还需要时间, 所以截屏前需要sleep一下
        await CommonUtil.asyncSleep(1000 * 0.5)
        let nativeImg = await webview.capturePage()

        let content = await nativeImg.toJPEG(100)
        imgContentList.push({
          input: content,
          top: Const_Max_Webview_Render_Height_Px * imgIndex,
          left: 0,
        })
      }

      // 最后将imgContentList合并为一张图片
      mergeImg.composite(imgContentList)

      jpgContent = await mergeImg.toBuffer()
    } else {
      // 小于最大宽度, 只要截屏一次就可以
      await subWindow.setContentSize(Const_Default_Webview_Width, scrollHeight)

      // this.log("setContentSize with scrollHeight -> ", scrollHeight)
      let nativeImg = await webview.capturePage()
      jpgContent = await nativeImg.toJPEG(100)
    }

    console.log('demoUri => ', demoUri)
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
    subWindow?.close()
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

  registerIpcHandlers({
    ipcMain,
    session: session.defaultSession,
    shell,
    dialog,
    mainWindow,
    getRenderWindow: () => subWindow,
  })

  // IPC must exist before the renderer loads, otherwise first-screen calls can race startup.
  if (isDebug) {
    await mainWindow.loadURL('http://127.0.0.1:8000')
    mainWindow.webContents.openDevTools()
  } else {
    if (isMacOS) {
      // MacOS下, 不打开控制台无法正常加载页面
      mainWindow.webContents.openDevTools()
    }
    await mainWindow.loadFile(path.resolve(moduleDirectory, 'client/dist/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => bootstrapApplication({
  initialize: async () => {
    const initCommand = new InitEnvCommand()
    await initCommand.handle({}, {})
  },
  createWindow,
  eventSink: Logger,
})).catch(() => {
  // bootstrapApplication 已经以 INITIALIZATION_FAILED/S0 记录完整错误。
  app.quit()
})

process.on('uncaughtExceptionMonitor', (error) => {
  Logger.event({
    eventCode: LogEventCode.APP_ERROR,
    stage: LogStage.APP,
    status: LogStatus.FAILURE,
    level: LogLevel.ERROR,
    message: '主进程发生未捕获异常',
    error: Logger.serializeError(error),
  })
})

process.on('unhandledRejection', (reason) => {
  Logger.event({
    eventCode: LogEventCode.APP_ERROR,
    stage: LogStage.APP,
    status: LogStatus.FAILURE,
    level: LogLevel.ERROR,
    message: '主进程发生未处理 Promise rejection',
    error: Logger.serializeError(reason),
  })
})

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
    void createWindow()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
