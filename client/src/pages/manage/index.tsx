import './index.less'
import TypeWeibo from '@/../../src/type/namespace/weibo'
import { useState, useEffect } from 'react'
import { enableMapSet } from 'immer'
enableMapSet()
import produce from 'immer'
import { Table, Card, Select, Button } from 'antd'
import { PlusCircleOutlined } from '@ant-design/icons'
import Util from '@/library/util'
import dayjs from 'dayjs'
import path from 'path'

let Option = Select.Option
const electron = require('electron')
let shell = electron.shell
let ipcRenderer = electron.ipcRenderer

type BlogDistributionItem = {
  date: string
  key: string
  type: 'year' | 'month' | 'day'
  startAt: number
  count: number
  childrenMap: BlogDistributionObj
}

type BlogDistributionObj = { [key: string]: BlogDistributionItem }

const Const_Default_Storage_Select: {
  year: string
  month: string
  day: string
  yearList: string[]
  monthList: string[]
  blogList: TypeWeibo.TypeMblog[]
} = {
  year: '',
  month: '',
  day: '',
  yearList: [],
  monthList: [],
  blogList: [],
}

export default function IndexPage() {
  let [$$userDatabase, set$$UserDatabase] = useState<Map<string, TypeWeibo.TypeWeiboUserInfo>>(
    produce(new Map(), (raw) => raw),
  )
  let [blogDistributionObj, setBlogDistributionObj] = useState<BlogDistributionObj>({})

  let [isLoading, setIsLoading] = useState<boolean>(false)
  let [selectUserId, setSelectUserId] = useState<string>('')
  let [selectWeiboListPageNo, setSelectWeiboListPageNo] = useState<number>(1)
  let [selectDateListPageNo, setSelectDateListPageNo] = useState<number>(1)

  let [$$storageSelect, set$$StorageSelect] = useState<{
    year: string
    month: string
    day: string
    yearList: string[]
    monthList: string[]
    blogList: TypeWeibo.TypeMblog[]
  }>(produce(Const_Default_Storage_Select, (raw) => raw))

  /**
   * 获取用户信息列表
   */
  async function asyncFetchUserInfoList() {
    let userInfoList: TypeWeibo.TypeWeiboUserInfo[] = await ipcRenderer.sendSync('MUser_asyncGetUserList')
    for (let record of userInfoList) {
      set$$UserDatabase(($$oldDatabase) => {
        return produce($$oldDatabase, (raw) => {
          raw.set(`${record.id}`, record)
        })
      })
    }
  }
  async function asyncGetDistribute() {
    setIsLoading(true)
    let distributionObj: BlogDistributionObj = await ipcRenderer.sendSync('MBlog_asyncGetWeiboDistribution', [
      selectUserId,
    ])
    setIsLoading(false)
    setBlogDistributionObj(distributionObj)

    set$$StorageSelect(
      produce(Const_Default_Storage_Select, (raw) => {
        raw.yearList = Object.keys(distributionObj)
      }),
    )
  }

  /**
   * 获取当天微博数据列表
   */
  async function asyncGetBlogListInRange(startAt: number, endAt: number) {
    let blogList = (await ipcRenderer.sendSync('MBlog_asyncGetMblogList', [
      selectUserId,
      startAt,
      endAt,
    ])) as TypeWeibo.TypeMblog[]
    return blogList
  }

  // 支持点选
  async function asyncHandleStorageSelectInTable(selectDate: string, type: 'year' | 'month' | 'day') {
    if (type === 'year') {
      let rowItem = blogDistributionObj[selectDate]

      set$$StorageSelect(($$storageSelect) => {
        return produce($$storageSelect, (raw) => {
          raw.year = rowItem.date
          let rawMonthItemList: BlogDistributionItem[] = []
          for (let key of Object.keys(rowItem.childrenMap)) {
            rawMonthItemList.push(rowItem.childrenMap[key])
          }
          rawMonthItemList.sort((a: BlogDistributionItem, b: BlogDistributionItem) => {
            // 从object中取出的数据顺序是乱的, 手工排序一下
            return a.startAt - b.startAt
          })
          raw.monthList = rawMonthItemList.map((item) => item.date)
          raw.month = ''
          raw.blogList = []
        })
      })
    }
    if (type === 'month') {
      let rowItem = blogDistributionObj[$$storageSelect.year].childrenMap[selectDate]

      set$$StorageSelect(($$storageSelect) => {
        return produce($$storageSelect, (raw) => {
          raw.month = rowItem.date
          raw.blogList = []
        })
      })
    }
    if (type === 'day') {
      let row = blogDistributionObj[$$storageSelect.year].childrenMap[$$storageSelect.month].childrenMap[selectDate]

      let startAt = row.startAt
      let endAt = row.startAt + 86400 - 1
      let blogList = await asyncGetBlogListInRange(startAt, endAt)
      set$$StorageSelect(($$storageSelect) => {
        return produce($$storageSelect, (raw) => {
          raw.day = row.date
          raw.blogList = blogList
        })
      })
    }
  }

  /**
   * 重置选择
   */
  function resetSelect() {
    setSelectDateListPageNo(1)
    setSelectWeiboListPageNo(1)
    set$$StorageSelect(() => {
      return produce(Const_Default_Storage_Select, (raw) => raw)
    })
  }

  /**
   * 重置选择数据
   */
  async function asyncRefreshData() {
    set$$UserDatabase(produce(new Map(), (raw) => raw))
    setBlogDistributionObj({})
    set$$StorageSelect(produce(Const_Default_Storage_Select, (raw) => raw))
    setSelectUserId('')
    setSelectDateListPageNo(1)
    setSelectWeiboListPageNo(1)
    setIsLoading(false)
    await asyncFetchUserInfoList()
  }

  /**
   * 导出数据
   */
  async function asyncDataTransferExport(config: {
    screen_name: string
    exportUri: string
    uid: string
    exportStartAt: number
    exportEndAt: number
  }) {
    let currentUserInfo = $$userDatabase.get(selectUserId)

    let exportStartAtStr = dayjs.unix(exportStartAt).format('YYYY-MM')
    let exportEndAtStr = dayjs.unix(exportEndAt).format('YYYY-MM')
    let exportRangeStr = `从${exportStartAtStr}到${exportEndAtStr}`

    let saveUri = await ipcRenderer.sendSync('Dialog_showSaveDialogSync', {
      title: '文件保存地址',
      filters: [
        {
          // name: `稳部落导出的用户_${config.screen_name}_微博记录`,
          name: `稳部落数据导出`,
          extensions: ['json'],
        },
      ],
      defaultPath: `${currentUserInfo?.screen_name || ''}-${exportRangeStr}-v1.0.0-稳部落数据导出记录`,
    })
    if (!config.uid || !saveUri) {
      // 没有uid, 无法导出
      return
    }
    let finalConfig = {
      uid: config.uid,
      exportStartAt: config.exportStartAt,
      exportEndAt: config.exportEndAt,
      exportUri: path.resolve(saveUri),
    }
    setIsLoading(true)
    await Util.asyncSleepMs(500)
    ipcRenderer.sendSync('dataTransferExport', finalConfig)
    setIsLoading(false)
  }

  /**
   * 导入数据
   */
  async function asyncDataTransferImport() {
    let importUriList = ipcRenderer.sendSync('Dialog_showOpenDialogSync', {
      title: '选择导入文件',
      filters: [
        {
          // name: `稳部落导出的用户_${config.screen_name}_微博记录`,
          name: `稳部落数据导出`,
          extensions: ['json'],
        },
      ],
      defaultPath: `${currentUserInfo?.screen_name || ''}-v1.0.0-稳部落数据导出记录`,
    })
    let importUri = importUriList?.[0]
    console.log('importUri => ', importUri)
    if (!importUri) {
      // 没有uid, 无法导出
      return
    }
    let finalConfig = {
      importUri: importUri,
    }
    setIsLoading(true)
    await Util.asyncSleepMs(500)
    ipcRenderer.sendSync('dataTransferImport', finalConfig)
    await asyncRefreshData()
    setIsLoading(false)
  }

  useEffect(() => {
    asyncFetchUserInfoList()
  }, [])

  useEffect(() => {
    if ($$userDatabase.has(selectUserId)) {
      asyncGetDistribute()
      resetSelect()
    }
  }, [selectUserId])

  let userInfoList: TypeWeibo.TypeWeiboUserInfo[] = []
  for (let key of $$userDatabase.keys()) {
    let record = $$userDatabase.get(key)
    userInfoList.push({
      ...record,
      // @ts-ignore
      key: `${key}`,
    })
  }

  let currentUserInfo = $$userDatabase.get(selectUserId)

  let yearOptionEleList = $$storageSelect.yearList.map((item, index) => {
    return (
      <Option value={item} key={index}>
        {item}
      </Option>
    )
  })
  let yearSelectEle = (
    <Select
      className="year-select"
      value={$$storageSelect.year}
      onSelect={(selectDate: string) => {
        asyncHandleStorageSelectInTable(selectDate, 'year')
      }}
    >
      {yearOptionEleList}
    </Select>
  )
  let monthOptionEleList = $$storageSelect.monthList.map((item, index) => {
    return (
      <Option value={item} key={index}>
        {item}
      </Option>
    )
  })
  let monthSelectEle = (
    <Select
      className="month-select"
      value={$$storageSelect.month}
      onSelect={(selectDate: string) => {
        asyncHandleStorageSelectInTable(selectDate, 'month')
      }}
    >
      {monthOptionEleList}
    </Select>
  )

  function getSummaryList() {
    if (Object.keys(blogDistributionObj).length === 0) {
      return []
    }
    const { year, month } = $$storageSelect
    let summaryList: BlogDistributionItem[] = []
    if (year === '') {
      // 按年展示
      Object.keys(blogDistributionObj).forEach((year_str) => {
        let item = blogDistributionObj[year_str]
        summaryList.push({
          ...item,
          key: `${item.date}`,
        })
      })
      return summaryList
    }
    if (month === '') {
      // 按月展示
      let yearDistributionObj = blogDistributionObj[year]['childrenMap']
      Object.keys(yearDistributionObj).forEach((month_str) => {
        let item = yearDistributionObj[month_str]
        summaryList.push({
          ...item,
          key: `${item.date}`,
        })
      })
      return summaryList
    }
    // 按天展示
    let monthDistributionObj = blogDistributionObj[year]['childrenMap'][month]['childrenMap']
    Object.keys(monthDistributionObj).forEach((day_str) => {
      let item = monthDistributionObj[day_str]
      summaryList.push({
        ...item,
        key: `${item.date}`,
      })
    })
    return summaryList
  }

  let rawSummaryList = getSummaryList()
  rawSummaryList.sort((a, b) => {
    // 从object中取出的数据顺序是乱的, 手工排序一下
    return a.startAt - b.startAt
  })
  let weiboStorageSummaryList = rawSummaryList

  let blogListEle = null
  if ($$storageSelect.blogList.length > 0) {
    blogListEle = (
      <Card
        title={`${$$userDatabase.get(selectUserId)?.screen_name} 在${$$storageSelect.year}${$$storageSelect.month}${
          $$storageSelect.day
        }发布的微博列表`}
      >
        <Table
          pagination={{
            onChange: (page) => {
              setSelectWeiboListPageNo(page)
            },
            current: selectWeiboListPageNo,
          }}
          dataSource={$$storageSelect.blogList}
          rowKey={(item) => item.id}
          columns={[
            {
              title: '发布时间',
              width: '120px',
              render: (record) => {
                return (
                  <span title={'微博id:' + record.id} key={record.id}>
                    {dayjs.unix(record.created_timestamp_at).format('YYYY-MM-DD HH:mm:ss')}
                  </span>
                )
              },
            },
            {
              title: '发布内容',
              render: (record: TypeWeibo.TypeMblog) => {
                let picEleList = []
                let picList = record?.pics || []
                for (let picItem of picList) {
                  picEleList.push(<img key={picItem.pid} src={picItem.url} />)
                }
                let retweetedEle = null
                if (record.retweeted_status) {
                  let picEleList = []
                  let picList = record?.retweeted_status?.pics || []
                  for (let picItem of picList) {
                    picEleList.push(<img key={picItem.pid} src={picItem.url} />)
                  }
                  retweetedEle = (
                    <div className="weibo-repost-item" v-if="scope.row.retweeted_status">
                      <hr />
                      <div
                        className="weibo-text"
                        dangerouslySetInnerHTML={{
                          __html: record.retweeted_status.raw_text || record.retweeted_status.text,
                        }}
                      />
                      <div className="weibo-img-list">{picEleList}</div>
                    </div>
                  )
                }

                return (
                  <div className="weibo" key={record.id}>
                    <div className="weibo-raw-item">
                      <div
                        className="weibo-text"
                        dangerouslySetInnerHTML={{
                          __html: record.raw_text || record.text,
                        }}
                      />
                      <div className="weibo-img-list">
                        <div>{picEleList}</div>
                      </div>
                      {retweetedEle}
                    </div>
                  </div>
                )
              },
            },
          ]}
        ></Table>
      </Card>
    )
  }

  let uid = selectUserId
  let exportUri = ''

  // 用于临时计算当前用户微博列表的起止月份
  const bufWeiboDateList = []
  for (let yearItem of rawSummaryList) {
    for (let monthKey of Object.keys(yearItem.childrenMap)) {
      bufWeiboDateList.push({
        dateStr: `${yearItem.date}-${monthKey}`,
        value: yearItem.childrenMap[monthKey].startAt,
      })
    }
  }
  bufWeiboDateList.sort((a, b) => a.value - b.value)

  // 以此作为导出时文件名
  let exportStartAt = bufWeiboDateList[0]?.value ?? dayjs('2009-01-01 00:00:00').unix()
  let exportEndAt = bufWeiboDateList[bufWeiboDateList.length - 1]?.value ?? dayjs().unix()
  if ($$storageSelect.year) {
    if ($$storageSelect.month) {
      exportStartAt = dayjs(`${$$storageSelect.year}-${$$storageSelect.month}`, 'YYYY年-MM月').startOf('month').unix()
      exportEndAt = dayjs(`${$$storageSelect.year}-${$$storageSelect.month}`, 'YYYY年-MM月').endOf('month').unix()
    } else {
      exportStartAt = dayjs($$storageSelect.year, 'YYYY年').startOf('year').unix()
      exportEndAt = dayjs($$storageSelect.year, 'YYYY年').endOf('year').unix()
    }
  }

  let exportTip = `导出微博记录`
  if (currentUserInfo?.screen_name) {
    if ($$storageSelect.year) {
      if ($$storageSelect.month) {
        exportTip = `导出${currentUserInfo?.screen_name}在${$$storageSelect.year}-${$$storageSelect.month}的所有微博记录`
      } else {
        exportTip = `导出${currentUserInfo?.screen_name}在${$$storageSelect.year}的所有微博记录`
      }
    } else {
      exportTip = `导出${currentUserInfo?.screen_name}的所有微博记录`
    }
  }

  // 生成导出配置
  let exportConfig = {
    screen_name: currentUserInfo?.screen_name || '',
    exportUri,
    uid,
    exportStartAt: exportStartAt,
    exportEndAt: exportEndAt,
  }
  console.log('exportConfig => ', exportConfig)

  return (
    <div className="manager-container">
      <Card
        title={
          <Button
            type="primary"
            onClick={() => {
              asyncDataTransferImport()
            }}
          >
            <PlusCircleOutlined></PlusCircleOutlined>数据导入
          </Button>
        }
      >
        <Table
          loading={isLoading}
          onRow={(record) => {
            return {
              onClick: () => {
                setSelectUserId(`${record.id}`)
              },
            }
          }}
          rowSelection={{
            checkStrictly: false,
            selectedRowKeys: [selectUserId],
            type: 'radio',
          }}
          rowKey={(item) => {
            return `${item.id}`
          }}
          columns={[
            {
              title: '已缓存账号',
              dataIndex: 'screen_name',
              render: (text, record: TypeWeibo.TypeWeiboUserInfo, index) => {
                return (
                  <div className="user-info" key={record.id}>
                    <img alt={record.screen_name} src={record.avatar_hd} className="avatar" />
                    <div className="name">{record.screen_name}</div>
                    <div className="id">({record.id})</div>
                  </div>
                )
              },
            },
            {
              title: '已保存微博条数',
              dataIndex: 'mblog_save_count',
              key: 'mblog_save_count',
            },
            {
              title: '个人简介',
              dataIndex: 'description',
              key: 'description',
            },
          ]}
          dataSource={userInfoList}
          pagination={false}
        ></Table>
      </Card>
      <Card title={currentUserInfo?.screen_name ? `${currentUserInfo?.screen_name} 已完成备份的微博列表` : ''}>
        {yearSelectEle}
        &nbsp;
        {monthSelectEle}
        &nbsp;
        <Button
          color="primary"
          variant="dashed"
          disabled={selectUserId === ''}
          onClick={() => {
            asyncDataTransferExport(exportConfig)
          }}
        >
          {exportTip}
        </Button>
        &nbsp;
        <Button
          type="default"
          onClick={() => {
            resetSelect()
          }}
        >
          重选
        </Button>
        &nbsp;
        <Button
          type="primary"
          onClick={() => {
            asyncRefreshData()
          }}
        >
          刷新数据
        </Button>
        &nbsp;
        <Table
          pagination={{
            onChange: (page) => {
              setSelectDateListPageNo(page)
            },
            current: selectDateListPageNo,
          }}
          loading={isLoading}
          rowSelection={{
            selectedRowKeys: [$$storageSelect.day],
            type: 'radio',
          }}
          dataSource={weiboStorageSummaryList}
          columns={[
            {
              title: '日期',
              dataIndex: 'date',
              key: 'date',
            },
            {
              title: '微博数量',
              dataIndex: 'count',
              key: 'count',
            },
          ]}
          onRow={(record, index) => {
            return {
              onClick: () => {
                let selectType = record.type
                switch (selectType) {
                  case 'year':
                    asyncHandleStorageSelectInTable(record.date, 'year')
                    break
                  case 'month':
                    asyncHandleStorageSelectInTable(record.date, 'month')
                    break
                  case 'day':
                    asyncHandleStorageSelectInTable(record.date, 'day')
                    break
                }
              },
            }
          }}
        ></Table>
      </Card>
      {blogListEle}
    </div>
  )
}

// visible: (...)
// created_at: (...)
// id: (...)
// mid: (...)
// can_edit: (...)
// show_additional_indication: (...)
// text: (...)
// source: (...)
// favorited: (...)
// pic_ids: (...)
// pic_types: (...)
// is_paid: (...)
// mblog_vip_type: (...)
// user: (...)
// pid: (...)
// pidstr: (...)
// retweeted_status: (...)
// reposts_count: (...)
// comments_count: (...)
// attitudes_count: (...)
// pending_approval_count: (...)
// isLongText: (...)
// reward_exhibition_type: (...)
// hide_flag: (...)
// mlevel: (...)
// darwin_tags: (...)
// mblogtype: (...)
// rid: (...)
// more_info_type: (...)
// extern_safe: (...)
// number_display_strategy: (...)
// enable_comment_guide: (...)
// content_auth: (...)
// pic_num: (...)
// alchemy_params: (...)
// mblog_menu_new_style: (...)
// reads_count: (...)
// title: (...)
// raw_text: (...)
// bid: (...)
// created_timestamp_at: (...)
