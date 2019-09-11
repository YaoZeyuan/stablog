import React from 'react'
import ReactDomServer from 'react-dom/server'
import TypeAnswer from '~/src/type/namespace/answer'
import TypeAuthor from '~/src/type/namespace/author'
import TypeActivity from '~/src/type/namespace/activity'
import TypeArticle from '~/src/type/namespace/article'
import TypeColumn from '~/src/type/namespace/column'
import TypePin from '~/src/type/namespace/pin'
import CommonUtil from '~/src/library/util/common'
import moment from 'moment'
import _ from 'lodash'
import DATE_FORMAT from '~/src/constant/date_format'
import Logger from '~/src/library/logger'

class CommentCompontent extends React.Component<
  {
    agreeCount: number
    commentCount: number
    createAt: number
    updateAt: number
  },
  {}
> {
  render() {
    return (
      <div className="comment">
        <div className="info-flex-line">
          <span className="float-left">赞同:{this.props.agreeCount}</span>
          <span className="float-right">
            创建时间:{moment.unix(this.props.createAt).format(DATE_FORMAT.DATABASE_BY_DAY)}
          </span>
        </div>
        <div className="clear-float" />
        <div className="info-flex-line">
          <span className="float-left">评论:{this.props.commentCount}</span>
          <span className="float-right">
            最后更新:{moment.unix(this.props.updateAt).format(DATE_FORMAT.DATABASE_BY_DAY)}
          </span>
        </div>
      </div>
    )
  }
}

class Base {
  static getPinTitle(record: TypePin.Record) {
    let title = ''
    // 想法
    // 根据是否存在repin字段, 可以分为转发/非转发两种类型
    if (_.isEmpty(record.repin)) {
      let pinRecord: TypePin.DefaultRecord = record
      title = `${moment.unix(pinRecord.created).format(DATE_FORMAT.DISPLAY_BY_DAY)}:${pinRecord.excerpt_title}`
    } else {
      let repinRecord: TypePin.RepinRecord = record
      title = `${moment.unix(repinRecord.created).format(DATE_FORMAT.DISPLAY_BY_DAY)}:${repinRecord.excerpt_title}:${
        repinRecord.repin.excerpt_title
      }`
    }
    return title
  }

  static renderIndex(
    bookname: string,
    recordList: Array<TypeAnswer.Record | TypeArticle.Record | TypeActivity.Record | TypePin.Record>,
  ) {
    let indexList: Array<React.ReactElement<any>> = []
    for (let record of recordList) {
      let id = 0
      let title = ''
      // 判断数据类别
      if (_.has(record, ['target'])) {
        // activity类
        if (_.has(record, ['target', 'question'])) {
          let answerActivityRecord: TypeActivity.AnswerVoteUpActivityRecord = record
          id = answerActivityRecord.target.question.id
          title = answerActivityRecord.target.question.title
        } else if (_.has(record, ['target', 'column'])) {
          let articleActivityRecord: TypeActivity.ArticleVoteUpActivityRecord = record
          id = articleActivityRecord.id
          title = articleActivityRecord.target.title
        } else {
          Logger.warn(`出现了未能识别的活动记录类型, 自动跳过`)
          Logger.warn(`请在知乎上联系@姚泽源 进行反馈`)
        }
      } else {
        if (_.has(record, ['question'])) {
          // 问题
          let answerRecord: TypeAnswer.Record = record
          id = answerRecord.question.id
          title = answerRecord.question.title
        } else if (_.has(record, ['column'])) {
          let articleRecord: TypeArticle.Record = record
          id = articleRecord.id
          title = articleRecord.title
        } else {
          // 想法
          id = record.id
          title = Base.getPinTitle(record)
        }
      }

      let indexItem = (
        <li key={CommonUtil.getUuid()}>
          <a className="list-group-item" href={`./${id}.html`}>
            {title}
          </a>
        </li>
      )
      indexList.push(indexItem)
    }

    const indexTableElement = (
      <div className="panel panel-success center-block">
        <div className="panel-heading">{bookname}</div>
        <div className="list-group">
          <ol>{indexList}</ol>
        </div>
      </div>
    )

    const pageElement = this.generatePageElement(bookname, [indexTableElement])
    let content = this.renderToString(pageElement)
    return content
  }

  /**
   * 生成单个回答的Element(只有回答, 不包括问题)
   * @param answerRecord
   */
  static generateSingleAnswerElement(answerRecord: TypeAnswer.Record) {
    if (_.isEmpty(answerRecord)) {
      return <div key={CommonUtil.getUuid()} />
    }
    const answer = (
      <div key={CommonUtil.getUuid()}>
        <div className="answer">
          <div className="author">
            <div className="author-info">
              <div className="author-base">
                <div className="author-logo">
                  <img src={answerRecord.author.avatar_url} width="25" height="25" />
                </div>

                <span className="author-name">
                  <a href={`http://www.zhihu.com/people/${answerRecord.author.id}`}>{answerRecord.author.name}</a>
                </span>

                <span className="author-sign">
                  {answerRecord.author.headline ? '　' + answerRecord.author.headline : ''}
                </span>
              </div>

              <div className="clear-float" />
            </div>
          </div>

          <div className="content">
            <div dangerouslySetInnerHTML={{ __html: answerRecord.content }} />
          </div>

          <CommentCompontent
            agreeCount={answerRecord.voteup_count}
            commentCount={answerRecord.comment_count}
            createAt={answerRecord.created_time}
            updateAt={answerRecord.updated_time}
          />
        </div>

        <hr />
      </div>
    )
    return answer
  }

  /**
   * 生成问题对应的Element
   * @param questionRecord
   * @param answerElementList
   */
  static generateQuestionElement(
    questionRecord: TypeAnswer.Question,
    answerElementList: Array<React.ReactElement<any>> = [],
  ) {
    if (_.isEmpty(questionRecord)) {
      return <div key={CommonUtil.getUuid()} />
    }
    const question = (
      <div key={CommonUtil.getUuid()}>
        <div className="bg-zhihu-blue-light">
          <div className="title-image" />
          <div className="question bg-zhihu-blue-light">
            <div className="question-title">
              <h1 className="bg-zhihu-blue-deep">{questionRecord.title}</h1>
            </div>
            <div className="clear-float" />
          </div>
          <div
            className="question-info bg-zhihu-blue-light"
            data-comment="知乎对外接口中没有问题描述数据, 因此直接略过"
          />
          <div className="clear-float" />
        </div>
        <div className="answer">{answerElementList}</div>
      </div>
    )
    return question
  }

  /**
   * 生成单篇文章的Element
   * @param articleRecord
   */
  static generateSingleArticleElement(articleRecord: TypeArticle.Record) {
    if (_.isEmpty(articleRecord)) {
      return <div key={CommonUtil.getUuid()} />
    }
    const content = (
      <div key={CommonUtil.getUuid()}>
        <div className="answer">
          <div className="author">
            <div className="author-info">
              <div className="author-base">
                <div className="author-logo">
                  <img src={articleRecord.author.avatar_url} width="25" height="25" />
                </div>

                <span className="author-name">
                  <a href={`http://www.zhihu.com/people/${articleRecord.author.id}`}>{articleRecord.author.name}</a>
                </span>
                <span className="author-sign">
                  {articleRecord.author.headline ? '　' + articleRecord.author.headline : ''}
                </span>
              </div>

              <div className="clear-float" />
            </div>
          </div>

          <div className="content">
            <div dangerouslySetInnerHTML={{ __html: articleRecord.content }} />
          </div>

          <CommentCompontent
            agreeCount={articleRecord.voteup_count}
            commentCount={articleRecord.comment_count}
            createAt={articleRecord.created}
            updateAt={articleRecord.updated}
          />
        </div>

        <hr />
      </div>
    )
    const article = (
      <div data-key="single-page" key={CommonUtil.getUuid()}>
        <div className="bg-zhihu-blue-light">
          <div className="title-image">
            {/* 不展示头图, 样式不好看 */}
            {/* <img src={articleRecord.title_image}></img> */}
          </div>
          <div className="question bg-zhihu-blue-light">
            <div className="question-title">
              <h1 className="bg-zhihu-blue-deep">{articleRecord.title}</h1>
            </div>
            <div className="clear-float" />
          </div>
          <div
            className="question-info bg-zhihu-blue-light"
            data-comment="知乎对外接口中没有问题描述数据, 因此直接略过"
          />
          <div className="clear-float" />
        </div>
        <div className="answer">{content}</div>
      </div>
    )
    return article
  }

  /**
   * 生成单条想法的Element
   * @param rawPinRecord
   */
  static generateSinglePinElement(rawPinRecord: TypePin.Record) {
    if (_.isEmpty(rawPinRecord)) {
      return <div key={CommonUtil.getUuid()} />
    }
    // 想法
    let title = Base.getPinTitle(rawPinRecord)
    let contentHtmlElement = <div />
    if (_.isEmpty(rawPinRecord.repin)) {
      let defaultPinRecord: TypePin.DefaultRecord = rawPinRecord
      contentHtmlElement = (
        <div className="pin">
          <div className="commment">
            <div dangerouslySetInnerHTML={{ __html: defaultPinRecord.content_html }} />
          </div>
          <div className="origin-pin" />
        </div>
      )
    } else {
      let repinRecord: TypePin.RepinRecord = rawPinRecord
      contentHtmlElement = (
        <div className="pin repin">
          <div className="commment">
            <div dangerouslySetInnerHTML={{ __html: repinRecord.content_html }} />
          </div>
          <div className="origin-pin">
            <div dangerouslySetInnerHTML={{ __html: repinRecord.repin.content_html }} />
          </div>
        </div>
      )
    }

    const content = (
      <div key={CommonUtil.getUuid()}>
        <div className="answer">
          <div className="author">
            <div className="author-info">
              <div className="author-base">
                <div className="author-logo">
                  <img src={rawPinRecord.author.avatar_url} width="25" height="25" />
                </div>

                <span className="author-name">
                  <a href={`http://www.zhihu.com/people/${rawPinRecord.author.id}`}>{rawPinRecord.author.name}</a>
                </span>
                <span className="author-sign">
                  {rawPinRecord.author.headline ? '　' + rawPinRecord.author.headline : ''}
                </span>
              </div>

              <div className="clear-float" />
            </div>
          </div>

          <div className="content">
            <div>{contentHtmlElement}</div>
          </div>

          <CommentCompontent
            agreeCount={rawPinRecord.like_count}
            commentCount={rawPinRecord.comment_count}
            createAt={rawPinRecord.created}
            updateAt={rawPinRecord.updated}
          />
        </div>

        <hr />
      </div>
    )
    const pin = (
      <div data-key="single-page" key={CommonUtil.getUuid()}>
        <div className="bg-zhihu-blue-light">
          <div className="title-image">
            {/* 不展示头图, 样式不好看 */}
            {/* <img src={articleRecord.title_image}></img> */}
          </div>
          <div className="question bg-zhihu-blue-light">
            <div className="question-title">
              <h1 className="bg-zhihu-blue-deep">{title}</h1>
            </div>
            <div className="clear-float" />
          </div>
          <div
            className="question-info bg-zhihu-blue-light"
            data-comment="知乎对外接口中没有问题描述数据, 因此直接略过"
          />
          <div className="clear-float" />
        </div>
        <div className="answer">{content}</div>
      </div>
    )
    return pin
  }

  static generatePageElement(title: string, contentElementList: Array<React.ReactElement<any>>) {
    return (
      <html xmlns="http://www.w3.org/1999/xhtml">
        <head>
          <meta charSet="utf-8" />
          <title>{title}</title>
          <link rel="stylesheet" type="text/css" href="../css/normalize.css" />
          <link rel="stylesheet" type="text/css" href="../css/markdown.css" />
          <link rel="stylesheet" type="text/css" href="../css/customer.css" />
          <link rel="stylesheet" type="text/css" href="../css/bootstrap.css" />
        </head>
        <body>{contentElementList}</body>
      </html>
    )
  }

  static renderToString(contentElement: React.ReactElement<any>) {
    return ReactDomServer.renderToString(contentElement)
  }
}
export default Base
