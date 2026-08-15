import { useEffect, useMemo, useRef, useState } from 'react'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import {
  Alert,
  Button,
  Card,
  Collapse,
  DatePicker,
  Descriptions,
  Divider,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Radio,
  Select,
  Space,
  Switch,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import {
  DeleteOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import type { WeiboUserSummary } from '@/library/desktop'
import './index.less'
import * as TaskUtils from './utils'
import {
  DEFAULT_CUSTOMER_TASK_CONFIG,
  IMAGE_QUALITY,
  VOLUME_SPLIT_BY,
  type CustomerTaskConfig,
  type CustomerTaskRecord,
  type TaskCommandAck,
} from './task_type'
import type { TaskDashboardController } from './use_task_dashboard'
import {
  requiresWeiboLoginForNewTask,
  resolveLocalWeiboTargetUid,
} from './execution_policy'

const { RangePicker } = DatePicker
const MIN_FETCH_DATE = dayjs('2009-09-01')

function shanghaiToday(): Dayjs {
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
  return dayjs(date)
}

type CustomerTaskFormValues = Omit<
  CustomerTaskConfig,
  'fetchStartDate' | 'fetchEndDate' | 'outputStartAtMs' | 'outputEndAtMs'
> & {
  fetchDateRange: [Dayjs, Dayjs]
  outputTimeRange: [Dayjs, Dayjs]
}

type Props = {
  changeTabKey: (tab: string) => void
  taskDashboard: TaskDashboardController
}

function createDefaultConfig(): CustomerTaskConfig {
  const today = shanghaiToday()
  return {
    ...DEFAULT_CUSTOMER_TASK_CONFIG,
    configList: DEFAULT_CUSTOMER_TASK_CONFIG.configList.map((item) => ({ ...item })),
    fetchEndDate: today.format('YYYY-MM-DD'),
    outputStartAtMs: dayjs('2009-09-01').startOf('day').valueOf(),
    outputEndAtMs: today.endOf('day').valueOf(),
  }
}

function toFormValues(config: CustomerTaskConfig): CustomerTaskFormValues {
  const defaults = createDefaultConfig()
  return {
    ...config,
    configList: config.configList.length > 0
      ? config.configList.map((item) => ({ ...item }))
      : defaults.configList,
    fetchDateRange: [
      dayjs(config.fetchStartDate || defaults.fetchStartDate),
      dayjs(config.fetchEndDate || defaults.fetchEndDate),
    ],
    outputTimeRange: [
      dayjs(config.outputStartAtMs ?? defaults.outputStartAtMs),
      dayjs(config.outputEndAtMs ?? defaults.outputEndAtMs),
    ],
  }
}

function toTaskConfig(values: CustomerTaskFormValues): CustomerTaskConfig {
  const [fetchStartDate, fetchEndDate] = values.fetchDateRange
  const [outputStartAt, outputEndAt] = values.outputTimeRange
  return {
    configList: values.configList.map((item) => ({
      uid: (item.uid ?? '').trim(),
      rawInputText: (item.rawInputText ?? '').trim(),
      comment: item.comment ?? '',
    })),
    imageQuilty: values.imageQuilty,
    bookTitle: values.bookTitle ?? '',
    comment: values.comment ?? '',
    postAtOrderBy: values.postAtOrderBy,
    fetchStartDate: fetchStartDate.format('YYYY-MM-DD'),
    fetchEndDate: fetchEndDate.format('YYYY-MM-DD'),
    requestIntervalSeconds: values.requestIntervalSeconds,
    cacheReadMode: values.cacheReadMode,
    outputStartAtMs: outputStartAt.startOf('day').valueOf(),
    outputEndAtMs: outputEndAt.endOf('day').valueOf(),
    isSkipFetch: values.isSkipFetch,
    isSkipGeneratePdf: values.isSkipGeneratePdf,
    isRegenerateHtml2PdfImage: values.isRegenerateHtml2PdfImage,
    isOnlyArticle: values.isOnlyArticle,
    isOnlyOriginal: values.isOnlyOriginal,
    volumeSplitBy: values.volumeSplitBy,
    volumeSplitCount: values.volumeSplitCount,
  }
}

function formatDuration(totalSeconds: number): string {
  if (totalSeconds < 60) {
    return `${totalSeconds} 秒`
  }
  const totalMinutes = Math.ceil(totalSeconds / 60)
  if (totalMinutes < 60) {
    return `${totalMinutes} 分钟`
  }
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${hours} 小时${minutes === 0 ? '' : ` ${minutes} 分钟`}`
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export default function CustomerTaskPage({ changeTabKey, taskDashboard }: Props) {
  const [form] = Form.useForm<CustomerTaskFormValues>()
  const [isConfigLoaded, setIsConfigLoaded] = useState(false)
  const [configLoadError, setConfigLoadError] = useState('')
  const [isCommandPending, setIsCommandPending] = useState(false)
  const [syncingIndex, setSyncingIndex] = useState<number>()
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [showUpgradeInfo, setShowUpgradeInfo] = useState(false)
  const [remoteVersionConfig, setRemoteVersionConfig] = useState({
    version: '',
    downloadUrl: '',
    releaseAt: '',
    releaseNote: '',
  })
  const [userInfoByIndex, setUserInfoByIndex] = useState<Record<number, WeiboUserSummary>>({})
  const saveTimerRef = useRef<number | undefined>(undefined)

  const watchedConfigList = Form.useWatch('configList', form) ?? []
  const watchedFetchRange = Form.useWatch('fetchDateRange', form)
  const watchedRequestInterval = Form.useWatch('requestIntervalSeconds', form) ?? 10
  const watchedSkipFetch = Form.useWatch('isSkipFetch', form) ?? false
  const watchedSkipPdf = Form.useWatch('isSkipGeneratePdf', form) ?? false
  const watchedVolumeSplitBy = Form.useWatch('volumeSplitBy', form)
  const watchedAllValues = Form.useWatch([], form) as CustomerTaskFormValues | undefined

  useEffect(() => {
    let alive = true
    TaskUtils.getConfig()
      .then((savedConfig) => {
        if (!alive) return
        form.setFieldsValue(toFormValues(savedConfig))
        setConfigLoadError('')
      })
      .catch((loadError) => {
        if (!alive) return
        setConfigLoadError(errorMessage(loadError))
      })
      .finally(() => {
        if (alive) setIsConfigLoaded(true)
      })
    return () => {
      alive = false
      if (saveTimerRef.current !== undefined) {
        window.clearTimeout(saveTimerRef.current)
      }
    }
  }, [form])

  useEffect(() => {
    if ((taskDashboard.isActive || isCommandPending) && saveTimerRef.current !== undefined) {
      window.clearTimeout(saveTimerRef.current)
      saveTimerRef.current = undefined
    }
  }, [isCommandPending, taskDashboard.isActive])

  const roughEstimate = useMemo(() => {
    if (!watchedFetchRange || watchedConfigList.length === 0) {
      return { requests: 0, seconds: 0, statuses: 0 }
    }
    const [start, end] = watchedFetchRange
    const userCount = watchedConfigList.length
    const dayCount = Math.max(1, end.startOf('day').diff(start.startOf('day'), 'day') + 1)
    const monthCount = Math.max(1, (end.year() - start.year()) * 12 + end.month() - start.month() + 1)
    const yearCount = Math.max(1, end.year() - start.year() + 1)
    const statuses = Object.values(userInfoByIndex)
      .reduce((sum, userInfo) => sum + userInfo.statuses_count, 0)
    const planningRequests = (yearCount + monthCount + Math.ceil(dayCount / 7)) * userCount
    const pageRequests = Math.ceil(statuses / 50)
    const requests = watchedSkipFetch ? 0 : planningRequests + pageRequests
    const renderSeconds = watchedSkipPdf ? 0 : statuses * 2
    return {
      requests,
      statuses,
      seconds: Math.ceil((requests * Math.max(10, watchedRequestInterval) + renderSeconds) * 1.5),
    }
  }, [userInfoByIndex, watchedConfigList, watchedFetchRange, watchedRequestInterval, watchedSkipFetch, watchedSkipPdf])

  const previewConfig = useMemo(() => {
    if (!watchedAllValues?.fetchDateRange || !watchedAllValues.outputTimeRange) {
      return null
    }
    try {
      return toTaskConfig(watchedAllValues)
    } catch {
      return null
    }
  }, [watchedAllValues])

  function scheduleSave(values: CustomerTaskFormValues) {
    if (!isConfigLoaded || configLoadError !== '' || taskDashboard.isActive || isCommandPending) {
      return
    }
    if (saveTimerRef.current !== undefined) {
      window.clearTimeout(saveTimerRef.current)
    }
    saveTimerRef.current = window.setTimeout(() => {
      try {
        void TaskUtils.saveConfig(toTaskConfig(values)).catch((saveError) => {
          message.error(`保存任务配置失败：${errorMessage(saveError)}`)
        })
      } catch {
        // 表单填写到一半时暂不保存，正式启动仍会执行完整校验。
      }
    }, 500)
  }

  async function ensureLoggedIn(): Promise<boolean> {
    try {
      const isLogin = await TaskUtils.asyncCheckIsLogin()
      if (!isLogin) {
        setShowLoginModal(true)
      }
      return isLogin
    } catch (loginError) {
      message.error(`检查微博登录状态失败：${errorMessage(loginError)}`)
      return false
    }
  }

  async function resolveUser(
    index: number,
    fetchSummary: boolean,
    allowRemoteResolution = true,
  ): Promise<CustomerTaskRecord> {
    const record = form.getFieldValue(['configList', index]) as CustomerTaskRecord | undefined
    if (record === undefined) {
      throw new Error(`第 ${index + 1} 个用户尚未填写个人主页`)
    }
    let uid = resolveLocalWeiboTargetUid(record)
    if (uid === '' && !record.rawInputText?.trim()) {
      throw new Error(`第 ${index + 1} 个用户尚未填写 UID 或个人主页`)
    }
    if (uid === '' && allowRemoteResolution) {
      uid = await TaskUtils.asyncGetUid(record.rawInputText)
    }
    if (!/^\d{1,32}$/.test(uid)) {
      if (allowRemoteResolution === false) {
        throw new Error(
          `跳过抓取时无法离线解析第 ${index + 1} 个用户的 UID，请输入数字 UID 或包含数字 UID 的微博主页地址`,
        )
      }
      throw new Error(`无法解析第 ${index + 1} 个用户的 UID`)
    }
    form.setFieldValue(['configList', index, 'uid'], uid)
    if (fetchSummary) {
      const userInfo = await TaskUtils.asyncGetUserInfo(uid)
      if (!userInfo.screen_name) {
        throw new Error(`无法读取 UID ${uid} 的用户信息`)
      }
      setUserInfoByIndex((current) => ({ ...current, [index]: userInfo }))
    }
    return { ...record, uid }
  }

  async function syncUser(index: number) {
    if (taskDashboard.isActive || isCommandPending) return
    setSyncingIndex(index)
    try {
      if (!(await ensureLoggedIn())) return
      const user = await resolveUser(index, true)
      const info = userInfoByIndex[index]
      message.success(info?.screen_name ? `已同步 ${info.screen_name}` : `已同步 UID ${user.uid}`)
    } catch (syncError) {
      message.error(errorMessage(syncError))
    } finally {
      setSyncingIndex(undefined)
    }
  }

  async function ensureAllUsersResolved(values: CustomerTaskFormValues): Promise<CustomerTaskConfig> {
    const needsWeiboLogin = requiresWeiboLoginForNewTask(values)
    if (needsWeiboLogin && !(await ensureLoggedIn())) {
      throw new Error('请先登录微博账号')
    }
    const resolvedList: CustomerTaskRecord[] = []
    for (let index = 0; index < values.configList.length; index += 1) {
      resolvedList.push(await resolveUser(index, false, needsWeiboLogin))
    }
    form.setFieldValue('configList', resolvedList)
    return toTaskConfig({ ...values, configList: resolvedList })
  }

  function handleCommandAck(ack: TaskCommandAck) {
    taskDashboard.selectBatch(ack.batchId)
    changeTabKey('log')
    if (ack.outcome === 'already_running') {
      message.info('已有备份任务正在运行，已切换到任务进度')
    } else {
      message.success('任务已启动')
    }
    window.setTimeout(() => void taskDashboard.refresh(), 0)
  }

  async function startNewTask() {
    if (saveTimerRef.current !== undefined) {
      window.clearTimeout(saveTimerRef.current)
      saveTimerRef.current = undefined
    }
    setIsCommandPending(true)
    try {
      const values = await form.validateFields()
      const config = await ensureAllUsersResolved(values)
      handleCommandAck(await TaskUtils.startBackupTask(config))
    } catch (startError) {
      message.error(`启动任务失败：${errorMessage(startError)}`)
    } finally {
      setIsCommandPending(false)
    }
  }

  async function continueTask() {
    const batchId = taskDashboard.dashboard.batch?.batchId
    if (!batchId) return
    setIsCommandPending(true)
    try {
      handleCommandAck(await TaskUtils.continueBackupTask(batchId))
    } catch (continueError) {
      message.error(`继续任务失败：${errorMessage(continueError)}`)
    } finally {
      setIsCommandPending(false)
    }
  }

  function confirmRestart() {
    Modal.confirm({
      title: '确认重新抓取？',
      content: '将创建新的任务批次，不复用旧批次的成功状态；是否读取 HTTP 缓存由当前缓存策略决定。',
      okText: '重新抓取',
      cancelText: '取消',
      onOk: startNewTask,
    })
  }

  function confirmClearCache(index: number) {
    const record = form.getFieldValue(['configList', index]) as CustomerTaskRecord | undefined
    if (!record?.uid) {
      message.warning('请先同步用户信息')
      return
    }
    Modal.confirm({
      title: '清除目标用户接口缓存？',
      content: `仅删除 UID ${record.uid} 的微博检索 JSON 缓存，不会删除微博数据、图片或任务历史。`,
      okText: '清除缓存',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        await TaskUtils.clearWeiboRequestCache(record.uid)
        message.success('已清除该用户的接口缓存')
      },
    })
  }

  async function resetConfig() {
    setIsCommandPending(true)
    try {
      if (saveTimerRef.current !== undefined) {
        window.clearTimeout(saveTimerRef.current)
        saveTimerRef.current = undefined
      }
      const resetConfigValue = await TaskUtils.resetTaskConfig()
      form.setFieldsValue(toFormValues(resetConfigValue))
      setUserInfoByIndex({})
      setConfigLoadError('')
      setIsConfigLoaded(true)
      message.success('已重置为新版任务配置')
    } catch (resetError) {
      message.error(`重置配置失败：${errorMessage(resetError)}`)
    } finally {
      setIsCommandPending(false)
    }
  }

  const currentBatch = taskDashboard.dashboard.batch
  const hasPreviousBatch = currentBatch !== null

  return (
    <div className="customer-task">
      <Modal
        title="任务配置读取失败"
        open={configLoadError !== ''}
        closable={false}
        footer={[
          <Button
            key="reset"
            danger
            disabled={taskDashboard.isActive || isCommandPending}
            loading={isCommandPending}
            onClick={() => void resetConfig()}
          >
            重置为新版配置
          </Button>,
        ]}
      >
        <p>旧版配置不再兼容。重置只会替换任务配置，不会删除微博数据、缓存或任务历史。</p>
        <pre>{configLoadError}</pre>
      </Modal>

      <Modal
        title="未登录"
        open={showLoginModal}
        okText="去登录"
        onOk={() => {
          setShowLoginModal(false)
          changeTabKey('login')
        }}
        onCancel={() => setShowLoginModal(false)}
      >
        <p>请先登录微博账号，再同步用户或启动备份。</p>
      </Modal>

      <Modal
        title="发现新版本"
        open={showUpgradeInfo}
        okText="更新"
        onOk={() => {
          setShowUpgradeInfo(false)
          void TaskUtils.jumpToUpgrade(remoteVersionConfig.downloadUrl)
        }}
        onCancel={() => setShowUpgradeInfo(false)}
      >
        <p>最新版本：{remoteVersionConfig.version}</p>
        <p>更新内容：{remoteVersionConfig.releaseNote}</p>
        <p>更新时间：{remoteVersionConfig.releaseAt}</p>
      </Modal>

      {taskDashboard.error && (
        <Alert className="task-alert" type="warning" showIcon title="任务状态暂时无法刷新" description={taskDashboard.error} />
      )}
      {taskDashboard.isActive && (
        <Alert
          className="task-alert"
          type="info"
          showIcon
          title="备份任务正在运行"
          description="运行期间配置、登录、重抓和缓存清理操作已锁定。关闭应用会中断当前执行，重启后可继续。"
          action={<Button onClick={() => changeTabKey('log')}>查看进度</Button>}
        />
      )}
      {!taskDashboard.isActive && currentBatch?.resumable && (
        <Alert
          className="task-alert"
          type="warning"
          showIcon
          title="发现未完成任务"
          description={`批次 ${currentBatch.batchId} 可以继续，已成功的页面会自动跳过。`}
        />
      )}

      <Form<CustomerTaskFormValues>
        form={form}
        disabled={taskDashboard.isActive || isCommandPending}
        labelCol={{ span: 5 }}
        wrapperCol={{ span: 17 }}
        initialValues={toFormValues(createDefaultConfig())}
        onValuesChange={(_, values) => scheduleSave(values)}
      >
        <Divider>备份用户</Divider>
        <Form.List name="configList">
          {(fields, { add, remove }) => (
            <Space orientation="vertical" size="middle" className="full-width">
              {fields.map((field, index) => {
                const userInfo = userInfoByIndex[index]
                const uid = watchedConfigList[index]?.uid
                return (
                  <Card
                    key={field.key}
                    size="small"
                    title={`用户 ${index + 1}`}
                    extra={fields.length > 1 ? (
                      <Button
                        danger
                        type="text"
                        icon={<DeleteOutlined />}
                        onClick={() => remove(field.name)}
                      >
                        删除
                      </Button>
                    ) : null}
                  >
                    <Form.Item
                      label="个人主页"
                      name={[field.name, 'rawInputText']}
                      rules={[{
                        validator: async (_, value: unknown) => {
                          const storedUid = form.getFieldValue(['configList', field.name, 'uid'])
                          if (
                            (typeof value === 'string' && value.trim() !== '') ||
                            (typeof storedUid === 'string' && /^\d{1,32}$/.test(storedUid))
                          ) {
                            return
                          }
                          throw new Error('请输入微博 UID 或个人主页地址')
                        },
                      }]}
                    >
                      <Input
                        placeholder="https://weibo.com/u/5390490281"
                        onChange={() => {
                          form.setFieldValue(['configList', field.name, 'uid'], '')
                          setUserInfoByIndex((current) => {
                            const next = { ...current }
                            delete next[index]
                            return next
                          })
                        }}
                      />
                    </Form.Item>
                    <Form.Item name={[field.name, 'uid']} hidden><Input /></Form.Item>
                    <Form.Item label="备注" name={[field.name, 'comment']}><Input /></Form.Item>
                    <Form.Item label="用户状态">
                      <Space wrap>
                        {userInfo ? (
                          <>
                            <Tag color="green">{userInfo.screen_name}</Tag>
                            <span>UID {uid}</span>
                            <span>{userInfo.statuses_count} 条微博</span>
                            <span>{userInfo.followers_count} 位粉丝</span>
                          </>
                        ) : uid ? <Tag color="blue">UID {uid}</Tag> : <Tag>待同步</Tag>}
                        <Button loading={syncingIndex === index} onClick={() => void syncUser(index)}>
                          同步用户信息
                        </Button>
                        <Button
                          danger
                          disabled={taskDashboard.isActive || !uid}
                          onClick={() => confirmClearCache(index)}
                        >
                          清除该用户接口缓存
                        </Button>
                      </Space>
                    </Form.Item>
                  </Card>
                )
              })}
              <Button
                type="dashed"
                block
                icon={<PlusOutlined />}
                onClick={() => add({ uid: '', rawInputText: '', comment: '' })}
              >
                添加备份用户
              </Button>
            </Space>
          )}
        </Form.List>

        <Divider>抓取配置</Divider>
        <Form.Item
          label="抓取日期范围"
          name="fetchDateRange"
          rules={[{ required: true, message: '请选择抓取日期范围' }]}
        >
          <RangePicker
            allowClear={false}
            disabledDate={(current) => current.startOf('day').isBefore(MIN_FETCH_DATE) || current.startOf('day').isAfter(shanghaiToday())}
          />
        </Form.Item>
        <Form.Item
          label={
            <span>
              请求最小间隔&nbsp;
              <Tooltip title="所有微博抓取 API 共用一个全局限流器；不得低于 10 秒。">
                <QuestionCircleOutlined />
              </Tooltip>
            </span>
          }
          name="requestIntervalSeconds"
          rules={[{ required: true, type: 'number', min: 10, message: '请求间隔不得低于 10 秒' }]}
        >
          <InputNumber min={10} max={3600} step={1} suffix="秒" />
        </Form.Item>
        <Form.Item
          label="接口缓存策略"
          name="cacheReadMode"
          tooltip="刷新模式不读取已有缓存，但成功请求仍会刷新符合缓存条件的响应。"
        >
          <Radio.Group optionType="button" buttonStyle="solid">
            <Radio.Button value="prefer-cache">优先使用缓存</Radio.Button>
            <Radio.Button value="refresh">忽略缓存并刷新</Radio.Button>
          </Radio.Group>
        </Form.Item>

        <Form.Item label="启动前粗略估算">
          <Descriptions bordered size="small" column={1}>
            <Descriptions.Item label="预计请求任务">{roughEstimate.requests} 个</Descriptions.Item>
            <Descriptions.Item label="已同步微博数">{roughEstimate.statuses} 条</Descriptions.Item>
            <Descriptions.Item label="预计总耗时">
              {formatDuration(roughEstimate.seconds)}
              <Typography.Text type="secondary">（按当前间隔及 1.5 倍余量估算，运行后会动态修正）</Typography.Text>
            </Descriptions.Item>
          </Descriptions>
        </Form.Item>

        <Collapse
          items={[{
            key: 'output-config',
            label: '输出规则',
            children: (
              <>
            <Form.Item label="电子书书名" name="bookTitle"><Input /></Form.Item>
            <Form.Item label="任务备注" name="comment"><Input /></Form.Item>
            <Form.Item label="只导出原创微博" name="isOnlyOriginal" valuePropName="checked"><Switch /></Form.Item>
            <Form.Item label="只导出微博文章" name="isOnlyArticle" valuePropName="checked"><Switch /></Form.Item>
            <Form.Item label="微博排序" name="postAtOrderBy">
              <Radio.Group optionType="button" buttonStyle="solid">
                <Radio.Button value="asc">由旧到新</Radio.Button>
                <Radio.Button value="desc">由新到旧</Radio.Button>
              </Radio.Group>
            </Form.Item>
            <Form.Item label="图片配置" name="imageQuilty">
              <Radio.Group optionType="button" buttonStyle="solid">
                <Radio.Button value={IMAGE_QUALITY.NONE}>无图</Radio.Button>
                <Radio.Button value={IMAGE_QUALITY.DEFAULT}>有图</Radio.Button>
              </Radio.Group>
            </Form.Item>
            <Form.Item
              label="输出时间范围"
              name="outputTimeRange"
              rules={[{ required: true, message: '请选择输出时间范围' }]}
            >
              <RangePicker allowClear={false} />
            </Form.Item>
            <Form.Item label="电子书拆分规则" name="volumeSplitBy">
              <Select
                options={[
                  { value: VOLUME_SPLIT_BY.SINGLE, label: '不拆分' },
                  { value: VOLUME_SPLIT_BY.YEAR, label: '按年拆分' },
                  { value: VOLUME_SPLIT_BY.MONTH, label: '按月拆分' },
                  { value: VOLUME_SPLIT_BY.COUNT, label: '按微博条数拆分' },
                ]}
              />
            </Form.Item>
            {watchedVolumeSplitBy === VOLUME_SPLIT_BY.COUNT && (
              <Form.Item label="单卷微博数" name="volumeSplitCount">
                <InputNumber min={1000} max={10000} step={1000} />
              </Form.Item>
            )}
              </>
            ),
          }]}
        />

        <Collapse
          items={[{
            key: 'develop-config',
            label: '[高级选项]开发调试',
            children: (
              <>
                <Form.Item label="跳过抓取" name="isSkipFetch" valuePropName="checked"><Switch /></Form.Item>
                <Form.Item label="跳过输出 PDF" name="isSkipGeneratePdf" valuePropName="checked"><Switch /></Form.Item>
                <Form.Item label="重新生成 PDF 图片" name="isRegenerateHtml2PdfImage" valuePropName="checked"><Switch /></Form.Item>
                <Collapse
                  items={[{
                    key: 'config-content',
                    label: '最终任务配置',
                    children: <pre>{JSON.stringify(previewConfig, null, 2)}</pre>,
                  }]}
                />
              </>
            ),
          }]}
        />
      </Form>

      <div className="task-actions">
        {taskDashboard.isActive ? (
          <Button type="primary" onClick={() => changeTabKey('log')}>查看任务进度</Button>
        ) : currentBatch?.resumable ? (
          <>
            <Button
              type="primary"
              disabled={isCommandPending}
              loading={isCommandPending}
              onClick={() => void continueTask()}
            >
              继续上次任务
            </Button>
            <Button disabled={isCommandPending} loading={isCommandPending} onClick={confirmRestart}>重新抓取</Button>
          </>
        ) : (
          <Button
            type="primary"
            loading={isCommandPending}
            disabled={isCommandPending || !isConfigLoaded || configLoadError !== ''}
            onClick={hasPreviousBatch ? confirmRestart : () => void startNewTask()}
          >
            {hasPreviousBatch ? '重新抓取' : '开始备份'}
          </Button>
        )}
        <Button onClick={() => void TaskUtils.openOutputDir()}>打开电子书所在目录</Button>
        <Button
          onClick={async () => {
            const remoteConfig = await TaskUtils.asyncCheckNeedUpdate()
            if (remoteConfig) {
              setRemoteVersionConfig(remoteConfig)
              setShowUpgradeInfo(true)
            } else {
              message.success('当前已是最新版本')
            }
          }}
        >
          检查更新
        </Button>
        <Button
          disabled={taskDashboard.isActive || isCommandPending}
          onClick={() => void TaskUtils.resetSession()}
        >
          退出当前登录账号
        </Button>
        <Button onClick={() => void TaskUtils.debugOpenDevTools()}>打开调试面板</Button>
        <Button
          icon={<ReloadOutlined />}
          disabled={taskDashboard.isActive || isCommandPending}
          loading={isCommandPending}
          onClick={() => {
            Modal.confirm({
              title: '重置任务配置？',
              content: '不会删除微博数据、缓存或任务历史。',
              okText: '重置',
              cancelText: '取消',
              onOk: resetConfig,
            })
          }}
        >
          重置配置
        </Button>
      </div>
    </div>
  )
}
