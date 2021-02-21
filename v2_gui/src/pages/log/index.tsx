import './index.less';
import _ from 'lodash';
import fs from 'fs';
import electron from 'electron';
import util from '@/library/util';
import { useState } from 'react';
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

  function updateLogContent() {
    let logList = getLogContent();
    setLogContent(logList.join('\n'));
    let divElement = window.document.getElementById('log-dashboard');
    divElement!.scrollTop = divElement!.scrollHeight;
  }

  return (
    <div className="log-container">
      <div id="log-dashboard">
        <pre>{logContent}</pre>
      </div>
      <button onClick={updateLogContent}>更新日志</button>
    </div>
  );
}
