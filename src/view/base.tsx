import React from 'react'
import ReactDomServer from 'react-dom/server'
import TypeAnswer from '~/src/type/namespace/answer'
import TypeWeibo, { TypeWeiboListByDay } from '~/src/type/namespace/weibo'
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

  static renderIndex(bookname: string, recordList: Array<TypeWeiboListByDay>) {
    let indexList: Array<React.ReactElement<any>> = []
    for (let record of recordList) {
      let indexItem = (
        <li key={CommonUtil.getUuid()}>
          <a className="list-group-item" href={`./${record.dayStartAtStr}.html`}>
            {record.dayStartAtStr}
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

  /**
   * 生成单个回答的Element(只有回答, 不包括问题)
   * @param mblog
   */
  static generateSingleWeiboElement(mblog: TypeWeibo.TypeMblog) {
    if (_.isEmpty(mblog)) {
      return <div key={CommonUtil.getUuid()} />
    }
    function generateMlogRecord(mblog: TypeWeibo.TypeMblog) {
      let mblogEle = null
      if (mblog) {
        let mblogPictureList = []
        if (mblog.pics) {
          let picIndex = 0
          for (let picture of mblog.pics) {
            let picEle = (
              <li key={picIndex} className="m-auto-box">
                <div className="m-img-box m-imghold-square">
                  <img src={picture.large.url} />
                </div>
              </li>
            )
            mblogPictureList.push(picEle)
          }
        }
        mblogEle = (
          <div className="weibo-rp">
            <div className="weibo-text">
              <span>
                <a href={mblog.user.profile_url}>@{mblog.user.screen_name}</a>:
              </span>
              <div>{mblog.text}</div>
            </div>
            <div>
              {/* 如果是图片的话, 需要展示九张图 */}
              <div className="weibo-media-wraps weibo-media media-b">
                <ul className="m-auto-list">{mblogPictureList}</ul>
              </div>
            </div>
          </div>
        )
      }
      return mblogEle
    }
    let retweetEle = null
    if (mblog.retweeted_status !== undefined) {
      retweetEle = generateMlogRecord(mblog.retweeted_status)
    }

    const mblogElement = (
      <div key={CommonUtil.getUuid()}>
        <div className="card m-panel card9 weibo-member card-vip">
          <div className="card-wrap">
            <div className="card-main">
              {/*以下html结构整理自微博m站*/}
              {/*用户头像*/}
              <header className="weibo-top m-box m-avatar-box" />
              <a className="m-img-box">
                <img src={mblog.user.avatar_hd} />
                <i className="m-icon m-icon-goldv-static" />
              </a>
              <div className="m-box-col m-box-dir m-box-center">
                <div className="m-text-box">
                  <a>
                    <h3 className="m-text-cut">{mblog.user.screen_name}</h3>
                  </a>
                  <h4 className="m-text-cut">
                    <span className="time">
                      {moment.unix(mblog.created_timestamp_at as number).format(DATE_FORMAT.DISPLAY_BY_DAY)}
                    </span>
                  </h4>
                </div>
              </div>
              {/*微博正文*/}
              {/*转发文字*/}
              <article className="weibo-main">
                <div className="weibo-og">
                  <div className="weibo-text">
                    {/* 微博评论内容 */}
                    {mblog.text}
                  </div>
                </div>
                {/* 所转发的微博 */}
                {retweetEle}
              </article>
              <footer className="m-ctrl-box m-box-center-a">
                <div className="m-diy-btn m-box-col m-box-center m-box-center-a">
                  <i className="m-font m-font-forward"></i>
                  {/* 转发数 */}
                  <h4>{mblog.reposts_count}</h4>
                </div>
                <span className="m-line-gradient"></span>
                <div className="m-diy-btn m-box-col m-box-center m-box-center-a">
                  <i className="m-font m-font-comment"></i>
                  {/* 评论数 */}
                  <h4>{mblog.comments_count}</h4>
                </div>
                <span className="m-line-gradient"></span>
                <div className="m-diy-btn m-box-col m-box-center m-box-center-a">
                  <i className="m-icon m-icon-like"></i>
                  {/* 点赞数 */}
                  <h4>{mblog.attitudes_count}</h4>
                </div>
              </footer>
            </div>
          </div>
        </div>
        <hr />
      </div>
    )
    return mblogElement
  }

  static renderToString(contentElement: React.ReactElement<any>) {
    return ReactDomServer.renderToString(contentElement)
  }
}
export default Base
