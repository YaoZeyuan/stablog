import { Tabs } from 'antd';
import './index.less';

const { TabPane } = Tabs;

export default function IndexPage() {
  return (
    <div className="login-container">
      <webview
        id="foo"
        src="https://m.weibo.cn/"
        disablewebsecurity="true"
      ></webview>
    </div>
  );
}
