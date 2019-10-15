<template>
  <div class="app">
    <el-container>
      <el-main>
        <el-tabs v-model="status.tab" @tab-click="handleClickTab">
          <!-- <el-tab-pane label="任务面板" :name="constant.tab.dashboard">
            <Dashboard :currentTab.sync="status.tab"/>
          </el-tab-pane>-->
          <el-tab-pane label="自定义任务" :name="constant.tab.customerTask">
            <CustomerTask :currentTab.sync="status.tab" />
          </el-tab-pane>
          <el-tab-pane label="运行日志" :name="constant.tab.log">
            <Log />
          </el-tab-pane>
          <el-tab-pane label="登陆微博" :name="constant.tab.login">
            <Login />
          </el-tab-pane>
          <el-tab-pane label="使用说明" :name="constant.tab.helper">
            <Helper />
          </el-tab-pane>
          <el-tab-pane label="支持作者" :name="constant.tab.donate">
            <Donate />
          </el-tab-pane>
        </el-tabs>
      </el-main>
      <el-footer></el-footer>
    </el-container>
  </div>
</template>

<script>
  import CustomerTask from './customer_task/index.vue'
  import Login from './login/index.vue'
  import Log from './log/index.vue'
  import Helper from './helper/index.vue'
  import Donate from './donate/index.vue'
  import _ from 'lodash'

  export default {
    name: 'App',
    components:{
      CustomerTask,
      Log,
      Login,
      Helper,
      Donate,
    },
    data(){
        return {
          constant:{
            tab:{
              // dashboard:'dashboard',
              customerTask:'customerTask',
              log:'log',
              login:'login',
              helper:'helper',
              donate:'donate',
            }
          },
            // 页面数据
            database:{
            },
            // 页面状态
            status:{
              tab:'customerTask',
            }
        }
    },
    methods:{
        handleClickTab(){

        },
    },
    computed:{
        taskConfigList(){
            return 
        }
    }
  }
</script>

<style lang="less" scoped>
.app {
  margin: 0 5vw;
  background-color: #f5f7f9;
  height: 100vh;
}
.header {
  .logo {
    width: 2vw;
    height: 2vw;
  }
  h1 {
    display: inline;
  }
}
</style>
