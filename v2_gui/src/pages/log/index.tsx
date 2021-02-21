import './index.less';
import _ from 'lodash';
import fs from 'fs';
import electron from 'electron';
import util from '@/library/util';
import { useEffect, useState } from 'react';
import { Button, Switch } from 'antd';
let remote = electron.remote;
let ipcRenderer = electron.ipcRenderer;

let pathConfig = remote.getGlobal('pathConfig');

function clearLog() {
  fs.writeFileSync(pathConfig.runtimeLogUri, '');
}

function getLogContent() {
  let logContent = util.getFileContent(pathConfig.runtimeLogUri);
  let logList = logContent.split('\n');
  let showLogList = logList.slice(logList.length - 500, logList.length); // 只展示最后500行即可
  if (logList.length > 100000) {
    fs.writeFileSync(
      pathConfig.runtimeLogUri,
      `日志数超过10w, 自动清空\n--------------\n${showLogList.join('\n')}`,
    );
  }
  return showLogList;
}

export default function IndexPage() {
  let [logContent, setLogContent] = useState<string>('');
  let [isAutoUpdate, setIsAutoUpdate] = useState<boolean>(true);

  useEffect(() => {
    // 初始化时启动日志自动更新
    setInterval(() => {
      // 若开启自动更新, 默认每秒更新一次
      if (isAutoUpdate) {
        updateLogContent();
      }
    }, 1000);
  }, []);

  function updateLogContent() {
    let logList = getLogContent();
    setLogContent(logList.join('\n'));
    let divElement = window.document.getElementById('log-dashboard');
    divElement!.scrollTop = divElement!.scrollHeight;
  }
  function clearLogContent() {
    clearLog();
    updateLogContent();
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
        &nbsp; 自动刷新:&nbsp;
        <Switch
          checked={isAutoUpdate}
          onChange={(isChecked: boolean) => {
            console.log('isChecked ->', isChecked);
            setIsAutoUpdate(isChecked);
          }}
        ></Switch>
      </div>
    </div>
  );
}
