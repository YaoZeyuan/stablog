// Modules to control application life and create native browser window
import Electron,{Menu} from 'electron'
import CommonUtil from '~/src/library/util/common'
import ConfigHelperUtil from '~/src/library/util/config_helper'
import PathConfig from '~/src/config/path'
import Logger from '~/src/library/logger'
import DispatchTaskCommand from '~/src/command/dispatch_task'
import fs from 'fs'
import _ from 'lodash'

let { app, BrowserWindow, ipcMain, session, shell } = Electron
// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow: Electron.BrowserWindow

let isRunning = false

function createWindow() {
  if (process.platform === 'darwin') {
    const template = [
      {
        label: "Application",
        submenu: [
          { label: "Quit", accelerator: "Command+Q", click: function() { app.quit(); }}
        ]
      }, 
      {
        label: "Edit",
        submenu: [
          { label: "Copy", accelerator: "CmdOrCtrl+C", selector: "copy:" },
          { label: "Paste", accelerator: "CmdOrCtrl+V", selector: "paste:" },
        ]
      }
    ];
    Menu.setApplicationMenu(Menu.buildFromTemplate(template))
  } else {
    Menu.setApplicationMenu(null)
  }

  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    // 自动隐藏菜单栏
    autoHideMenuBar: true,
    // 窗口的默认标题
    title: '知乎助手',
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
    },
  })

  // and load the index.html of the app.
  // 线上地址
  mainWindow.loadFile('./gui/dist/index.html')
  // 本地调试 & 打开控制台
  // mainWindow.loadURL('http://127.0.0.1:8080')
  // mainWindow.webContents.openDevTools()

  // Emitted when the window is closed.
  mainWindow.on('closed', function() {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null
  })

  // 设置ua
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    details.requestHeaders['User-Agent'] =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/71.0.3578.98 Safari/537.36'
    callback({ cancel: false, requestHeaders: details.requestHeaders })
  })

  global.pathConfig = PathConfig
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

// Quit when all windows are closed.
app.on('window-all-closed', function() {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', function() {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow()
  }
})

ipcMain.on('start', async (event, taskConfigList) => {
  if (isRunning) {
    event.returnValue = '目前尚有任务执行, 请稍后'
    return
  }
  isRunning = true
  Logger.log('开始工作')
  let cookieContent = ''
  // 写入任务数据
  fs.writeFileSync(PathConfig.customerTaskConfigUri, JSON.stringify(taskConfigList, null, 4))
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
  await dispatchTaskCommand.handle({}, {})
  Logger.log(`所有任务执行完毕, 打开电子书文件夹 => `, PathConfig.outputPath)
  // 输出打开文件夹
  shell.showItemInFolder(PathConfig.outputPath)
  isRunning = false
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
  await dispatchTaskCommand.handle({}, {})
  Logger.log(`所有任务执行完毕, 打开电子书文件夹 => `, PathConfig.outputPath)
  // 输出打开文件夹
  shell.showItemInFolder(PathConfig.outputPath)
  isRunning = false
})
// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
