import WeiboApi from '~/src/api/weibo'
import MMblog from '~/src/model/mblog'
import _ from 'lodash'
import Base from '~/src/command/fetch/batch/base'

export default class BatchFetchMblog extends Base {
  /**
   * 获取单个回答,并存入数据库中
   * @param answerId
   */
  async fetch(containerId: string, pageType: string, page: number, totalPage: string) {
    let target = `第${page}/${totalPage}页微博记录`
    this.log(`准备抓取${target}`)
    let mblogList = await WeiboApi.asyncGetWeiboList(containerId, pageType, page)
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
