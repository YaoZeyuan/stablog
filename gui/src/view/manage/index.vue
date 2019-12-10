<template>
  <div>
    <el-table
      :data="userList"
      style="width: 100%"
      highlight-current-row
      @current-change="handleSelectChange"
    >
      <el-table-column type="index" />
      <el-table-column label="已缓存账号">
        <template slot-scope="scope">
          <div class="user-info">
            <img :alt="scope.row.screen_name" :src="scope.row.avatar_hd" class="avatar" />
            <div class="name">{{scope.row.screen_name}}</div>
            <div class="id">({{scope.row.id}})</div>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="description" label="个人简介"></el-table-column>
    </el-table>

    <el-card class="box-card" shadow="hover" v-loading="state.loading.distribution">
      <div slot="header" class="clearfix">
        <span>{{currentSelectUser['screen_name']}} 微博缓存情况</span>
      </div>
      <el-select v-model="state.storageSelect.year" placeholder="年">
        <el-option
          v-for="(yearItem, index) in state.storageSelect.yearList"
          :key="index"
          :label="yearItem"
          :value="yearItem"
        ></el-option>
      </el-select>
      <el-select v-model="state.storageSelect.month" placeholder="月">
        <el-option
          v-for="(monthItem, index) in state.storageSelect.monthList"
          :key="index"
          :label="monthItem"
          :value="monthItem"
        ></el-option>
      </el-select>
      <el-button @click="clearStorageSelect">重置</el-button>
      <el-table
        v-on:row-click="handleStorageSelectInTable"
        :data="weiboStorageSummaryList"
        style="width: 100%;margin-bottom: 20px;"
        border
        show-summary
      >
        <el-table-column prop="date" label="时间" width="180"></el-table-column>
        <el-table-column prop="count" label="缓存微博数"></el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script lang="ts">
import { remote } from 'electron'
import Vue from 'vue'
import _ from 'lodash'
import TypeWeibo from '~/gui/../src/type/namespace/weibo'

type BlogDistributionItem = {
  date: string
  key: string
  type: 'year' | 'month' | 'day'
  startAt: number
  count: number
  childrenMap: BlogDistributionMap
}

type BlogDistributionMap = Map<
  string,
  {
    date: string
    key: string
    type: 'year' | 'month' | 'day'
    startAt: number
    count: number
    childrenMap: BlogDistributionMap
  }
>

export default {
  name: 'manage',
  data: function(): {
    database: {
      userMap: Map<string, TypeWeibo.TypeWeiboUserInfo>
      blogDistributionMap: BlogDistributionMap
    }
    state: {
      selectUserId: string
      storageSelect: {
        year: string
        month: string
        yearList: string[]
        monthList: string[]
      }
      loading: {
        distribution: boolean
      }
    }
    forceUpdate: number
  } {
    return {
      database: {
        userMap: new Map(),
        blogDistributionMap: new Map(),
      },
      state: {
        selectUserId: '',
        storageSelect: {
          year: '',
          month: '',
          yearList: [],
          monthList: [],
        },
        loading: {
          distribution: false,
        },
      },
      forceUpdate: 0,
    }
  },

  methods: {
    async getUserList() {
      let MUser = remote.getGlobal('mUser')
      let recordList = (await MUser.asyncGetUserList()) as TypeWeibo.TypeWeiboUserInfo[]
      let userMap = new Map()
      for (let record of recordList) {
        userMap.set(record.id, record)
      }
      this.database.userMap = userMap
    },
    async getDistribute() {
      let MBlog = remote.getGlobal('mBlog')
      this.state.loading.distribution = true
      let distributionMap = (await MBlog.asyncGetWeiboDistribution(this.state.selectUserId)) as BlogDistributionMap
      this.state.loading.distribution = false
      console.log('distribution => ', distributionMap)
      // 必须要手工转成obj
      this.database.blogDistributionMap = distributionMap
      this.forceUpdate++
    },
    async handleSelectChange(currentRow: TypeWeibo.TypeWeiboUserInfo, oldCurrentRow: TypeWeibo.TypeWeiboUserInfo) {
      this.state.selectUserId = `${currentRow.id}`
      this.state.storageSelect.month = ''
      this.state.storageSelect.year = ''
      this.state.storageSelect.yearList = []
      this.state.storageSelect.monthList = []
      await this.getDistribute()
    },
    // 支持点选
    handleStorageSelectInTable(row: BlogDistributionItem) {
      if (row.type === 'year') {
        this.state.storageSelect.year = row.date
      }
      if (row.type === 'month') {
        this.state.storageSelect.month = row.date
      }
    },
    weiboStorageYearList() {
      if (this.database.blogDistributionMap.size === 0) {
        return []
      }
      // 年列表
      let yearList: string[] = []
      this.database.blogDistributionMap.forEach(item => {
        yearList.push(item.date)
        console.log('yearList push')
      })

      console.log('dasdas =>', this.database.blogDistributionMap)
      console.log('yearList =>', this.forceUpdate)
      console.log('yearList =>', yearList)
      return yearList
    },
    weiboStorageMonthList() {
      if (
        this.state.storageSelect.year === '' &&
        !this.database.blogDistributionMap.get(this.state.storageSelect.year)
      ) {
        return []
      }
      // 月列表
      let monthList: string[] = []
      let selectMonthMap = this.database.blogDistributionMap.get(this.state.storageSelect.year)['childrenMap']
      selectMonthMap.forEach(item => {
        console.log('monthList push')
        monthList.push(item.date)
      })
      console.log('monthList =>', this.forceUpdate)
      console.log('monthList =>', monthList)
      return monthList
    },
    clearStorageSelect() {
      this.state.storageSelect.year = ''
      this.state.storageSelect.month = ''
    },
  },
  computed: {
    userList(): TypeWeibo.TypeWeiboUserInfo[] {
      let list = []
      let int = this.database.userMap.values()
      for (let item of int) {
        list.push(item)
      }
      console.log('list =>', list)
      return list
    },
    currentSelectUser() {
      if (this.state.selectUserId) {
        let uidStr = `${this.state.selectUserId}`
        let uidInt = parseInt(uidStr, 10)
        return this.database.userMap.get(uidStr) || this.database.userMap.get(uidInt) || {}
      } else {
        return {}
      }
    },
    weiboStorageSummaryList() {
      if (this.database.blogDistributionMap.size === 0) {
        return []
      }
      const { year, month } = this.state.storageSelect
      const blogDistributionMap = this.database.blogDistributionMap
      let summaryList = []
      if (year === '') {
        // 按年展示
        blogDistributionMap.forEach(item => {
          summaryList.push(item)
        })
        return summaryList
      }
      if (month === '') {
        // 按月展示
        let yearDistributionMap = blogDistributionMap.get(year)['childrenMap']
        yearDistributionMap.forEach(item => {
          summaryList.push(item)
        })
        return summaryList
      }
      // 按天展示
      let monthDistributionMap = blogDistributionMap.get(year)!['childrenMap'].get(month)!['childrenMap']
      monthDistributionMap.forEach(item => {
        summaryList.push(item)
      })
      return summaryList
    },
  },
  watch: {
    forceUpdate() {
      this.state.storageSelect.yearList = this.weiboStorageYearList()
    },
    ['state.storageSelect.year']: function() {
      this.state.storageSelect.month = ''
      this.state.storageSelect.monthList = this.weiboStorageMonthList()
    },
  },
  async mounted() {
    // 初始化时自动载入数据
    await this.getUserList()
    if (this.userList.length > 0) {
      this.state.selectUserId = `${this.userList[0].id}`
    }
  },
}
</script>

<style scoped lang="less">
.user-info {
  display: flex;
  font-size: 16px;
  align-items: center;
  img.avatar {
    width: 30px;
    height: 30px;
    border-radius: 30px;
    margin-right: 16px;
  }
}
</style>
