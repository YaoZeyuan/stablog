import { Tabs } from 'antd';
import './index.less';
import CustomerTask from './customer_task';
import DataManage from './manage';
import Helper from './helper';
import Log from './log';
import Login from './login';

const { TabPane } = Tabs;

export default function IndexPage() {
  return (
    <Tabs defaultActiveKey="1" centered>
      <TabPane tab="系统设置" key="1">
        <CustomerTask></CustomerTask>
      </TabPane>
      <TabPane tab="管理数据" key="2">
        <DataManage></DataManage>
      </TabPane>
      <TabPane tab="运行日志" key="3">
        <Log></Log>
      </TabPane>
      <TabPane tab="登录微博" key="4">
        <Login></Login>
      </TabPane>
      <TabPane tab="使用说明" key="5">
        <Helper></Helper>
      </TabPane>
    </Tabs>
  );
}
