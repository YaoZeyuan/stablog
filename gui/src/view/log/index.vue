<template>
  <div>
    <div id="log-dashboard">
      <pre>{{this.database.log}}</pre>
    </div>
    <el-button @click="this.updateLog">刷新</el-button>
    <el-button disabled>当前总日志行数:{{database.totalLogCount}}条</el-button>
    <el-button @click="this.clearLog">清空日志</el-button>
  </div>
</template>

<script>
  import _ from "lodash"
  import fs from "fs"
  import electron from "electron"
  import util from '~/gui/src/library/util'
  let remote = electron.remote
  let ipcRenderer = electron.ipcRenderer
  
  let pathConfig = remote.getGlobal("pathConfig")

  export default {
    name: 'dashboard',
    data(){
        return {
            // 页面数据
            database:{
                log:'',
                totalLogCount:0
            },
        }
    },
    mounted(){
      let that = this
      setInterval(function(){
        // 每5s更新一次日志
        that.updateLog()
      }, 2000)
    },
    methods:{
        updateLog(){
          let logContent = util.getFileContent(pathConfig.runtimeLogUri)
          let logList = logContent.split("\n")
          this.database.totalLogCount = logList.length
          logList = logList.slice(logList.length - 500, logList.length) // 只展示最后500行即可
          this.database.log = logList.join("\n")
          // 自动滚动到页面最下方 
          let divElement = window.document.getElementById('log-dashboard');
          divElement.scrollTop = divElement.scrollHeight;
          console.log("updateLog: log =>", this.database.log)
        },
        clearLog(){
          fs.writeFileSync(pathConfig.runtimeLogUri, '')
        }
    },
    computed:{
    }
  }
</script>

<style lang="less" scoped>
#log-dashboard {
  width: 100%;
  height: 50vh;
  overflow-y: scroll;
  background-color: #fdf6ec;
  pre {
    white-space: pre-line;
    // height: 50vh;
    background-color: #fdf6ec;
  }
}
</style>
