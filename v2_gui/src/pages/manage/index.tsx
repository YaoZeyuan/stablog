import path from 'path';
import fs from 'fs';
import './index.less';
import { TypeBlogItem, TypeDayItem, TypeDayList } from './trans_config';
import { useState, useRef, useEffect } from 'react';
import { WebviewTag } from 'electron';

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

const Const_Default_Webview_Width = '760px';

export default function IndexPage() {
  let [pageConfig, setPageConfig] = useState<TypeBlogItem>();
  let [webviewStyle, setWebviewStyle] = useState({
    width: Const_Default_Webview_Width,
    // height: '100px',
  });

  useEffect(() => {
    readConfig();
  }, []);

  useEffect(() => {
    updateWebviewHeight();
  }, [pageConfig]);

  async function updateWebviewHeight() {
    let webview = document.querySelector('#webview-render');
    if (webview === null) {
      return;
    }

    await new Promise((reslove, reject) => {
      webview?.addEventListener('dom-ready', () => {
        reslove(true);
      });
    });

    let height = await webview.executeJavaScript(
      `document.children[0].children[1].scrollHeight`,
    );
    console.log('height => ', height);
    // 更新页面宽度
    setWebviewStyle({
      width: Const_Default_Webview_Width,
      height: `${height}px`,
    });
  }

  async function generateImage() {
    let webview = document.querySelector('#webview-render') as WebviewTag;
    let nativeImg = await webview.capturePage();
    let jpgContent = nativeImg.toJPEG(100);
    fs.writeFileSync(path.resolve(Const_Output_Img_Dir, '1.jpg'), jpgContent);
  }

  console.log('webviewStyle => ', webviewStyle);
  console.log('pageConfig => ', pageConfig);
  return (
    <div>
      图片预览
      <button
        onClick={() => {
          let status = generate.next();
          if (status.done !== true) {
            setPageConfig(status.value);
            // 重置webview高度
            setWebviewStyle({
              width: Const_Default_Webview_Width,
            });
          } else {
            // 已读取一遍. 重新开始读取
            configIndex = 0;
            generate = getConfigItem();
          }
        }}
      >
        生成第{configIndex}天的数据
      </button>
      <button onClick={updateWebviewHeight}>更新webview宽度</button>
      <button onClick={generateImage}>生成图片</button>
      <button>开始</button>
      <button onClick={readConfig}>重新读取配置</button>
      <div className="html-2-image">
        <webview
          id="webview-render"
          style={webviewStyle}
          src={pageConfig?.uri}
        ></webview>
      </div>
    </div>
  );
}
