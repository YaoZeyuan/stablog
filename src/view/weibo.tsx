import React from 'react'
import ReactDomServer from 'react-dom/server'
import TypeWeibo from '~/src/type/namespace/weibo'
import TypeAuthor from '~/src/type/namespace/author'
import moment from 'moment'
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
    let baseAnswerRecord: TypeAnswer.Record = _.get(mblogRecordList, [0])
    let answerElementList = []
    for (let answerRecord of mblogRecordList) {
      let answerElement = this.generateSingleAnswerElement(answerRecord)
      answerElementList.push(answerElement)
    }
    let questionElement = this.generateQuestionElement(baseAnswerRecord.question, answerElementList)
    return questionElement
  }

  static render(mblogList: Array<TypeWeibo.TypeMblog>) {
    // 都是同一个
    let baseWeiboRecord: TypeWeibo.TypeMblog = _.get(mblogList, [0])
    let created_timestamp_at = baseWeiboRecord.created_timestamp_at as number
    let title = moment.unix(created_timestamp_at).format(DATE_FORMAT.DATABASE_BY_DAY)
    let mblogListElement = this.generateSingleItemElement(mblogList)
    let pageElement = this.generatePageElement(title, [mblogListElement])
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
