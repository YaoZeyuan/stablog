import React from 'react'
import ReactDomServer from 'react-dom/server'
import TypeWeibo from '~/src/type/namespace/weibo'
import dayjs from 'dayjs'
import DATE_FORMAT from '~/src/constant/date_format'
import logger from '~/src/library/logger'
import Base from '~/src/view/base'
import _ from 'lodash'

export default class Weibo extends Base {
  /**
   * 生成单个问题对应的react元素
   * @param mblogRecordList
   */
  private static generateSingleItemElement(mblogRecordList: Array<TypeWeibo.TypeMblog>) {
    let mblogElementList = []
    for (let mblogRecord of mblogRecordList) {
      let mblogElement = this.generateSingleWeiboElement(mblogRecord)
      mblogElementList.push(mblogElement)
    }
    return mblogElementList
  }

  static render(
    mblogList: Array<TypeWeibo.TypeMblog>,
    renderGuideLineConfig: {
      renderGuideLine: boolean
      beforeRecord?: TypeWeibo.TypeWeiboListByDay
      nextRecord?: TypeWeibo.TypeWeiboListByDay
    } = {
      renderGuideLine: false,
    },
  ) {
    // 同一列表内所有item都在同一天, 所以随便取一个就行
    let baseWeiboRecord: TypeWeibo.TypeMblog = _.get(mblogList, [0])
    let created_timestamp_at = baseWeiboRecord.created_timestamp_at as number
    let title = dayjs.unix(created_timestamp_at).format(DATE_FORMAT.DATABASE_BY_DAY)
    let mblogElementList = this.generateSingleItemElement(mblogList)

    if (renderGuideLineConfig.renderGuideLine) {
      let { beforeRecord, nextRecord } = renderGuideLineConfig
      let nextUrl = '#'
      let beforeUrl = '#'
      if (beforeRecord !== undefined) {
        let beforeCreated_timestamp_at = beforeRecord.dayStartAt
        let title = dayjs.unix(beforeCreated_timestamp_at).format(DATE_FORMAT.DATABASE_BY_DAY)
        beforeUrl = `./${title}.html`
      }
      if (nextRecord !== undefined) {
        let nextCreated_timestamp_at = nextRecord.dayStartAt
        let title = dayjs.unix(nextCreated_timestamp_at).format(DATE_FORMAT.DATABASE_BY_DAY)
        nextUrl = `./${title}.html`
      }

      /**
       * 当需要生成导航栏时, 额外加入导航栏渲染
       */
      let guideEle = this.generateFooterGuideAction({
        backUrl: beforeUrl,
        indexUrl: './index.html',
        nextUrl: nextUrl,
      })
      mblogElementList.push(guideEle)
    }

    let pageElement = this.generatePageElement(title, mblogElementList)
    return this.renderToString(pageElement)
  }

  /**
   * 将按问题分组的answer记录渲染到同一个html中
   *
   * @param title 最后生成html的标题
   * @param answerRecordList 按相同问题对答案进行分组
   */
  static renderInSinglePage(title: string, answerRecordList: Array<Array<TypeAnswer.Record>>) {
    let questionElementList = []
    for (let answerInSameQuestionRecordList of answerRecordList) {
      let questionElement = this.generateSingleItemElement(answerInSameQuestionRecordList)
      questionElementList.push(questionElement)
    }
    let pageElement = this.generatePageElement(title, questionElementList)
    return this.renderToString(pageElement)
  }
}
