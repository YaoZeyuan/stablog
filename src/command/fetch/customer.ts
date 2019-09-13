import Base from '~/src/command/fetch/base'
import TypeTaskConfig from '~/src/type/namespace/task_config'
import PathConfig from '~/src/config/path'
import fs from 'fs'
import _ from 'lodash'
import json5 from 'json5'

import ApiWeibo from '~/src/api/weibo'
import MMblog from '~/src/model/mblog'
import MMblogUser from '~/src/model/mblog_user'
import CommonUtil from '~/src/library/util/common'
import * as TypeWeibo from '~/src/type/namespace/weibo'

class FetchCustomer extends Base {
  static get signature() {
    return `
        Fetch:Customer
    `
  }

  static get description() {
    return `从${PathConfig.customerTaskConfigUri}中读取自定义抓取任务并执行`
  }

  async execute(args: any, options: any): Promise<any> {
    this.log(`从${PathConfig.customerTaskConfigUri}中读取配置文件`)
    let fetchConfigJSON = fs.readFileSync(PathConfig.customerTaskConfigUri).toString()
    this.log('content =>', fetchConfigJSON)
    let customerTaskConfig: TypeTaskConfig.Customer = json5.parse(fetchConfigJSON)
    this.log(`开始进行自定义抓取`)
    type TypeTaskPackage = {
      [key: string]: Array<string>
    }
    let taskConfigList: Array<TypeTaskConfig.Record> = customerTaskConfig.configList
    for (let taskConfig of taskConfigList) {
      let { uid, comment } = taskConfig
      this.log(`待抓取用户uid => ${uid}`)
      this.log(`备注信息 => ${comment}`)
      // 开工
      this.log(`抓取用户${uid}信息`)
      let response = await ApiWeibo.asyncGetUserInfoResponseData(uid)
      if (_.isEmpty(response)) {
        this.log(`用户信息获取失败, 请检查登录状态`)
        continue
      }
      let userInfo = response.userInfo
      this.log(`用户信息获取完毕,待抓取用户为:${userInfo.screen_name},个人简介:${userInfo.description}`)
      // 拿到containerId
      let containerId: string = ''
      for (let tab of response.tabsInfo.tabs) {
        if (tab.tabKey === 'weibo') {
          containerId = tab.containerid
        }
      }
      if (containerId === '') {
        this.log(`未能获取到用户${userInfo.screen_name}对应的containerId,自动跳过`)
        continue
      }
      this.log(`开始抓取用户${userInfo.screen_name}微博记录`)
      let mblogCardList = await ApiWeibo.asyncGetWeiboList(containerId)
      if (_.isEmpty(mblogCardList)) {
        this.log(`用户${userInfo.screen_name}微博记录为空,跳过抓取流程`)
        continue
      }
      let mblogCard = mblogCardList[0]
      let mblog = mblogCard.mblog
      let mblogUserInfo = mblog.user
      // 保存用户信息
      await MMblogUser.replaceInto({
        author_uid: mblogUserInfo.id,
        raw_json: JSON.stringify(mblogUserInfo),
      })
      // 用户总微博数
      let totalMblogCount = mblogUserInfo.statuses_count
      let totalPageCount = Math.ceil(totalMblogCount / 10)
      this.log(`用户${userInfo.screen_name}共发布了${totalMblogCount}条微博, 正式开始抓取`)
      for (let page = 1; page < totalPageCount; page++) {
        await CommonUtil.asyncAppendPromiseWithDebounce(this.fetchMblogListAndSaveToDb(uid, page, totalPageCount))
      }
      await CommonUtil.asyncDispatchAllPromiseInQueen()
      this.log(`用户${userInfo.screen_name}微博抓取完毕`)
    }
    this.log(`所有任务抓取完毕`)
  }

  async fetchMblogListAndSaveToDb(author_uid: string, page: number, totalPage: number) {
    let target = `第${page}/${totalPage}页微博记录`
    this.log(`准备抓取${target}`)
    let mblogList = await ApiWeibo.asyncGetWeiboList(author_uid, page)
    if (_.isEmpty(mblogList)) {
      this.log(`第${page}/${totalPage}页微博记录抓取失败`)
      return
    }
    this.log(`${target}抓取成功, 准备存入数据库`)
    for (let mblogRecord of mblogList) {
      if (_.isEmpty(mblogRecord.mblog) || _.isEmpty(mblogRecord.mblog.user)) {
        // 数据为空自动跳过
        continue
      }
      let id = mblogRecord.mblog.id
      let author_uid = mblogRecord.mblog.user.id
      // 删掉字段中的user, 节约储存空间
      delete mblogRecord.mblog.user
      let raw_json = JSON.stringify(mblogRecord.mblog)
      await MMblog.replaceInto({
        id,
        author_uid,
        raw_json,
      })
    }
    this.log(`${target}成功存入数据库`)
  }
}

export default FetchCustomer
