<template>
  <div>
    <h1>任务输入框
      <el-popover placement="right" width="600" trigger="click">
        <div>
          <el-card class="box-card">
            <div>
              <p>请输入待抓取的任务地址, 一行一个, 识别失败的行会自动跳过</p>
              <hr>
              <p>示例:</p>
              <hr>
              <p>https://www.zhihu.com/people/yyln2016/activities/</p>
              <p>=> 抓取用户yyln2016的知乎故事(赞同过的所有回答和文章)(注: 只有当url以/activities/结尾时才视为抓取用户知乎故事)</p>
              <hr>
              <p>https://www.zhihu.com/people/yyln2016</p>
              <p>=> 抓取用户yyln2016创建的所有回答</p>
              <hr>
              <p>https://www.zhihu.com/collection/133027089</p>
              <p>=> 抓取收藏夹133027089内的所有知乎回答(注:这里只会抓取收藏夹内的文章, 由于知乎接口未返回收藏夹内的文章数据, 所以抓不到相应文章)</p>
              <hr>
              <p>https://www.zhihu.com/topic/20024374</p>
              <p>=> 抓取话题20024374下的所有精华回答</p>
              <hr>
              <p>https://zhuanlan.zhihu.com/yyln2016</p>
              <p>=> 抓取专栏yyln2016下的所有文章</p>
            </div>
          </el-card>
        </div>
        <i slot="reference" class="el-icon-question"></i>
      </el-popover>
    </h1>
    <el-input
      type="textarea"
      :rows="10"
      placeholder="请输入待抓取的页面地址, 一行一个"
      v-model="database.rawTaskContent"
    ></el-input>
    <div>
      <br>
      <el-button type="primary" round @click="asyncHandleStartTask">开始执行</el-button>
      <el-button
        :type="this.status.isLogin ? 'success':'danger'"
        round
        @click="asyncCheckIsLogin"
      >检测登陆状态=>当前{{this.status.isLogin ? '已登陆': '未登录'}}</el-button>
      <p></p>
    </div>
    <h1>解析结果</h1>
    <el-table :data="taskConfigList" style="width: 100%">
      <el-table-column prop="type" label="任务类型" width="180"></el-table-column>
      <el-table-column prop="id" label="id" width="180"></el-table-column>
      <el-table-column prop="comment" label="备注"></el-table-column>
    </el-table>
  </div>
</template>

<script>
  import _ from "lodash"
  import fs from "fs"
  import http from '~/gui/src/library/http'
  import util from '~/gui/src/library/util'

  const electron = require('electron')
  const ipcRenderer = electron.ipcRenderer
  const remote = electron.remote

  let pathConfig = remote.getGlobal("pathConfig")


  export default {
    name: 'dashboard',
    data(){
        return {
            // 页面数据
            database:{
                rawTaskContent:'',
            },
            // 页面状态
            status:{
              isLogin:false
            }
        }
    },
    async mounted(){
      let content = util.getFileContent(pathConfig.readListUri)
      this.database.rawTaskContent = content
      await this.asyncCheckIsLogin()
    },
    methods:{
        async saveReadListContent(){
          fs.writeFileSync(pathConfig.readListUri, this.database.rawTaskContent)
        },
        async asyncHandleStartTask(){
            this.saveReadListContent()
            await this.asyncCheckIsLogin()
            if(this.status.isLogin === false){
               console.log("尚未登陆知乎")
               return
            }  

            // 将当前任务配置发送给服务器
            ipcRenderer.sendSync("start", this.taskConfigList)
            // 将面板切换到log上
            this.$emit('update:currentTab', 'log')
        },
        async asyncCheckIsLogin(){
          // 已登陆则返回用户信息 =>
          // {"id":"57842aac37ccd0de3965f9b6e17cb555","url_token":"404-Page-Not-found","name":"姚泽源"}
          let record = await http.asyncGet('https://www.zhihu.com/api/v4/me')
          this.status.isLogin =  _.has(record, ['id'])
          if(this.status.isLogin === false){
            this.$alert(`检测尚未登陆知乎, 请登陆后再开始执行任务`, {})
            this.$emit('update:currentTab', 'login')
          }
          console.log("checkIsLogin: record =>", record)
        }
    },
    computed:{
        taskConfigList(){
            let taskList = []
            let rawTaskContent = this.database.rawTaskContent 
            if(rawTaskContent === ''){
                return []
            }
            let rawTaskList = rawTaskContent.split("\n")
            for(let rawTask of rawTaskList){
                let task = {
                    "type": "author",
                    "id": "404-Page-Not-found",
                    "orderBy": "createAt",
                    "order": "asc",
                    "comment": "备注信息"
                }
                // 任务类别
                // https://www.zhihu.com/people/404-Page-Not-found/activities/ => activities
                // https://www.zhihu.com/people/404-Page-Not-found => author
                // https://www.zhihu.com/collection/19585453 => collection
                // https://www.zhihu.com/topic/19559052 => topic
                // https://zhuanlan.zhihu.com/ethanlam => column
                if(_.includes(rawTask, 'www.zhihu.com/people/')){
                    let rawId = _.get(rawTask.split('www.zhihu.com/people/'), [1], '')
                    let id = _.get(rawId.split('/'), [0], '')
                    if(id === ''){
                        continue
                    }
                    if(_.includes(rawTask, '/activities/')){
                        task.type = 'activity'
                        task.id = id
                        task.comment = `用户${id}的知乎故事` 
                    }else{
                        task.type = 'author'
                        task.id = id
                        task.comment = `用户${id}的知乎回答集锦` 
                    }
                }else if(_.includes(rawTask, 'www.zhihu.com/collection/')){
                    let rawId = _.get(rawTask.split('www.zhihu.com/collection/'), [1], '')
                    let id = _.get(rawId.split('/'), [0], '')
                    task.type = 'collection'
                    task.id = id
                    task.comment = `收藏夹${id}内的知乎回答集锦(受知乎接口限制影响, 其内仅回答, 没有专栏文章)` 
                }else if(_.includes(rawTask, 'www.zhihu.com/topic/')){
                    let rawId = _.get(rawTask.split('www.zhihu.com/topic/'), [1], '')
                    let id = _.get(rawId.split('/'), [0], '')
                    task.type = 'topic'
                    task.id = id
                    task.comment = `话题${id}内的精华回答集锦` 
                }else if(_.includes(rawTask, 'zhuanlan.zhihu.com/')){
                    let rawId = _.get(rawTask.split('zhuanlan.zhihu.com/'), [1], '')
                    let id = _.get(rawId.split('/'), [0], '')
                    task.type = 'column'
                    task.id = id
                    task.comment = `专栏${id}内的文章集锦` 
                }else{
                    continue
                }
                taskList.push(task)
            }
            return taskList
        }
    }
  }
</script>

<style scoped>
</style>
