import path from 'path';
import fs from 'fs';
import './index.less';
import { TypeBlogItem, TypeDayItem, TypeDayList } from './trans_config';
import { useState, useEffect } from 'react';
import { remote, BrowserView } from 'electron';

// 从Electron端获取BrowserWindow用于将html渲染为图片
let subWindow = remote.getGlobal('subWindow') as BrowserView;

// 配置文件目录
const Const_Config_Uri = path.resolve(
  'F:/www/share/github/stablog/缓存文件/html/yaozeyuan93-微博整理(2011-07-07~2021-01-27)/pdf/content/pdf_config.json',
);

// 图片输出地址
const Const_Output_Img_Dir = path.resolve(
  'F:/www/share/github/stablog/缓存文件/html/trans_img',
);

let htmlConfigList: TypeDayList = [];

/**
 * 读取配置文件
 */
function readConfig() {
  let content = fs.readFileSync(Const_Config_Uri).toString();
  htmlConfigList = JSON.parse(content);
  return;
}

let dayIndex = 0;
let configIndex = 0;

function* getConfigItem() {
  for (let dayList of htmlConfigList) {
    for (let config of dayList.weiboUriList) {
      configIndex++;
      yield config;
    }
  }
}
let generate = getConfigItem();

const Const_Default_Webview_Width = 760;
const Const_Default_Webview_Height = 10;

export default function IndexPage() {
  let [pageConfig, setPageConfig] = useState<TypeBlogItem>();

  // 初始化时读取配置
  useEffect(() => {
    readConfig();
  }, []);

  useEffect(() => {
    updateSubWindow();
  }, [pageConfig]);

  async function updateSubWindow() {
    let webview = subWindow.webContents;
    if (pageConfig?.uri === undefined) {
      return;
    }
    await subWindow.setContentSize(
      Const_Default_Webview_Width,
      Const_Default_Webview_Height,
    );
    webview.loadURL(pageConfig!.uri);
    await new Promise((reslove, reject) => {
      webview.once('dom-ready', () => {
        reslove(true);
      });
    });
    let scrollHeight = await webview.executeJavaScript(
      `document.children[0].children[1].scrollHeight`,
    );
    console.log('scrollHeight => ', scrollHeight);
    await subWindow.setContentSize(760, scrollHeight);
    let newScrollHeight = await webview.executeJavaScript(
      `document.children[0].children[1].scrollHeight`,
    );
    console.log('newScrollHeight => ', newScrollHeight);

    // 生成图片
    console.log('start generateImage');
    let nativeImg = await webview.capturePage();
    let jpgContent = nativeImg.toJPEG(100);
    let pngContent = nativeImg.toPNG();
    fs.writeFileSync(
      path.resolve(Const_Output_Img_Dir, `${configIndex}.jpg`),
      jpgContent,
    );
    fs.writeFileSync(
      path.resolve(Const_Output_Img_Dir, `${configIndex}.png`),
      pngContent,
    );
    console.log('generateImage complete');
    // generateNextDayPageConfig();
  }

  function generateNextDayPageConfig() {
    let status = generate.next();
    if (status.done !== true) {
      setPageConfig(status.value);
    } else {
      // 已读取一遍. 重新开始读取
      configIndex = 0;
      generate = getConfigItem();
    }
  }

  console.log('pageConfig => ', pageConfig);
  return (
    <div>
      图片预览
      <button onClick={generateNextDayPageConfig}>
        生成第{configIndex}天的数据
      </button>
      <button onClick={generateImage}>生成图片</button>
      <button>开始</button>
      <button onClick={readConfig}>重新读取配置</button>
    </div>
  );
}
