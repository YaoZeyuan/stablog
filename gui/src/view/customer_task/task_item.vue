<template>
  <div>
    <h1>
      任务输入框
      <el-popover placement="right" width="600" trigger="click">
        <div>
          <el-card class="box-card">
            <div>
              <p>请输入待抓取的任务地址, 一行一个, 识别失败的行会自动跳过</p>
              <hr />
              <p>示例:</p>
              <hr />
              <p>https://www.zhihu.com/people/yyln2016/activities/</p>
              <p>=> 抓取用户yyln2016的知乎故事(赞同过的所有回答和文章)(注: 只有当url以/activities/结尾时才视为抓取用户知乎故事)</p>
              <hr />
              <p>https://www.zhihu.com/people/yyln2016</p>
              <p>=> 抓取用户yyln2016创建的所有回答</p>
              <hr />
              <p>https://www.zhihu.com/collection/133027089</p>
              <p>=> 抓取收藏夹133027089内的所有知乎回答(注:这里只会抓取收藏夹内的文章, 由于知乎接口未返回收藏夹内的文章数据, 所以抓不到相应文章)</p>
              <hr />
              <p>https://www.zhihu.com/topic/20024374</p>
              <p>=> 抓取话题20024374下的所有精华回答</p>
              <hr />
              <p>https://zhuanlan.zhihu.com/yyln2016</p>
              <p>=> 抓取专栏yyln2016下的所有文章</p>
            </div>
          </el-card>
        </div>
        <i slot="reference" class="el-icon-question"></i>
      </el-popover>
    </h1>
    <el-card>
      <el-form :model="database.item" label-width="100px">
        <el-form-item label="任务类型">
          <el-select v-model="database.item.type" placeholder="请选择">
            <el-option
              v-for="itemKey in Object.keys(constant.Translate_Task_Type)"
              :key="constant.TaskType[itemKey]"
              :label="itemKey"
              :value="constant.TaskType[itemKey]"
            ></el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="任务id列表">
          <el-input
            type="textarea"
            :autosize="{minRows: 4}"
            placeholder="请输入内容"
            v-model="database.item.idListContent"
          ></el-input>
        </el-form-item>
        <el-form-item label="待抓取id列表">
          <el-table :data="database.item.idList" size="mini">
            <el-table-column label="id">
              <template slot-scope="scope">
                <p>{{ scope.row }}</p>
              </template>
            </el-table-column>
            <el-table-column label="操作" align="center">
              <template slot-scope="scope">
                <el-button
                  size="mini"
                  type="danger"
                  icon="el-icon-delete"
                  @click="removeTaskId(scope.row)"
                ></el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-form-item>
        <el-form-item label="排序依据"></el-form-item>
        <el-form-item label="排序依据">
          <el-radio-group v-model="database.item.orderBy">
            <el-radio :label="constant.OrderBy.创建时间">创建时间</el-radio>
            <el-radio :label="constant.OrderBy.更新时间">更新时间</el-radio>
            <el-radio :label="constant.OrderBy.赞同数">赞同数</el-radio>
            <el-radio :label="constant.OrderBy.评论数">评论数</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="database.item.comment"></el-input>
        </el-form-item>
      </el-form>
    </el-card>
    <div>
      <pre>
        {{JSON.stringify(database.item, null , 4)}}
      </pre>
      <br />
      <el-button type="primary" round @click="asyncHandleStartTask">开始执行</el-button>
    </div>
    <h1>解析结果</h1>
    <el-table :data="taskConfigList" style="width: 100%">
      <el-table-column prop="type" label="任务类型" width="180"></el-table-column>
      <el-table-column prop="id" label="id" width="180"></el-table-column>
      <el-table-column prop="comment" label="备注"></el-table-column>
    </el-table>
  </div>
</template>

<script lang="ts">
import Vue from 'vue'

import _ from 'lodash'
import querystring from 'query-string'
import util from '~/gui/src/library/util'
import TaskConfigType from './task_type'

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
  name: 'TaskItem',
  data() {
    return {
      // 页面数据
      database: {
        rawTaskContent: '',
        item: {
          type: TaskConfigType.CONST_Task_Type_用户的所有回答,
          idListContent: '',
          idList: ['1', '2', '3'],
          comment: '',
        },
      },
      // 页面状态
      status: {},
      constant: {
        Translate_Task_Type,
        Translate_Image_Quilty,
      },
    }
  },
  async mounted() {},
  methods: {
    removeTaskId(id: string) {
      console.log('remove scope.row =>', id)
      let newIdList = []
      for (let item of this.database.item.idList) {
        if (item !== id) {
          newIdList.push(item)
        }
      }
      this.database.item.idList = newIdList
    },
    matchId(taskType: TaskConfigType.TaskType, content: string) {
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
          // https://www.zhihu.com/collection/63119009
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
  },
  computed: {
    taskConfigList() {
      let taskList = []
      let rawTaskContent = this.database.rawTaskContent
      if (rawTaskContent === '') {
        return []
      }
      let rawTaskList = rawTaskContent.split('\n')
      for (let rawContent of rawTaskList) {
        let task = {
          type: 'author',
          id: '404-Page-Not-found',
          orderBy: 'createAt',
          order: 'asc',
          comment: '备注信息',
        }

        let demo = {
          type: 'author',
          id: '404-Page-Not-found',
          orderBy: 'createAt',
          order: 'asc',
          comment: '姚泽源的知乎回答集锦',
        }
        taskList.push(task)
      }
      return taskList
    },
  },
})
</script>

<style scoped>
</style>
