import AuthorApi from '~/src/api/author'
import MAuthor from '~/src/model/author'
import Base from '~/src/command/fetch/batch/base'
import ActivityApi from '~/src/api/activity'
import MActivity from '~/src/model/activity'
import moment from 'moment'
import DATE_FORMAT from '~/src/constant/date_format'
import CommonUtil from '~/src/library/util/common'
import BatchFetchAnswer from '~/src/command/fetch/batch/answer'
import BatchFetchQuestion from '~/src/command/fetch/batch/question'
import BatchFetchColumn from '~/src/command/fetch/batch/column'
import BatchFetchArticle from './article'
import _ from 'lodash'

class BatchFetchAuthorActivity extends Base {
  async fetch(urlToken: string) {
    this.log(`开始抓取用户${urlToken}的历史活动`)
    this.log(`获取用户信息`)
    const authorInfo = await AuthorApi.asyncGetAutherInfo(urlToken)
    await MAuthor.asyncReplaceAuthor(authorInfo)
    this.log(`用户信息获取完毕`)
    const name = authorInfo.name
    this.log(`开始抓取用户行为列表`)
    let startAt = MActivity.ZHIHU_ACTIVITY_START_MONTH_AT
    this.log(`检查用户${name}(${urlToken})最近一次活跃时间`)
    let endAt = await ActivityApi.asyncGetAutherLastActivityAt(urlToken)
    this.log(`用户${name}(${urlToken})最后一次活跃于${moment.unix(endAt).format(DATE_FORMAT.DISPLAY_BY_SECOND)}`)

    this.log(`检查用户${name}(${urlToken})首次活跃时间`)
    for (let checkAt = startAt; checkAt <= endAt; ) {
      let hasActivityAfterAt = await ActivityApi.asyncCheckHasAutherActivityAfterAt(urlToken, checkAt)
      if (hasActivityAfterAt) {
        this.log(
          `经检查, 用户${name}(${urlToken})在${moment.unix(checkAt).format(DATE_FORMAT.DISPLAY_BY_SECOND)}前有活动记录`,
        )
        this.log(`检查完毕`)
        startAt = moment
          .unix(checkAt)
          .startOf(DATE_FORMAT.UNIT.MONTH)
          .unix()
        break
      } else {
        this.log(
          `经检查, 用户${name}(${urlToken})在${moment
            .unix(checkAt)
            .format(DATE_FORMAT.DISPLAY_BY_SECOND)}前没有活动记录`,
        )
        this.log(`向后推一个月, 继续检查`)
        let newCheckAt = moment
          .unix(checkAt)
          .add(1, DATE_FORMAT.UNIT.MONTH)
          .unix()
        checkAt = newCheckAt
      }
    }
    this.log(
      `用户活动时间范围为${moment.unix(startAt).format(DATE_FORMAT.DISPLAY_BY_SECOND)} ~ ${moment
        .unix(endAt)
        .format(DATE_FORMAT.DISPLAY_BY_SECOND)}, 按照该范围按月抓取`,
    )
    for (let fetchAt = startAt; startAt <= fetchAt && fetchAt <= endAt; ) {
      let fetchStartAt = fetchAt
      let fetchEndAt = moment
        .unix(fetchAt)
        .endOf(DATE_FORMAT.UNIT.MONTH)
        .unix()
      fetchAt = fetchEndAt + 1
      await CommonUtil.asyncAppendPromiseWithDebounce(this.fetchActivityInRange(urlToken, fetchStartAt, fetchEndAt))
    }
    await CommonUtil.asyncDispatchAllPromiseInQueen()
    this.log(`用户${name}(${urlToken})活动记录抓取完毕`)

    this.log(`抓取用户${name}(${urlToken})赞同过的所有回答`)
    let allAgreeAnswerIdList = await MActivity.asyncGetAllActivityTargetIdList(urlToken, MActivity.VERB_ANSWER_VOTE_UP)
    let batchFetchAnswer = new BatchFetchAnswer()
    await batchFetchAnswer.fetchListAndSaveToDb(allAgreeAnswerIdList)
    this.log(`用户${name}(${urlToken})赞同过的所有回答抓取完毕`)
    this.log(`抓取用户${name}(${urlToken})赞同过的所有文章`)
    let allAgreeArticleIdList = await MActivity.asyncGetAllActivityTargetIdList(
      urlToken,
      MActivity.VERB_MEMBER_VOTEUP_ARTICLE,
    )
    let batchFetchArticle = new BatchFetchArticle()
    await batchFetchArticle.fetchListAndSaveToDb(allAgreeArticleIdList)
    this.log(`用户${name}(${urlToken})赞同过的所有文章抓取完毕`)
    this.log(`抓取用户${name}(${urlToken})关注过的所有问题`)
    let allFollowQustionIdList = await MActivity.asyncGetAllActivityTargetIdList(
      urlToken,
      MActivity.VERB_QUESTION_FOLLOW,
    )
    let batchFetchQuestion = new BatchFetchQuestion()
    await batchFetchQuestion.fetchListAndSaveToDb(allFollowQustionIdList)
    this.log(`用户${name}(${urlToken})关注过的所有问题抓取完毕`)
  }

  /**
   * 抓取指定时间范围内的用户活动记录
   * @param urlToken
   * @param startAt
   * @param endAt
   */
  private async fetchActivityInRange(urlToken: string, startAt: number, endAt: number) {
    let rangeString = `${moment.unix(startAt).format(DATE_FORMAT.DISPLAY_BY_DAY)} ~ ${moment
      .unix(endAt)
      .format(DATE_FORMAT.DISPLAY_BY_DAY)}`
    this.log(`抓取时间范围为:${rangeString}内的记录`)
    let activityCounter = 0
    for (let fetchAt = endAt; startAt <= fetchAt && fetchAt <= endAt; ) {
      this.log(`[${rangeString}]抓取${moment.unix(fetchAt).format(DATE_FORMAT.DISPLAY_BY_SECOND)}的记录`)
      let activityList = await ActivityApi.asyncGetAutherActivityList(urlToken, fetchAt)
      if (activityList.length === 0) {
        // 没有这段时间的记录或者接口调用失败, 自动往前挪一天
        fetchAt = fetchAt - 86400
        continue
      }
      for (let activityRecord of activityList) {
        activityCounter = activityCounter + 1
        // 更新时间(id是毫秒值)
        fetchAt = Number.parseInt(activityRecord.id / 1000)
        if (_.isNumber(fetchAt) === false) {
          fetchAt = 0
        }
        await MActivity.asyncReplaceActivity(activityRecord)
      }
    }
    this.log(`[${rangeString}]${rangeString}期间的记录抓取完毕, 共${activityCounter}条`)
  }
}

export default BatchFetchAuthorActivity
