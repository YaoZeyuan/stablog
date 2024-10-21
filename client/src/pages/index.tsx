import { ConfigProvider, Tabs } from 'antd'
import './index.less'
import CustomerTask from './customer_task'
import DataManage from './manage'
import Helper from './helper'
import Log from './log'
import Login from './login'
import { useState } from 'react'
import zhCN from 'antd/locale/zh_CN'
// for date-picker i18n
import 'dayjs/locale/zh-cn'

const { TabPane } = Tabs

export default function IndexPage() {
  let [currentTabKey, setCurrentTabKey] = useState<string>('customer_task')

  function changeTabKey(tab: string) {
    setCurrentTabKey(tab)
  }

  return (
    <ConfigProvider locale={zhCN}>
      <div className="tab-card-container">
        <Tabs
          activeKey={currentTabKey}
          centered
          onTabClick={(key: string) => {
            setCurrentTabKey(key)
          }}
        >
          <TabPane tab="系统设置" key="customer_task">
            <CustomerTask changeTabKey={changeTabKey}></CustomerTask>
          </TabPane>
          <TabPane tab="管理数据" key="manage">
            <DataManage></DataManage>
          </TabPane>
          <TabPane tab="运行日志" key="log">
            <Log></Log>
          </TabPane>
          <TabPane tab="登录微博" key="login">
            <Login></Login>
          </TabPane>
          <TabPane tab="使用说明" key="help">
            <Helper></Helper>
          </TabPane>
        </Tabs>
      </div>
    </ConfigProvider>
  )
}
