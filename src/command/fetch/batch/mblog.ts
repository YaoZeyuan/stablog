import WeiboApi from '~/src/api/weibo'
import MTotalAnswer from '~/src/model/total_answer'
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
    await MTotalAnswer.asyncReplaceAnswer(answer)
    this.log(`${target}成功存入数据库`)
  }
}
