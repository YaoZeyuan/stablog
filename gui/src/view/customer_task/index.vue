<template>
  <div>
    <el-row type="flex" align="middle" justify="center">
      <el-col :span="20">
        <h1>自定义任务</h1>
      </el-col>
      <el-col :span="4">
        <el-button type="primary" round @click="asyncHandleStartTask">开始执行</el-button>
      </el-col>
    </el-row>
    <el-card>
      <el-form label-width="100px">
        <el-form-item label="电子书名">
          <el-input v-model="database.taskConfig.bookTitle"></el-input>
        </el-form-item>
        <el-form-item label="抓取任务">
          <template v-if="database.taskConfig.configList.length">
            <el-table :data="database.taskConfig.configList" stripe border style="width: 100%">
              <el-table-column label="任务类型" width="220">
                <template slot-scope="scope">
                  <el-select v-model="scope.row.type" placeholder="请选择">
                    <el-option
                      v-for="itemKey in Object.keys(constant.TaskType)"
                      :key="constant.TaskType[itemKey]"
                      :label="itemKey"
                      :value="constant.TaskType[itemKey]"
                    ></el-option>
                  </el-select>
                </template>
              </el-table-column>
              <el-table-column label="待抓取url">
                <template slot-scope="scope">
                  <el-input v-model="scope.row.rawInputText" placeholder="请输入待抓取url"></el-input>
                </template>
              </el-table-column>
              <el-table-column label="任务id">
                <template slot-scope="scope">
                  <span>{{scope.row.id ? scope.row.id : '未解析到任务id' }}</span>
                </template>
              </el-table-column>
              <el-table-column label="备注">
                <template slot-scope="scope">
                  <el-input v-model="scope.row.comment" placeholder="备注信息"></el-input>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="130">
                <template slot-scope="scope">
                  <el-button size="mini" @click="addTask(scope.$index)" icon="el-icon-plus"></el-button>
                  <el-button
                    size="mini"
                    type="danger"
                    @click="removeTaskByIndex(scope.$index, scope.row)"
                    icon="el-icon-minus"
                  ></el-button>
                </template>
              </el-table-column>
            </el-table>
          </template>
          <template v-else>
            <el-button @click="addTask()">添加</el-button>
          </template>
        </el-form-item>
        <el-form-item label="排序规则">
          <template v-if="database.taskConfig.orderByList.length">
            <el-table :data="database.taskConfig.orderByList" stripe border style="width: 100%">
              <el-table-column label="排序指标(从上至下)" width="220">
                <template slot-scope="scope">
                  <el-select v-model="scope.row.orderBy" placeholder="请选择">
                    <el-option
                      v-for="itemKey in Object.keys(constant.OrderBy)"
                      :key="constant.OrderBy[itemKey]"
                      :label="itemKey"
                      :value="constant.OrderBy[itemKey]"
                    ></el-option>
                  </el-select>
                </template>
              </el-table-column>
              <el-table-column label="规则">
                <template slot-scope="scope">
                  <el-radio-group v-model="scope.row.order">
                    <el-radio
                      :label="'asc'"
                    >{{(scope.row.orderBy === constant.OrderBy.创建时间 || scope.row.orderBy === constant.OrderBy.更新时间) ? '从旧到新' : '从低到高'}}</el-radio>
                    <el-radio
                      :label="'desc'"
                    >{{(scope.row.orderBy === constant.OrderBy.创建时间 || scope.row.orderBy === constant.OrderBy.更新时间) ? '从新到旧' : '从高到低'}}</el-radio>
                  </el-radio-group>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="130">
                <template slot-scope="scope">
                  <el-button size="mini" @click="addOrder(scope.$index)" icon="el-icon-plus"></el-button>
                  <el-button
                    size="mini"
                    type="danger"
                    @click="removeOrderByIndex(scope.$index, scope.row)"
                    icon="el-icon-minus"
                  ></el-button>
                </template>
              </el-table-column>
            </el-table>
          </template>
          <template v-else>
            <el-button @click="addTask()">添加</el-button>
          </template>
        </el-form-item>

        <el-form-item label="图片质量">
          <el-radio-group v-model="database.taskConfig.imageQuilty">
            <el-radio :label="constant.ImageQuilty.高清">高清</el-radio>
            <el-radio :label="constant.ImageQuilty.无图">无图</el-radio>
            <el-radio :label="constant.ImageQuilty.原图">原图</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="自动分卷">
          <el-input-number
            placeholder="每卷内最多包含n个问题/文章/想法"
            v-model="database.taskConfig.maxQuestionOrArticleInBook"
            :min="1"
            :step="100"
          ></el-input-number>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="database.taskConfig.comment"></el-input>
        </el-form-item>
      </el-form>
    </el-card>
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
import fs from 'fs'
import http from '~/gui/src/library/http'
import util from '~/gui/src/library/util'
import querystring from 'query-string'
import { TypeTaskConfig } from './task_type'
import { Task } from 'electron'

let TaskConfigType = TypeTaskConfig

const electron = require('electron')
const ipcRenderer = electron.ipcRenderer
const remote = electron.remote

let pathConfig = remote.getGlobal('pathConfig')

const TaskType = {
  用户提问过的所有问题: 'author-ask-question',
  用户的所有回答: 'author-answer',
  用户发布的所有想法: 'author-pin',
  用户赞同过的所有回答: 'author-agree-answer',
  用户赞同过的所有文章: 'author-agree-article',
  用户关注过的所有问题: 'author-watch-question',
  话题: 'topic',
  收藏夹: 'collection',
  专栏: 'column',
  文章: 'article',
  问题: 'question',
  回答: 'answer',
  想法: 'pin',
}
const OrderBy: {
  创建时间: 'createAt'
  更新时间: 'updateAt'
  赞同数: 'voteUpCount'
  评论数: 'commentCount'
} = {
  创建时间: 'createAt',
  更新时间: 'updateAt',
  赞同数: 'voteUpCount',
  评论数: 'commentCount',
}
const Order: {
  从低到高: 'asc'
  从旧到新: 'asc'
  从高到低: 'desc'
  从新到旧: 'desc'
} = {
  从低到高: 'asc',
  从旧到新: 'asc',
  从高到低: 'desc',
  从新到旧: 'desc',
}
const ImageQuilty = {
  无图: 'none',
  原图: 'raw',
  高清: 'hd',
}

const Translate_Task_Type = {
  [TaskConfigType.CONST_Task_Type_用户提问过的所有问题]: '用户提问过的所有问题',
  [TaskConfigType.CONST_Task_Type_用户的所有回答]: '用户的所有回答',
  [TaskConfigType.CONST_Task_Type_问题]: '问题',
  [TaskConfigType.CONST_Task_Type_回答]: '回答',
  [TaskConfigType.CONST_Task_Type_想法]: '想法',
  [TaskConfigType.CONST_Task_Type_用户发布的所有想法]: '用户发布的所有想法',
  [TaskConfigType.CONST_Task_Type_用户赞同过的所有回答]: '用户赞同过的所有回答',
  [TaskConfigType.CONST_Task_Type_用户赞同过的所有文章]: '用户赞同过的所有文章',
  [TaskConfigType.CONST_Task_Type_用户关注过的所有问题]: '用户关注过的所有问题',
  [TaskConfigType.CONST_Task_Type_话题]: '话题',
  [TaskConfigType.CONST_Task_Type_收藏夹]: '收藏夹',
  [TaskConfigType.CONST_Task_Type_专栏]: '专栏',
  [TaskConfigType.CONST_Task_Type_文章]: '文章',
}

const Translate_Image_Quilty = {
  [TaskConfigType.CONST_Image_Quilty_高清]: '高清',
  [TaskConfigType.CONST_Image_Quilty_原图]: '原图',
  [TaskConfigType.CONST_Image_Quilty_无图]: '无图',
}

export default Vue.extend({
  name: 'customerTask',
  data(): {
    database: {
      taskConfig: TypeTaskConfig.Record
    }
    // 页面状态
    status: {
      isLogin: boolean
    }
    constant: {}
  } {
    let configList: Array<TypeTaskConfig.ConfigItem> = []
    let taskConfig: TypeTaskConfig.Record = {
      configList: [],
      imageQuilty: TaskConfigType.CONST_Image_Quilty_高清,
      maxQuestionOrArticleInBook: 1000,
      orderByList: [
        {
          orderBy: TaskConfigType.CONST_Order_By_创建时间,
          order: TaskConfigType.CONST_Order_Desc,
        },
      ],
      bookTitle: '',
      comment: '',
    }
    return {
      // 页面数据
      database: {
        taskConfig: taskConfig,
      },
      // 页面状态
      status: {
        isLogin: false,
      },
      constant: {
        TaskType,
        OrderBy,
        Order,
        ImageQuilty,
      },
    }
  },
  async mounted() {
    let jsonContent = util.getFileContent(pathConfig.customerTaskConfigUri)
    let taskConfig: TypeTaskConfig.Record = {
      configList: [],
      imageQuilty: TaskConfigType.CONST_Image_Quilty_高清,
      bookTitle: '',
      maxQuestionOrArticleInBook: 1000,
      orderByList: [
        {
          orderBy: TaskConfigType.CONST_Order_By_创建时间,
          order: TaskConfigType.CONST_Order_Desc,
        },
      ],
      comment: '',
    }
    try {
      taskConfig = JSON.parse(jsonContent)
    } catch (e) {}
    this.database.taskConfig = taskConfig
    await this.asyncCheckIsLogin()
  },
  methods: {
    async saveConfig() {
      // 只保存匹配到id值的记录
      let rawTaskConfig = _.cloneDeep(this.database.taskConfig)
      let taskConfigList = []
      for (let config of rawTaskConfig.configList) {
        if (config.id) {
          taskConfigList.push(config)
        }
      }
      rawTaskConfig.configList = taskConfigList
      fs.writeFileSync(pathConfig.customerTaskConfigUri, JSON.stringify(rawTaskConfig, null, 4))
    },
    async asyncHandleStartTask() {
      this.saveConfig()
      await this.asyncCheckIsLogin()
      if (this.status.isLogin === false) {
        console.log('尚未登陆知乎')
        return
      }

      // 将当前任务配置发送给服务器
      ipcRenderer.sendSync('startCustomerTask')
      // 将面板切换到log上
      this.$emit('update:currentTab', 'log')
    },
    addOrder(index: number) {
      let newOrder: TypeTaskConfig.OrderConfig = {
        orderBy: OrderBy.创建时间,
        order: Order.从旧到新,
      }
      this.database.taskConfig.orderByList.splice(index + 1, 0, newOrder)
    },
    removeOrderByIndex(index: number) {
      let oldConfigList = this.database.taskConfig.orderByList
      oldConfigList.splice(index, 1)
      this.database.taskConfig.orderByList = oldConfigList
    },
    addTask(index: number) {
      let newTask: TypeTaskConfig.ConfigItem = {
        type: _.get(
          this.database.taskConfig.configList,
          [index, 'type'],
          TypeTaskConfig.CONST_Task_Type_用户的所有回答,
        ),
        id: '',
        rawInputText: '',
        comment: '',
      }
      this.database.taskConfig.configList.splice(index + 1, 0, newTask)
    },
    removeTaskByIndex(index: number) {
      let oldConfigList = this.database.taskConfig.configList
      oldConfigList.splice(index, 1)
      this.database.taskConfig.configList = oldConfigList
    },
    matchTaskId(taskType: TypeTaskConfig.TaskType, content: string) {
      let parseResult = querystring.parseUrl(content)
      let rawId = ''
      let id = ''
      let rawContent = parseResult.url
      switch (taskType) {
        case TaskConfigType.CONST_Task_Type_用户提问过的所有问题:
        case TaskConfigType.CONST_Task_Type_用户的所有回答:
        case TaskConfigType.CONST_Task_Type_用户发布的所有想法:
        case TaskConfigType.CONST_Task_Type_用户赞同过的所有回答:
        case TaskConfigType.CONST_Task_Type_用户赞同过的所有文章:
        case TaskConfigType.CONST_Task_Type_用户关注过的所有问题:
          // https://www.zhihu.com/people/404-Page-Not-found/activities
          rawId = _.get(rawContent.split('www.zhihu.com/people/'), [1], '')
          id = _.get(rawId.split('/'), [0], '')
          break
        case TaskConfigType.CONST_Task_Type_问题:
          // https://www.zhihu.com/question/321773825
          rawId = _.get(rawContent.split('www.zhihu.com/question/'), [1], '')
          id = _.get(rawId.split('/'), [0], '')
          break
          break
        case TaskConfigType.CONST_Task_Type_回答:
          // https://www.zhihu.com/question/321773825/answer/664230128
          rawId = _.get(rawContent.split('/answer/'), [1], '')
          id = _.get(rawId.split('/'), [0], '')
          break
        case TaskConfigType.CONST_Task_Type_想法:
          // https://www.zhihu.com/pin/1103720569358385152
          rawId = _.get(rawContent.split('/pin/'), [1], '')
          id = _.get(rawId.split('/'), [0], '')
          break
          break
        case TaskConfigType.CONST_Task_Type_话题:
          // https://www.zhihu.com/topic/19550517/hot
          rawId = _.get(rawContent.split('/topic/'), [1], '')
          id = _.get(rawId.split('/'), [0], '')
          break
        case TaskConfigType.CONST_Task_Type_收藏夹:
          // https://www.zhihu.com/collection/20077047
          rawId = _.get(rawContent.split('/collection/'), [1], '')
          id = _.get(rawId.split('/'), [0], '')
          break
        case TaskConfigType.CONST_Task_Type_专栏:
          // https://zhuanlan.zhihu.com/advancing-react
          rawId = _.get(rawContent.split('zhuanlan.zhihu.com/'), [1], '')
          id = _.get(rawId.split('/'), [0], '')
          break
        case TaskConfigType.CONST_Task_Type_文章:
          // https://zhuanlan.zhihu.com/p/59993287
          rawId = _.get(rawContent.split('zhuanlan.zhihu.com/p/'), [1], '')
          id = _.get(rawId.split('/'), [0], '')
          break
        default:
          id = ''
      }
      return id
    },
    async asyncCheckIsLogin() {
      // 已登陆则返回用户信息 =>
      // {"id":"57842aac37ccd0de3965f9b6e17cb555","url_token":"404-Page-Not-found","name":"姚泽源"}
      let record = await http.asyncGet('https://www.zhihu.com/api/v4/me')
      this.status.isLogin = _.has(record, ['id'])
      if (this.status.isLogin === false) {
        this.$alert(`检测尚未登陆知乎, 请登陆后再开始执行任务`, {})
        this.$emit('update:currentTab', 'login')
      }
      console.log('checkIsLogin: record =>', record)
    },
  },
  computed: {
    watchTaskConfig(): TypeTaskConfig.Record {
      if (this.database.taskConfig.configList.length > 0) {
        // 仅当配置列表中有值时, 才进行自动保存
        // 避免初始载入配置时被默认配置覆盖掉
        this.saveConfig()
      }
      // 监控configList值变动
      for (let config of this.database.taskConfig.configList) {
        config.id = this.matchTaskId(config.type, config.rawInputText)
      }
      return this.database.taskConfig
    },
  },
})
</script>

<style scoped>
</style>
