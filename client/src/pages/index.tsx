import { ConfigProvider, Tabs } from 'antd'
import './index.less'
import CustomerTask from './customer_task'
import DataManage from './manage'
import Helper from './helper'
import Log from './log'
import Login from './login'
import { useState } from 'react'
import zhCN from 'antd/locale/zh_CN'
import { useTaskDashboard } from './customer_task/use_task_dashboard'
// for date-picker i18n
import 'dayjs/locale/zh-cn'

export default function IndexPage() {
  let [currentTabKey, setCurrentTabKey] = useState<string>('customer_task')
  const taskDashboard = useTaskDashboard()

  function changeTabKey(tab: string) {
    setCurrentTabKey(tab)
  }

  return (
    <ConfigProvider locale={zhCN}>
      <div className="tab-card-container">
        <Tabs
          activeKey={currentTabKey}
          centered
          onChange={setCurrentTabKey}
          items={[
            {
              key: 'customer_task',
              label: '系统设置',
              children: <CustomerTask changeTabKey={changeTabKey} taskDashboard={taskDashboard} />,
            },
            { key: 'manage', label: '管理数据', children: <DataManage /> },
            { key: 'log', label: '运行日志', children: <Log taskDashboard={taskDashboard} /> },
            { key: 'login', label: '登录微博', children: <Login /> },
            { key: 'help', label: '使用说明', children: <Helper /> },
          ]}
        />
      </div>
    </ConfigProvider>
  )
}
