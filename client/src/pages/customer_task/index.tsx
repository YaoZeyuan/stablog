import React, { useEffect, useState } from 'react'
import produce from 'immer'
import {
  Form,
  Input,
  InputNumber,
  Button,
  Checkbox,
  Descriptions,
  Slider,
  Divider,
  Radio,
  DatePicker,
  Select,
  Switch,
  Modal,
  Tooltip,
  Collapse,
} from 'antd'
import { QuestionOutlined, QuestionCircleOutlined, InfoCircleOutlined } from '@ant-design/icons'
import './index.less'

import _ from 'lodash'
import dayjs from 'dayjs'
import http from '@/library/http'
import util from '@/library/util'
import querystring from 'query-string'
import packageConfig from '@/../../package.json'
import { TypeTaskConfig } from './task_type'
import * as TaskUtils from './utils'

let currentVersion = parseFloat(packageConfig.version)

let TaskConfigType = TypeTaskConfig

const electron = require('electron')
const shell = electron.shell
const ipcRenderer = electron.ipcRenderer

let pathConfigStr = ipcRenderer.sendSync('getPathConfig')
let pathConfig = JSON.parse(pathConfigStr)

const { RangePicker } = DatePicker
const { Option } = Select

type TypeState = {
  isLogin: boolean
  showLoginModel: boolean
  showUpgradeInfo: boolean
  remoteVersionConfig: {
    version: number
    downloadUrl: string
    releaseAt: string
    releaseNote: string
  }
}

type TypeDatabase = {
  taskConfig: TypeTaskConfig.Customer
  currentUserInfo: {
    screen_name: string
    statuses_count: number
    total_page_count: number
    followers_count: number
  }
  fetchErrorDistribution: {
    weibo_page: number
    long_text_weibo: number
    article: number
  }
}

const Order: {
  由旧到新: 'asc'
  由新到旧: 'desc'
} = {
  由旧到新: 'asc',
  由新到旧: 'desc',
}
const ImageQuilty = {
  无图: 'none',
  默认: 'default',
}

const Translate_Image_Quilty = {
  [TaskConfigType.CONST_Image_Quilty_默认]: '默认',
  [TaskConfigType.CONST_Image_Quilty_无图]: '无图',
}

const defaultConfigItem = {
  uid: '',
  rawInputText: '',
  comment: '',
}
const Const_Volume_Split_By: { [key: string]: string } = {
  ['不拆分']: 'single',
  ['年']: 'year',
  ['月']: 'month',
  ['微博条数']: 'count',
}

let taskConfig: TypeTaskConfig.Customer = {
  configList: [_.clone(defaultConfigItem)],
  imageQuilty: TaskConfigType.CONST_Image_Quilty_默认,
  maxBlogInBook: 100000,
  postAtOrderBy: TaskConfigType.CONST_Order_Asc,
  bookTitle: '',
  comment: '',
  volumeSplitBy: TaskConfigType.CONST_Volume_Split_By_不拆分,
  volumeSplitCount: 10000,
  fetchStartAtPageNo: 0,
  fetchEndAtPageNo: 100000,
  outputStartAtMs: dayjs('2010-01-01 00:00:00').unix() * 1000,
  outputEndAtMs: dayjs().add(1, 'year').unix() * 1000,
  enableAutoConfig: true,
  onlyRetry: false,
  isSkipFetch: false,
  isSkipGeneratePdf: false,
  isRegenerateHtml2PdfImage: false,
  isOnlyOriginal: false,
  isOnlyArticle: false,
}
if (taskConfig.configList.length === 0) {
  // 如果没有数据, 就要手工补上一个, 确保数据完整
  taskConfig.configList.push(_.clone(defaultConfigItem))
}

// 基于配置文件作为初始值
let jsonContent = util.getFileContent(pathConfig.customerTaskConfigUri)
try {
  taskConfig = JSON.parse(jsonContent)
} catch (e) {}
if (taskConfig.enableAutoConfig) {
  // 仅在启用自动生成配置时, 才自动重置输出时间

  // 输出时间始终重置为次日
  taskConfig.outputEndAtMs = dayjs().add(1, 'day').unix() * 1000
}
if (taskConfig.configList.length === 0) {
  taskConfig.configList.push(_.clone(defaultConfigItem))
}

export default function IndexPage(props: { changeTabKey: Function }) {
  const [form] = Form.useForm()
  const [$$status, set$$Status] = useState<TypeState>(
    produce(
      {
        isLogin: false,
        showLoginModel: false,
        showUpgradeInfo: false,
        remoteVersionConfig: {
          version: 1.0,
          downloadUrl: '',
          releaseAt: '',
          releaseNote: '',
        },
      },
      (e) => e,
    ),
  )
  const [$$database, set$$Database] = useState<TypeDatabase>(
    produce(
      {
        taskConfig: taskConfig,
        currentUserInfo: {
          screen_name: '',
          statuses_count: 0,
          total_page_count: 0,
          followers_count: 0,
        },
        fetchErrorDistribution: {
          article: 0,
          long_text_weibo: 0,
          weibo_page: 0,
        },
      },
      (e) => e,
    ),
  )
  // 每次database更新后, 重写 taskConfig 配置
  useEffect(() => {
    TaskUtils.saveConfig($$database.taskConfig)
  }, [$$database])

  // 初始化时检查是否已登录
  useEffect(() => {
    let a = async () => {
      await asyncCheckIsLogin()
      // 同步用户信息
      await asyncSyncUserInfo(false)
    }
    a()
  }, [])

  async function asyncCheckIsLogin() {
    let isLogin = await TaskUtils.asyncCheckIsLogin()
    if (isLogin !== true) {
      set$$Status(
        produce($$status, (raw) => {
          raw.isLogin = false
          raw.showLoginModel = true
        }),
      )
    } else {
      set$$Status(
        produce($$status, (raw) => {
          raw.isLogin = true
          raw.showLoginModel = false
        }),
      )
    }
    return isLogin
  }

  async function asyncSyncUserInfo(updatePageRange = false) {
    // 先检查是否登录
    let isLogin = await asyncCheckIsLogin()
    if (isLogin !== true) {
      return false
    }
    // 获取uid
    // let uid = $$database.taskConfig.configList[0].uid;
    let uid = await TaskUtils.asyncGetUid($$database.taskConfig.configList[0].rawInputText)
    console.log('uid =>', uid)
    if (uid === '') {
      return
    }
    // 然后更新用户信息
    let userInfo = await TaskUtils.asyncGetUserInfo(uid)
    if (userInfo.screen_name === '') {
      // 说明请求失败
      return
    }

    // 获取数据库中的抓取错误记录
    const errorDistributionList = await ipcRenderer.sendSync('MFetchErrorRecord_asyncGetErrorDistributionCount', {
      author_uid: uid,
    })
    set$$Database(
      produce($$database, (raw) => {
        // 更新错误数据分布
        for (let record of errorDistributionList) {
          switch (record.resource_type) {
            case 'weibo_page':
              raw.fetchErrorDistribution.weibo_page = record.count
              break
            case 'long_text_weibo':
              raw.fetchErrorDistribution.long_text_weibo = record.count
              break
            case 'article':
              raw.fetchErrorDistribution.article = record.count
              break
            default:
          }
        }

        raw.taskConfig.configList[0].uid = uid
        raw.currentUserInfo = userInfo
        if (updatePageRange) {
          // 当启动任务时, 不需要更新页面列表
          if (raw.taskConfig.enableAutoConfig) {
            // 仅在启用自动生成配置时, 才更新配置内容
            raw.taskConfig.fetchStartAtPageNo = 0
            raw.taskConfig.fetchEndAtPageNo = userInfo?.total_page_count || 1000
          }
        }
        form.setFieldsValue({
          fetchEndAtPageNo: raw.taskConfig.fetchEndAtPageNo,
          fetchStartAtPageNo: 0,
          fetchPageNoRange: [0, raw.taskConfig.fetchEndAtPageNo],
        })
      }),
    )
    return true
  }

  let initValue = {
    ...$$database.taskConfig,
    rawInputText: $$database.taskConfig.configList[0].rawInputText,
    fetchPageNoRange: [$$database.taskConfig.fetchStartAtPageNo, $$database.taskConfig.fetchEndAtPageNo],
    outputTimeRange: [
      dayjs.unix($$database.taskConfig.outputStartAtMs / 1000),
      dayjs.unix($$database.taskConfig.outputEndAtMs / 1000),
    ],
  }

  console.log('initValue =>', initValue)

  // 总需要生成的微博数量
  let needGenerateWeiboCount = $$database?.currentUserInfo?.statuses_count || 0

  // 总需要备份的微博页数
  let needBackupWeiboPageCount = $$database?.currentUserInfo?.statuses_count || 0
  needBackupWeiboPageCount = $$database?.taskConfig.fetchEndAtPageNo - $$database?.taskConfig.fetchStartAtPageNo
  if ($$database.taskConfig.isSkipFetch) {
    needBackupWeiboPageCount = 0
  }
  if ($$database.taskConfig.isSkipGeneratePdf) {
    needGenerateWeiboCount = 0
  }
  console.log('needBackupWeiboPageCount => ', needBackupWeiboPageCount)
  // 总需要等待的时长(秒)
  let needWaitSecond = needBackupWeiboPageCount * 30 + needGenerateWeiboCount * 2
  let 备份微博耗时_分钟 = Math.floor((needBackupWeiboPageCount * 30) / 60)
  let 导出微博耗时_分钟 = Math.floor((needGenerateWeiboCount * 2) / 60)
  let needWaitMinute = Math.floor(needWaitSecond / 60)
  let needWaitHour = Math.round((needWaitSecond / 60 / 60) * 100) / 100

  return (
    <div className="customer-task">
      <Modal
        title="发现新版本"
        visible={$$status.showUpgradeInfo}
        onOk={() => {
          set$$Status(
            produce($$status, (raw) => {
              raw.showUpgradeInfo = false
            }),
          )
          TaskUtils.jumpToUpgrade($$status.remoteVersionConfig.downloadUrl)
        }}
        okText="更新"
        onCancel={() => {
          set$$Status(
            produce($$status, (raw) => {
              raw.showUpgradeInfo = false
            }),
          )
        }}
      >
        <p>最新版本:{$$status.remoteVersionConfig.version}</p>
        <p>更新内容:{$$status.remoteVersionConfig.releaseNote}</p>
        <p>更新时间:{$$status.remoteVersionConfig.releaseAt}</p>
      </Modal>
      <Modal
        title="未登录"
        visible={$$status.showLoginModel}
        onOk={() => {
          set$$Status(
            produce($$status, (raw) => {
              raw.showLoginModel = false
            }),
          )
          props.changeTabKey('login')
        }}
        onCancel={() => {
          set$$Status(
            produce($$status, (raw) => {
              raw.showLoginModel = false
            }),
          )
        }}
        okText="去登录"
      >
        <p>检查到尚未登录, 请先登录微博账号</p>
      </Modal>
      <Form
        labelCol={{ span: 4 }}
        wrapperCol={{ span: 16 }}
        name="basic"
        form={form}
        onValuesChange={(changedValues, values) => {
          set$$Database(
            produce($$database, (raw: TypeDatabase) => {
              let updateKey = Object.keys(changedValues)[0]
              switch (updateKey) {
                case 'rawInputText':
                  let rawInput = changedValues['rawInputText']
                  // 先记录数据, 待点击同步按钮后再更新uid信息
                  raw.taskConfig.configList[0].rawInputText = rawInput
                  raw.taskConfig.configList[0].uid = ''
                  raw.taskConfig.configList[0].comment = ''
                  break
                case 'fetchPageNoRange':
                  raw.taskConfig['fetchStartAtPageNo'] = changedValues[updateKey][0]
                  raw.taskConfig['fetchEndAtPageNo'] = changedValues[updateKey][1]
                  break
                case 'outputTimeRange':
                  raw.taskConfig['outputStartAtMs'] = changedValues[updateKey][0].unix() * 1000
                  raw.taskConfig['outputEndAtMs'] = changedValues[updateKey][1].unix() * 1000
                  break
                case 'volumeSplitBy':
                  raw.taskConfig['volumeSplitBy'] = changedValues['volumeSplitBy']
                  break
                default:
                  raw.taskConfig[updateKey] = changedValues[updateKey]
              }
            }),
          )
        }}
        initialValues={initValue}
      >
        <Form.Item
          label={
            <span>
              个人主页&nbsp;
              <Tooltip title="在浏览器中进入用户首页, 将链接粘贴至此处. 主页地址类似于:https://weibo.com/u/5659598386 或 https://weibo.com/n/八大山债人 或 https://m.weibo.cn/u/5659598386 或 https://m.weibo.cn/profile/2291429207">
                <QuestionCircleOutlined />
              </Tooltip>
            </span>
          }
        >
          <div className="flex-container">
            <Form.Item name="rawInputText" className="flex-container-item-w100">
              <Input placeholder="请输入用户个人主页url.示例:https://weibo.com/u/5390490281" />
            </Form.Item>
            <Button
              onClick={() => {
                asyncSyncUserInfo(true)
              }}
            >
              同步用户信息
            </Button>
          </div>
        </Form.Item>

        <Form.Item label="用户信息">
          {$$database.currentUserInfo.screen_name === '' ? (
            '数据待同步'
          ) : (
            <Descriptions bordered column={1}>
              <Descriptions.Item label="用户名">{$$database.currentUserInfo.screen_name}</Descriptions.Item>
              <Descriptions.Item label="微博总数">{$$database.currentUserInfo.statuses_count}</Descriptions.Item>
              <Descriptions.Item label="微博总页面数">{$$database.currentUserInfo.total_page_count}</Descriptions.Item>
              <Descriptions.Item label="待抓取页面范围[从0开始计数]">
                从{$$database.taskConfig.fetchStartAtPageNo}~{$$database.taskConfig.fetchEndAtPageNo}页, 共
                {$$database.taskConfig.fetchEndAtPageNo - $$database.taskConfig.fetchStartAtPageNo + 1}页
              </Descriptions.Item>
              <Descriptions.Item
                label={
                  <span>
                    预计耗时&nbsp;
                    <Tooltip title="计算公式:总耗时=(待抓取微博总数/10 * 30 + 微博总数 * 2)秒. 每10条微博一页, 抓取一页微博数据需要间隔30s. 抓取完成, 生成pdf时, 每条微博需要用2s将其渲染为图片. 故有此公式">
                      <QuestionCircleOutlined />
                    </Tooltip>
                  </span>
                }
              >
                预计累计耗时{needWaitMinute}分钟 / {needWaitHour}小时
              </Descriptions.Item>
              <Descriptions.Item label={<span>- 抓取耗时&nbsp;</span>}>
                {$$database.taskConfig.isSkipFetch
                  ? `已勾选跳过抓取流程选项, 不需要执行抓取, 耗时为0`
                  : `预计共需备份${needBackupWeiboPageCount}张页面, 耗时${备份微博耗时_分钟}分钟`}
              </Descriptions.Item>
              <Descriptions.Item label={<span>- 输出pdf耗时&nbsp;</span>}>
                {$$database.taskConfig.isSkipGeneratePdf
                  ? '已勾选跳过pdf输出选项, 不需要渲染pdf, 耗时为0'
                  : `预计共需渲染${needGenerateWeiboCount}条微博, 耗时${导出微博耗时_分钟}分钟`}
              </Descriptions.Item>
              <Descriptions.Item label="粉丝数">{$$database.currentUserInfo.followers_count}</Descriptions.Item>
            </Descriptions>
          )}
        </Form.Item>
        <Form.Item label="待重试记录数">
          <div className="flex-container">
            <Descriptions bordered column={1}>
              <Descriptions.Item label="微博页面">{$$database.fetchErrorDistribution.weibo_page}页</Descriptions.Item>
              <Descriptions.Item label="长微博">
                {$$database.fetchErrorDistribution.long_text_weibo}条
              </Descriptions.Item>
              <Descriptions.Item label="微博文章">{$$database.fetchErrorDistribution.article}篇</Descriptions.Item>
            </Descriptions>
          </div>
        </Form.Item>
        <Form.Item label="ℹ️Tip">
          <div className="flex-container">
            若频繁提示抓取失败, 请重新点击下方`退出当前账号`按钮后重登, 或者6小时后再来即可
          </div>
        </Form.Item>
        <Divider>备份配置</Divider>

        <Form.Item
          label={
            <span>
              备份范围&nbsp;
              <Tooltip title="可通过配置备份页面范围, 实现断点续传/只备份指定范围内的微博">
                <QuestionCircleOutlined />
              </Tooltip>
            </span>
          }
        >
          <div className="flex-container">
            <span>从第&nbsp;</span>
            <Form.Item name="fetchStartAtPageNo" noStyle>
              <InputNumber step={1} min={0} />
            </Form.Item>
            <span>&nbsp;页备份到第&nbsp;</span>
            <Form.Item name="fetchEndAtPageNo" noStyle>
              <InputNumber step={1} max={$$database.currentUserInfo.total_page_count || 0} />
            </Form.Item>
            <span>&nbsp;页&nbsp;</span>
          </div>
        </Form.Item>
        <Form.Item
          label={
            <span>
              仅重试失败记录&nbsp;
              <Tooltip title="跳过全量抓取, 只对之前抓取失败的页面记录进行重试. 重试成功后自动删除对应记录(正常抓取完成后, 默认重试失败页面, 不需要专门勾选. 如果本身没有失败记录, 相当于跳过抓取流程)">
                <QuestionCircleOutlined />
              </Tooltip>
            </span>
          }
          name="onlyRetry"
          valuePropName="checked"
        >
          <Switch></Switch>
        </Form.Item>

        <Collapse>
          <Collapse.Panel header="[高级选项]输出规则" key="output-config">
            <Form.Item
              label={
                <span>
                  只导出原创微博&nbsp;
                  <Tooltip title="只导出原创微博, 跳过转发的微博">
                    <QuestionCircleOutlined />
                  </Tooltip>
                </span>
              }
              name="isOnlyOriginal"
              valuePropName="checked"
            >
              <Switch></Switch>
            </Form.Item>
            <Form.Item
              label={
                <span>
                  只导出微博文章&nbsp;
                  <Tooltip title="只导出原创的微博文章">
                    <QuestionCircleOutlined />
                  </Tooltip>
                </span>
              }
              name="isOnlyArticle"
              valuePropName="checked"
            >
              <Switch></Switch>
            </Form.Item>
            <Form.Item label="微博排序" name="postAtOrderBy">
              <Radio.Group buttonStyle="solid">
                <Radio.Button value={Order.由旧到新}>由旧到新</Radio.Button>
                <Radio.Button value={Order.由新到旧}>由新到旧</Radio.Button>
              </Radio.Group>
            </Form.Item>
            <Form.Item label="图片配置" name="imageQuilty">
              <Radio.Group buttonStyle="solid">
                <Radio.Button value={ImageQuilty.无图}>无图</Radio.Button>
                <Radio.Button value={ImageQuilty.默认}>有图</Radio.Button>
              </Radio.Group>
            </Form.Item>
            <Form.Item label="时间范围">
              <div className="flex-container">
                <span>只输出从</span>
                &nbsp;
                <Form.Item name="outputTimeRange" noStyle>
                  <RangePicker picker="date" />
                </Form.Item>
                &nbsp;
                <span>间发布的微博</span>
              </div>
            </Form.Item>

            <Form.Item label="电子书拆分规则">
              <div className="flex-container">
                <Form.Item name="volumeSplitBy" noStyle>
                  <Select labelInValue={false} style={{ width: 180 }}>
                    <Option value={Const_Volume_Split_By.不拆分}>不拆分</Option>
                    <Option value={Const_Volume_Split_By.年}>按年拆分</Option>
                    <Option value={Const_Volume_Split_By.月}>按月拆分</Option>
                    <Option value={Const_Volume_Split_By.微博条数}>按微博条数拆分</Option>
                  </Select>
                </Form.Item>
                {$$database.taskConfig.volumeSplitBy === Const_Volume_Split_By.微博条数 ? (
                  <span>, 每&nbsp;</span>
                ) : null}
                {$$database.taskConfig.volumeSplitBy === Const_Volume_Split_By.微博条数 ? (
                  <Form.Item name="volumeSplitCount" noStyle>
                    <InputNumber
                      // placeholder="每n条微博拆分为一卷"
                      min={1000}
                      step={1000}
                      // 每本电子书最多只能有10000条微博
                      max={10000}
                      style={{ width: 120 }}
                    ></InputNumber>
                  </Form.Item>
                ) : null}
                {$$database.taskConfig.volumeSplitBy === Const_Volume_Split_By.微博条数 ? (
                  <span>&nbsp;条微博一卷</span>
                ) : null}
              </div>
            </Form.Item>
          </Collapse.Panel>
        </Collapse>

        <Collapse>
          <Collapse.Panel header="[高级选项]开发调试" key="develop-config">
            <Form.Item
              label={
                <span>
                  自动更新抓取/导出范围&nbsp;
                  <Tooltip title="自动更新抓取范围和导出范围,默认启用,仅在调试时推荐关闭">
                    <QuestionCircleOutlined />
                  </Tooltip>
                </span>
              }
              name="enableAutoConfig"
              valuePropName="checked"
            >
              <Switch></Switch>
            </Form.Item>

            <Form.Item
              label={
                <span>
                  跳过抓取&nbsp;
                  <Tooltip title="若之前已抓取, 数据库中已有记录, 可以跳过抓取流程, 直接输出">
                    <QuestionCircleOutlined />
                  </Tooltip>
                </span>
              }
              name="isSkipFetch"
              valuePropName="checked"
            >
              <Switch></Switch>
            </Form.Item>
            <Form.Item
              label={
                <span>
                  跳过输出pdf&nbsp;
                  <Tooltip title="pdf文件输出时需要将每一条微博渲染为图片, 速度较慢, 关闭该选项可以加快输出速度, 便于调试">
                    <QuestionCircleOutlined />
                  </Tooltip>
                </span>
              }
              name="isSkipGeneratePdf"
              valuePropName="checked"
            >
              <Switch></Switch>
            </Form.Item>
            <Form.Item
              label={
                <span>
                  生成pdf时重新渲染&nbsp;
                  <Tooltip title="生成pdf需要先将每条微博渲染为图片, 时间较慢(1s/条).因此启用了缓存.若微博之前被渲染过, 则会利用已经渲染好的图片, 以加快生成速度. 如果旧渲染图片有误, 可以直接删除缓存中的该张图片. 不建议勾选此项">
                    <QuestionCircleOutlined />
                  </Tooltip>
                </span>
              }
              name="isRegenerateHtml2PdfImage"
              valuePropName="checked"
            >
              <Switch></Switch>
            </Form.Item>
            <Collapse>
              <Collapse.Panel header="最终生成配置内容" key="config-content">
                <div>
                  <pre>{JSON.stringify($$database.taskConfig, null, 4)}</pre>
                </div>
              </Collapse.Panel>
            </Collapse>
          </Collapse.Panel>
        </Collapse>
        <p>&nbsp;</p>

        <Form.Item label={' '} colon={false}>
          <Button
            onClick={async () => {
              // 先同步信息(期间会检查登录状态)
              let isSyncSuccess = await asyncSyncUserInfo(false)
              if (isSyncSuccess !== true) {
                return false
              }
              // 保存日志
              TaskUtils.saveConfig($$database.taskConfig)
              // 然后将tab切换到日志栏
              props.changeTabKey('log')
              // 启动任务进程
              TaskUtils.startBackupTask()
            }}
            type="primary"
          >
            开始备份
          </Button>
          &nbsp;
          <Button onClick={TaskUtils.openOutputDir}>打开电子书所在目录</Button>
          &nbsp;
          <Button
            onClick={async () => {
              let remoteConfig = await TaskUtils.asyncCheckNeedUpdate()
              if (remoteConfig === false) {
                return
              }
              set$$Status(
                produce($$status, (raw) => {
                  raw.showUpgradeInfo = true
                  raw.remoteVersionConfig = remoteConfig
                }),
              )
            }}
          >
            检查更新
          </Button>
          <Button onClick={TaskUtils.resetSession}>退出当前登录账号</Button>
          <Button onClick={TaskUtils.debugOpenDevTools}>打开调试面板</Button>
        </Form.Item>
      </Form>
    </div>
  )
}
