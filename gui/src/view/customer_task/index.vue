<template>
  <div>
    <el-card>
      <el-form label-width="100px">
        <el-form-item label="个人主页">
          <div class="input-homepage-url">
            <el-input
              v-model="database.taskConfig.configList[0].rawInputText"
              placeholder="请输入用户个人主页url.示例:https://weibo.com/u/5390490281"
            />
            <el-popover placement="bottom" trigger="click">
              <div>
                <p>请输入您的个人主页url</p>
                <br />
                <p>支持以下三种格式:</p>
                <p>https://weibo.com/u/6646798696</p>
                <p>https://weibo.com/guhongze</p>
                <p>https://m.weibo.cn/u/1687243315</p>
              </div>
              <i class="el-icon-question" slot="reference"></i>
            </el-popover>
          </div>
        </el-form-item>
        <el-form-item label="用户信息">
          <template v-if="database.taskConfig.configList[0].uid">
            <el-card>
              <div class="content">
                <p>用户名:{{database.currentUserInfo.screen_name}}</p>
                <p>微博总数:{{database.currentUserInfo.statuses_count}}</p>
                <p>待抓取页数:{{database.currentUserInfo.total_page_count}}</p>
                <p>
                  备份全部微博预计耗时:
                  <span
                    style="color:red;"
                  >{{database.currentUserInfo.total_page_count * 30 / 60}}分钟</span>
                </p>
                <p>粉丝数:{{database.currentUserInfo.followers_count}}</p>
              </div>
            </el-card>
          </template>
          <template v-else>
            <span>数据待同步</span>
          </template>
        </el-form-item>
        <el-divider content-position="center">备份配置</el-divider>
        <el-form-item label="备份页数">
          <span>从第</span>
          <el-input-number
            placeholder
            v-model="database.taskConfig.fetchStartAtPageNo"
            :min="0"
            :step="1"
          ></el-input-number>
          <span>页备份到第</span>
          <el-input-number
            placeholder
            v-model="database.taskConfig.fetchEndAtPageNo"
            :min="1"
            :step="1"
          ></el-input-number>
          <span>页</span>
        </el-form-item>
        <el-divider content-position="center">输出规则</el-divider>
        <el-form-item label="微博排序">
          <el-radio-group v-model="database.taskConfig.postAtOrderBy">
            <el-radio :label="constant.Order.由旧到新">由旧到新</el-radio>
            <el-radio :label="constant.Order.由新到旧">由新到旧</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="图片配置">
          <el-radio-group v-model="database.taskConfig.imageQuilty">
            <el-radio :label="constant.ImageQuilty.默认">有图</el-radio>
            <el-radio :label="constant.ImageQuilty.无图">无图</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="自动分卷">
          <span>每</span>
          <el-input-number
            placeholder="每n条微博自动分卷"
            v-model="database.taskConfig.maxBlogInBook"
            :min="1"
            :step="100"
          ></el-input-number>
          <span>条微博输出一本电子书</span>
        </el-form-item>
        <el-form-item label="时间范围">
          <span>只输出从</span>
          <el-date-picker
            v-model="database.taskConfig.outputStartAtMs"
            type="date"
            placeholder="选择日期"
            value-format="timestamp"
          ></el-date-picker>
          <span>到</span>
          <el-date-picker
            v-model="database.taskConfig.outputEndAtMs"
            type="date"
            placeholder="选择日期"
            value-format="timestamp"
          ></el-date-picker>
          <span>间发布的微博</span>
        </el-form-item>
        <el-form-item label="分页依据">
          <span>按</span>
          <el-select v-model="database.taskConfig.mergeBy" placeholder="请选择">
            <el-option label="年" :value="constant.MergeBy['年']"></el-option>
            <el-option label="月" :value="constant.MergeBy['月']"></el-option>
            <el-option label="日" :value="constant.MergeBy['日']"></el-option>
            <el-option label="微博条数" :value="constant.MergeBy['微博条数']"></el-option>
          </el-select>
          <span>汇集微博</span>
          <template v-if="database.taskConfig.mergeBy === constant.MergeBy['微博条数']">
            <span>, 每</span>
            <el-input-number
              placeholder="每n条微博一页"
              v-model="database.taskConfig.mergeCount"
              :min="1"
              :step="100"
            ></el-input-number>
            <span>条微博一页</span>
          </template>
        </el-form-item>
        <el-form-item label="操作">
          <el-button type="primary" @click="asyncHandleStartTask">开始备份</el-button>
          <el-button type="success" @click="asyncData()">同步用户信息</el-button>
          <el-button type="primary" @click="openOutputDir">打开电子书所在目录</el-button>
          <el-button type="danger" @click="asyncCheckUpdate">检查更新</el-button>
        </el-form-item>
      </el-form>
    </el-card>
    <el-dialog
      title="发现新版本"
      :visible.sync="status.showUpgradeInfo"
      width="80%"
      :before-close="handleCloseDialog"
    >
      <p>发现新版本{{status.remoteVersionConfig.version}},请到</p>
      <p>{{status.remoteVersionConfig.downloadUrl}}</p>
      <p>下载最新版</p>
      <br />
      <p>更新日期:</p>
      <p>{{status.remoteVersionConfig.releaseAt}}</p>
      <br />
      <p>更新说明:</p>
      <p>{{status.remoteVersionConfig.releaseNote}}</p>
      <span></span>
      <span slot="footer" class="dialog-footer">
        <el-button type="primary" @click="jumpToUpgrade">下载更新</el-button>
        <el-button @click="handleCloseDialog">取消</el-button>
      </span>
    </el-dialog>
    <div></div>
    <h1>配置文件内容:</h1>
    <pre>
        {{JSON.stringify(database, null , 4)}}
      </pre>
    <div data-comment="监控数据变动" :data-watch="JSON.stringify(watchTaskConfig)"></div>
  </div>
</template>

<script lang="ts">
import Vue from 'vue'

import _ from 'lodash'
import moment from 'moment'
import fs from 'fs'
import http from '~/gui/src/library/http'
import util from '~/gui/src/library/util'
import querystring from 'query-string'
import packageConfig from '~/gui/../package.json'
import { TypeTaskConfig } from './task_type'

let currentVersion = parseFloat(packageConfig.version)

let TaskConfigType = TypeTaskConfig

const electron = require('electron')
const shell = electron.shell
const ipcRenderer = electron.ipcRenderer
const remote = electron.remote

let pathConfig = remote.getGlobal('pathConfig')

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
const MergeBy: { [key: string]: string } = {
  ['年']: 'year',
  ['月']: 'month',
  ['日']: 'day',
  ['微博条数']: 'count',
}

export default Vue.extend({
  name: 'customerTask',
  data(): {
    database: {
      taskConfig: TypeTaskConfig.Customer
      currentUserInfo: {
        screen_name: string
        statuses_count: number
        total_page_count: number
        followers_count: number
      }
    }
    // 页面状态
    status: {
      isLogin: boolean
      showUpgradeInfo: boolean
      remoteVersionConfig: {
        version: number
        downloadUrl: string
        releaseAt: string
        releaseNote: string
      }
    }
    constant: {}
  } {
    let taskConfig: TypeTaskConfig.Customer = {
      configList: [_.clone(defaultConfigItem)],
      imageQuilty: TaskConfigType.CONST_Image_Quilty_默认,
      maxBlogInBook: 100000,
      postAtOrderBy: TaskConfigType.CONST_Order_Asc,
      bookTitle: '',
      comment: '',
      mergeBy: TaskConfigType.CONST_Merge_By_月,
      mergeCount: 1000,
      fetchStartAtPageNo: 0,
      fetchEndAtPageNo: 100000,
      outputStartAtMs: moment('2010-01-01 00:00:00').unix() * 1000,
      outputEndAtMs:
        moment()
          .add(1, 'year')
          .unix() * 1000,
    }
    if (taskConfig.configList.length === 0) {
      // 如果没有数据, 就要手工补上一个, 确保数据完整
      taskConfig.configList.push(_.clone(defaultConfigItem))
    }
    return {
      // 页面数据
      database: {
        taskConfig: taskConfig,
        currentUserInfo: {
          screen_name: '',
          statuses_count: 0,
          total_page_count: 0,
          followers_count: 0,
        },
      },
      // 页面状态
      status: {
        isLogin: false,
        showUpgradeInfo: false,
        remoteVersionConfig: {
          version: 1.0,
          downloadUrl: '',
          releaseAt: '',
          releaseNote: '',
        },
      },
      constant: {
        Order,
        ImageQuilty,
        MergeBy,
      },
    }
  },
  async mounted() {
    let jsonContent = util.getFileContent(pathConfig.customerTaskConfigUri)
    let taskConfig: TypeTaskConfig.Customer = {
      configList: [_.clone(defaultConfigItem)],
      imageQuilty: TaskConfigType.CONST_Image_Quilty_默认,
      maxBlogInBook: 100000,
      postAtOrderBy: TaskConfigType.CONST_Order_Asc,
      bookTitle: '',
      comment: '',
      mergeBy: TaskConfigType.CONST_Merge_By_月,
      mergeCount: 1000,
      fetchStartAtPageNo: 0,
      fetchEndAtPageNo: 100000,
      outputStartAtMs: moment('2010-01-01 00:00:00').unix() * 1000,
      outputEndAtMs:
        moment()
          .add(1, 'year')
          .unix() * 1000,
    }
    try {
      taskConfig = JSON.parse(jsonContent)
    } catch (e) {}
    this.database.taskConfig = taskConfig
    if (this.database.taskConfig.configList.length === 0) {
      this.database.taskConfig.configList.push(_.clone(defaultConfigItem))
    }
    await this.asyncCheckIsLogin()
    if (this.database.taskConfig.configList[0].rawInputText) {
      await this.asyncData()
    }
  },
  methods: {
    async asyncData() {
      let rawInputText = this.database.taskConfig.configList[0].rawInputText
      if (!rawInputText) {
        // @ts-ignore
        this.$alert(`请先输入待备份用户主页地址`)
        return false
      }
      let uid = await this.asyncGetUid(rawInputText)
      if (!uid) {
        // @ts-ignore
        this.$alert(`用户不存在, 请确认用户主页地址是否正确`)
        return false
      }
      let userInfo = await this.asyncGetUserInfo(uid)
      Vue.set(this.database.taskConfig.configList, 0, {
        rawInputText,
        uid,
        comment: '',
      })
      this.database.currentUserInfo = userInfo
      return true
    },
    /**
     * 将用户输入的主页url转为uid
     */
    async asyncGetUid(rawInputUrl: string) {
      if (rawInputUrl.includes('m.weibo.cn/u/')) {
        let rawUid = rawInputUrl.split(`m.weibo.cn/u/`)[1]
        let uid = _.get(rawUid.match(/^\d+/), 0, '')
        return uid
      }
      if (rawInputUrl.includes('weibo.com/u/')) {
        let rawUid = rawInputUrl.split(`weibo.com/u/`)[1]
        let uid = _.get(rawUid.match(/^\d+/), 0, '')
        return uid
      } else {
        let rawAccount = rawInputUrl.split(`weibo.com/`)[1]
        let account = rawAccount.split('?')[0]
        // 新浪会将url重定向到
        let response = await http.rawClient.get(
          `https://m.weibo.cn/${account}?topnav=1&wvr=6&topsug=1&is_all=1&jumpfrom=weibocom&topnav=1&wvr=6&topsug=1&is_all=1`,
        )
        let url = response.request.responseURL || ''
        let rawUid = url.split(`m.weibo.cn/u/`)[1]
        let uid = _.get(rawUid.match(/^\d+/), 0, '')
        return uid
      }
    },
    /**
     * 获取用户信息
     */
    async asyncGetUserInfo(uid: number | string) {
      let response = await http.asyncGet(`https://m.weibo.cn/api/container/getIndex?&type=uid&value=${uid}`)
      let userInfo = _.get(response, ['data', 'userInfo'], {})
      let screen_name = userInfo.screen_name || ''
      let statuses_count = userInfo.statuses_count || 0
      let followers_count = userInfo.followers_count || 0
      let total_page_count = Math.floor(statuses_count / 10)
      return {
        screen_name,
        statuses_count,
        total_page_count,
        followers_count,
      }
    },
    async saveConfig() {
      let rawTaskConfig = _.cloneDeep(this.database.taskConfig)
      fs.writeFileSync(pathConfig.customerTaskConfigUri, JSON.stringify(rawTaskConfig, null, 4))
    },
    async asyncHandleStartTask() {
      this.saveConfig()
      await this.asyncCheckIsLogin()
      if (this.status.isLogin === false) {
        console.log('请先登录微博')
        return
      }
      let asyncSuccess = await this.asyncData()
      if (asyncSuccess !== true) {
        return
      }
      // 将当前任务配置发送给服务器
      ipcRenderer.sendSync('startCustomerTask')
      // 将面板切换到log上
      this.$emit('update:currentTab', 'log')
    },
    async openOutputDir() {
      // 打开电子书存储目录
      ipcRenderer.sendSync('openOutputDir')
    },
    matchTaskId(content: string) {
      let parseResult = querystring.parseUrl(content)
      let rawId = ''
      let id = ''
      let rawContent = parseResult.url
      return id
    },
    async asyncCheckIsLogin() {
      // 已登陆则返回用户信息 =>
      // {"preferQuickapp":0,"data":{"login":true,"st":"ae34d2","uid":"1728335761"},"ok":1}
      let record = await http.asyncGet('https://m.weibo.cn/api/config')
      this.status.isLogin = _.get(record, ['data', 'login'], false)
      if (this.status.isLogin === false) {
        // @ts-ignore
        this.$alert(`检测到尚未登陆微博, 请登陆后再使用`, {})
        this.$emit('update:currentTab', 'login')
      }
      console.log('checkIsLogin: record =>', record)
    },
    async asyncCheckUpdate() {
      let checkUpgradeUri = 'http://api.bookflaneur.cn/stablog/version'
      this.status.remoteVersionConfig = await http
        .asyncGet(checkUpgradeUri, {
          params: {
            now: new Date().toISOString,
          },
        })
        .catch(e => {
          return {}
        })
      // 已经通过Electron拿到了最新cookie并写入了配置文件中, 因此不需要再填写配置文件了
      if (this.status.remoteVersionConfig.version > currentVersion) {
        this.status.showUpgradeInfo = true
      } else {
        this.$alert(`当前已是最新版 => ${this.status.remoteVersionConfig.version}`)
      }
    },
    handleCloseDialog() {
      this.status.showUpgradeInfo = false
    },
    jumpToUpgrade() {
      this.status.showUpgradeInfo = false
      shell.openExternal(this.status.remoteVersionConfig.downloadUrl)
    },
  },
  computed: {
    watchTaskConfig(): TypeTaskConfig.Customer {
      if (this.database.taskConfig.configList[0].uid) {
        // 仅当配置列表中有值时, 才进行自动保存
        // 避免初始载入配置时被默认配置覆盖掉
        this.saveConfig()
      }
      return this.database.taskConfig
    },
  },
})
</script>

<style scoped>
.input-homepage-url {
  display: flex;
}
.input-homepage-url .el-icon-question {
  margin-left: 12px;
  margin-right: 12px;
}
</style>
