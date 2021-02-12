import { Tabs } from 'antd';
import './index.less';

const { TabPane } = Tabs;

export default function IndexPage() {
  return (
    <Tabs defaultActiveKey="1" centered>
      <TabPane tab="系统设置" key="1">
        Content of Tab Pane 1
      </TabPane>
      <TabPane tab="管理数据" key="2">
        Content of Tab Pane 2
      </TabPane>
      <TabPane tab="运行日志" key="3">
        Content of Tab Pane 3
      </TabPane>
      <TabPane tab="登录微博" key="4">
        Content of Tab Pane 3
      </TabPane>
      <TabPane tab="使用说明" key="5">
        Content of Tab Pane 3
      </TabPane>
    </Tabs>
  );
}
