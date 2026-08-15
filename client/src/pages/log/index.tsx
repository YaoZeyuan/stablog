import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Divider,
  Empty,
  message,
  Pagination,
  Progress,
  Space,
  Statistic,
  Switch,
  Table,
  Tag,
} from 'antd'
import type { TableProps } from 'antd'
import util from '@/library/util'
import { invokeDesktop } from '@/library/desktop'
import type { TaskDashboardController } from '../customer_task/use_task_dashboard'
import type {
  CustomerTaskFailure,
  CustomerTaskFailureList,
  TaskCommandAck,
  TaskStatus,
  TaskUserProgress,
} from '../customer_task/task_type'
import * as TaskUtils from '../customer_task/utils'
import './index.less'

const MAX_LOG_LINE = 100000
const FAILURE_PAGE_SIZE = 20

type Props = {
  taskDashboard: TaskDashboardController
}

async function getPathConfig() {
  return invokeDesktop<{ runtimeLogUri: string }>('get-path-config')
}

async function clearLog() {
  const pathConfig = await getPathConfig()
  await util.writeFileContent(pathConfig.runtimeLogUri, '')
}

async function getLogContent() {
  const pathConfig = await getPathConfig()
  const logContent = await util.getFileContent(pathConfig.runtimeLogUri)
  const logList = logContent.split('\n')
  const showLogList = logList.slice(Math.max(0, logList.length - 500))
  if (logList.length > MAX_LOG_LINE) {
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

function statusTag(status: TaskStatus) {
  const config: Record<TaskStatus, { color: string; text: string }> = {
    pending: { color: 'default', text: '待处理' },
    running: { color: 'processing', text: '运行中' },
    succeeded: { color: 'success', text: '已完成' },
    partial_success: { color: 'warning', text: '部分完成' },
    failed: { color: 'error', text: '失败' },
  }
  const item = config[status]
  return <Tag color={item.color}>{item.text}</Tag>
}

function formatDuration(seconds?: number | null) {
  if (seconds === undefined || seconds === null) return '估算中'
  if (seconds < 60) return `${Math.ceil(seconds)} 秒`
  const minutes = Math.ceil(seconds / 60)
  if (minutes < 60) return `${minutes} 分钟`
  const hours = Math.floor(minutes / 60)
  const remainMinutes = minutes % 60
  return `${hours} 小时${remainMinutes ? ` ${remainMinutes} 分钟` : ''}`
}

function formatTime(timestamp?: number) {
  return timestamp === undefined ? '-' : new Date(timestamp).toLocaleString('zh-CN', { hour12: false })
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

export default function LogPage({ taskDashboard }: Props) {
  const [logContent, setLogContent] = useState('')
  const [isAutoUpdate, setIsAutoUpdate] = useState(true)
  const autoUpdateRef = useRef(true)
  const [failureList, setFailureList] = useState<CustomerTaskFailure[]>([])
  const [failureTotal, setFailureTotal] = useState(0)
  const [failurePage, setFailurePage] = useState(1)
  const [failureError, setFailureError] = useState('')
  const [pendingCommand, setPendingCommand] = useState<string>()

  const batch = taskDashboard.dashboard.batch
  const batchId = batch?.batchId

  useEffect(() => {
    setFailurePage(1)
  }, [batchId])

  const updateLogContent = useCallback(async () => {
    const logList = await getLogContent()
    setLogContent(logList.join('\n'))
    const dashboard = window.document.getElementById('log-dashboard')
    if (dashboard) {
      dashboard.scrollTop = dashboard.scrollHeight
    }
  }, [])

  useEffect(() => {
    void updateLogContent().catch(console.error)
    const interval = window.setInterval(() => {
      if (autoUpdateRef.current) {
        void updateLogContent().catch(console.error)
      }
    }, 1000)
    return () => window.clearInterval(interval)
  }, [updateLogContent])

  const loadFailures = useCallback(async () => {
    if (!batchId) {
      setFailureList([])
      setFailureTotal(0)
      setFailureError('')
      return
    }
    try {
      const result = await invokeDesktop<CustomerTaskFailureList>(
        'get-customer-task-failures',
        {
          batchId,
          offset: (failurePage - 1) * FAILURE_PAGE_SIZE,
          limit: FAILURE_PAGE_SIZE,
        },
      )
      setFailureList(result.items)
      setFailureTotal(result.total)
      setFailureError('')
    } catch (loadError) {
      setFailureError(errorMessage(loadError))
    }
  }, [batchId, failurePage])

  useEffect(() => {
    void loadFailures()
    const interval = window.setInterval(() => {
      void loadFailures()
    }, taskDashboard.isActive ? 1000 : 5000)
    return () => window.clearInterval(interval)
  }, [loadFailures, taskDashboard.isActive])

  function handleCommandAck(ack: TaskCommandAck) {
    taskDashboard.selectBatch(ack.batchId)
    message.info(ack.outcome === 'already_running' ? '已有任务正在运行' : '任务已启动')
    window.setTimeout(() => void taskDashboard.refresh(), 0)
  }

  async function continueTask() {
    if (!batchId) return
    setPendingCommand('continue')
    try {
      handleCommandAck(await TaskUtils.continueBackupTask(batchId))
    } catch (commandError) {
      message.error(`继续任务失败：${errorMessage(commandError)}`)
    } finally {
      setPendingCommand(undefined)
    }
  }

  async function retryTasks(taskIds?: string[]) {
    if (!batchId) return
    const commandKey = taskIds?.[0] ?? 'all'
    setPendingCommand(commandKey)
    try {
      handleCommandAck(await TaskUtils.retryBackupTaskItems(batchId, taskIds))
      await loadFailures()
    } catch (commandError) {
      message.error(`重试失败任务失败：${errorMessage(commandError)}`)
    } finally {
      setPendingCommand(undefined)
    }
  }

  const completed = batch ? batch.counts.succeeded + batch.counts.failed : 0
  const progressPercent = batch
    ? batch.counts.total === 0
      ? batch.status === 'succeeded' ? 100 : 0
      : Math.min(100, Math.round((completed / batch.counts.total) * 100))
    : 0

  const currentNode = batch?.current
  const currentNodeText = currentNode
    ? [
        currentNode.screenName || currentNode.uid,
        currentNode.year ? `${currentNode.year} 年` : '',
        currentNode.month ? `${currentNode.month} 月` : '',
        currentNode.segmentStartDate && currentNode.segmentEndDate
          ? `${currentNode.segmentStartDate} ～ ${currentNode.segmentEndDate}`
          : '',
        currentNode.page ? `第 ${currentNode.page}${currentNode.pageCount ? `/${currentNode.pageCount}` : ''} 页` : '',
      ].filter(Boolean).join(' · ')
    : '-'

  const userColumns: TableProps<TaskUserProgress>['columns'] = [
    {
      title: '用户',
      key: 'user',
      render: (_, record) => record.screenName ? `${record.screenName} (${record.uid})` : record.uid,
    },
    { title: '状态', dataIndex: 'status', key: 'status', render: statusTag },
    { title: '成功', key: 'succeeded', render: (_, record) => record.counts.succeeded },
    { title: '失败', key: 'failed', render: (_, record) => record.counts.failed },
    { title: '待处理', key: 'pending', render: (_, record) => record.counts.pending + record.counts.running },
    { title: '缓存命中', key: 'cacheHits', render: (_, record) => record.counts.cacheHits },
  ]

  const failureColumns: TableProps<CustomerTaskFailure>['columns'] = [
    {
      title: '用户',
      key: 'user',
      render: (_, record) => record.screenName ? `${record.screenName} (${record.uid})` : record.uid,
    },
    {
      title: '日期段 / 页',
      key: 'range',
      render: (_, record) => {
        const range = record.segmentStartDate && record.segmentEndDate
          ? `${record.segmentStartDate} ～ ${record.segmentEndDate}`
          : '-'
        return `${range}${record.page ? ` · 第 ${record.page} 页` : ''}`
      },
    },
    { title: '尝试次数', dataIndex: 'attempts', key: 'attempts', width: 90 },
    {
      title: '错误',
      key: 'error',
      render: (_, record) => (
        <div>
          {record.errorCode && <Tag color="error">{record.errorCode}</Tag>}
          <span>{record.errorMessage || '抓取失败'}</span>
        </div>
      ),
    },
    { title: '更新时间', key: 'updatedAt', render: (_, record) => formatTime(record.updatedAt), width: 180 },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Button
          size="small"
          disabled={taskDashboard.isActive || pendingCommand !== undefined}
          loading={pendingCommand === record.taskId}
          onClick={() => void retryTasks([record.taskId])}
        >
          重试
        </Button>
      ),
    },
  ]

  return (
    <div className="log-container">
      {taskDashboard.error && (
        <Alert type="warning" showIcon title="任务状态暂时无法刷新" description={taskDashboard.error} />
      )}

      <Card
        className="task-progress-card"
        title="备份任务进度"
        extra={batch ? statusTag(batch.status) : null}
      >
        {!batch ? (
          <Empty description={taskDashboard.isLoading ? '正在读取任务状态' : '暂无任务记录'} />
        ) : (
          <>
            <Progress
              percent={progressPercent}
              status={batch.status === 'failed' ? 'exception' : batch.status === 'succeeded' ? 'success' : 'active'}
            />
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="任务批次">{batch.batchId}</Descriptions.Item>
              <Descriptions.Item label="当前阶段">
                {{ planning: '规划任务', fetching: '抓取微博', generating: '生成电子书', done: '已结束' }[batch.phase]}
              </Descriptions.Item>
              <Descriptions.Item label="当前节点" span={2}>{currentNodeText}</Descriptions.Item>
              <Descriptions.Item label="开始时间">{formatTime(batch.startedAt ?? batch.createdAt)}</Descriptions.Item>
              <Descriptions.Item label="预计剩余">{formatDuration(batch.estimatedRemainingSeconds)}</Descriptions.Item>
            </Descriptions>

            <div className="task-statistics">
              <Statistic title="已完成 / 总任务" value={`${completed} / ${batch.counts.total}`} />
              <Statistic title="成功" value={batch.counts.succeeded} valueStyle={{ color: '#3f8600' }} />
              <Statistic title="失败" value={batch.counts.failed} valueStyle={{ color: batch.counts.failed ? '#cf1322' : undefined }} />
              <Statistic title="待处理" value={batch.counts.pending + batch.counts.running} />
              <Statistic title="缓存命中" value={batch.counts.cacheHits} />
            </div>

            <Divider titlePlacement="start">用户进度</Divider>
            <Table<TaskUserProgress>
              rowKey="uid"
              size="small"
              pagination={false}
              columns={userColumns}
              dataSource={batch.users}
            />

            <Divider titlePlacement="start">失败任务</Divider>
            <Space className="failure-actions">
              {batch.resumable && !taskDashboard.isActive && (
                <Button
                  type="primary"
                  disabled={pendingCommand !== undefined}
                  loading={pendingCommand === 'continue'}
                  onClick={() => void continueTask()}
                >
                  继续未完成任务
                </Button>
              )}
              <Button
                disabled={taskDashboard.isActive || failureTotal === 0 || pendingCommand !== undefined}
                loading={pendingCommand === 'all'}
                onClick={() => void retryTasks()}
              >
                重试全部失败项
              </Button>
              <span>共 {failureTotal} 项</span>
            </Space>
            {failureError && <Alert type="warning" showIcon title="失败任务列表读取失败" description={failureError} />}
            <Table<CustomerTaskFailure>
              rowKey="taskId"
              size="small"
              pagination={false}
              columns={failureColumns}
              dataSource={failureList}
              locale={{ emptyText: '没有失败任务' }}
            />
            {failureTotal > FAILURE_PAGE_SIZE && (
              <Pagination
                className="failure-pagination"
                current={failurePage}
                pageSize={FAILURE_PAGE_SIZE}
                total={failureTotal}
                showSizeChanger={false}
                onChange={setFailurePage}
              />
            )}
          </>
        )}
      </Card>

      <Divider titlePlacement="start">运行日志</Divider>
      <div id="log-dashboard"><pre>{logContent}</pre></div>
      <div className="log-actions">
        <Button onClick={() => void updateLogContent()}>刷新</Button>
        <Button
          onClick={async () => {
            await clearLog()
            await updateLogContent()
          }}
        >
          清空日志
        </Button>
        <Button onClick={() => void openLogFile()}>打开日志文件</Button>
        <span>自动刷新：</span>
        <Switch
          checked={isAutoUpdate}
          onChange={(checked) => {
            autoUpdateRef.current = checked
            setIsAutoUpdate(checked)
          }}
        />
      </div>
    </div>
  )
}
