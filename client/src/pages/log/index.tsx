import './index.less'
import util from '@/library/util'
import { useEffect, useState } from 'react'
import { Button, Switch } from 'antd'
import { invokeDesktop } from '@/library/desktop'

const Const_Max_Log_Line = 100000

async function getPathConfig() {
  return invokeDesktop<{ runtimeLogUri: string }>('get-path-config')
}

async function clearLog() {
  const pathConfig = await getPathConfig()
  await util.writeFileContent(pathConfig.runtimeLogUri, '')
}

async function getLogContent() {
  const pathConfig = await getPathConfig()
  let logContent = await util.getFileContent(pathConfig.runtimeLogUri)
  let logList = logContent.split('\n')
  let showLogList = logList.slice(logList.length - 500, logList.length) // 只展示最后500行即可
  if (logList.length > Const_Max_Log_Line) {
    await util.writeFileContent(
      pathConfig.runtimeLogUri,
      `日志数超过10w, 自动清空\n--------------\n${showLogList.join('\n')}`,
    )
  }
  return showLogList
}

async function openLogFile() {
  const pathConfig = await getPathConfig()
  await invokeDesktop('show-item-in-folder', { targetPath: pathConfig.runtimeLogUri })
}

let globalIsAutoUpdate = true
export default function IndexPage() {
  let [logContent, setLogContent] = useState<string>('')
  let [isAutoUpdate, setIsAutoUpdate] = useState<boolean>(true)
  globalIsAutoUpdate = isAutoUpdate
  useEffect(() => {
    // 初始化时启动日志自动更新
    const interval = window.setInterval(() => {
      // 若开启自动更新, 默认每秒更新一次
      if (globalIsAutoUpdate) {
        updateLogContent().catch(console.error)
      }
    }, 1000)
    return () => window.clearInterval(interval)
  }, [])

  async function updateLogContent() {
    let logList = await getLogContent()
    setLogContent(logList.join('\n'))
    let divElement = window.document.getElementById('log-dashboard')
    divElement!.scrollTop = divElement!.scrollHeight
  }
  async function clearLogContent() {
    await clearLog()
    await updateLogContent()
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
