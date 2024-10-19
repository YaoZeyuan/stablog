import './index.less'
import _ from 'lodash'
import path from 'path'
import util from '@/library/util'
import { useEffect, useState } from 'react'
import { Button, Switch } from 'antd'

const electron = require('electron')
let shell = electron.shell
let ipcRenderer = electron.ipcRenderer

let pathConfigStr = ipcRenderer.sendSync('getPathConfig')
let pathConfig = JSON.parse(pathConfigStr)
const Const_Max_Log_Line = 100000

function clearLog() {
  util.writeFileContent(pathConfig.runtimeLogUri, '')
}

function getLogContent() {
  let logContent = util.getFileContent(pathConfig.runtimeLogUri)
  let logList = logContent.split('\n')
  let showLogList = logList.slice(logList.length - 500, logList.length) // 只展示最后500行即可
  if (logList.length > Const_Max_Log_Line) {
    util.writeFileContent(
      pathConfig.runtimeLogUri,
      `日志数超过10w, 自动清空\n--------------\n${showLogList.join('\n')}`,
    )
  }
  return showLogList
}

function openLogFile() {
  shell.openExternal(pathConfig.runtimeLogUri)
  shell.showItemInFolder(pathConfig.runtimeLogUri)
  return
}

let globalIsAutoUpdate = true
export default function IndexPage() {
  let [logContent, setLogContent] = useState<string>('')
  let [isAutoUpdate, setIsAutoUpdate] = useState<boolean>(true)
  globalIsAutoUpdate = isAutoUpdate
  useEffect(() => {
    // 初始化时启动日志自动更新
    setInterval(() => {
      // 若开启自动更新, 默认每秒更新一次
      if (globalIsAutoUpdate) {
        updateLogContent()
      }
    }, 1000)
  }, [])

  function updateLogContent() {
    let logList = getLogContent()
    setLogContent(logList.join('\n'))
    let divElement = window.document.getElementById('log-dashboard')
    divElement!.scrollTop = divElement!.scrollHeight
  }
  function clearLogContent() {
    clearLog()
    updateLogContent()
  }

  return (
    <div className="log-container">
      <div id="log-dashboard">
        <pre>{logContent}</pre>
      </div>
      <p></p>
      <div>
        <Button onClick={updateLogContent}>刷新</Button>
        &nbsp;
        <Button onClick={clearLogContent}>清空日志</Button>
        &nbsp;
        <Button onClick={openLogFile}>打开日志文件</Button>
        &nbsp; 自动刷新:&nbsp;
        <Switch
          checked={isAutoUpdate}
          onChange={(isChecked: boolean) => {
            console.log('isChecked ->', isChecked)
            setIsAutoUpdate(isChecked)
          }}
        ></Switch>
      </div>
    </div>
  )
}
