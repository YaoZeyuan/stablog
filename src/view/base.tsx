import React from 'react'
import ReactDomServer from 'react-dom/server'
import TypeWeibo, { TypeWeiboListByDay } from '~/src/type/namespace/weibo'
import CommonUtil from '~/src/library/util/common'
import dayjs from 'dayjs'
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
            创建时间:{dayjs.unix(this.props.createAt).format(DATE_FORMAT.DATABASE_BY_DAY)}
          </span>
        </div>
        <div className="clear-float" />
        <div className="info-flex-line">
          <span className="float-left">评论:{this.props.commentCount}</span>
          <span className="float-right">
            最后更新:{dayjs.unix(this.props.updateAt).format(DATE_FORMAT.DATABASE_BY_DAY)}
          </span>
        </div>
      </div>
    )
  }
}

class Base {
  static renderIndex(bookname: string, recordList: Array<TypeWeiboListByDay>) {
    let indexList: Array<React.ReactElement<any>> = []
    for (let record of recordList) {
      let indexItem = (
        <li key={CommonUtil.getUuid()}>
          <a className="list-group-item" href={`./${record.title}.html`}>
            {record.title}
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
        <body>
          <div className="container">{contentElementList}</div>
        </body>
      </html>
    )
  }

  /**
   * 生成单个微博的Element
   * @param mblog
   */
  static generateSingleWeiboElement(mblog: TypeWeibo.TypeMblog) {
    if (_.isEmpty(mblog)) {
      return <div key={CommonUtil.getUuid()} />
    }
    function generateMlogRecord(mblog: TypeWeibo.TypeMblog) {
      let mblogEle = null
      if (!mblog) {
        // blog记录不存在, 直接返回即可
        return mblogEle
      }
      if (mblog.state === 7 || mblog.state === 8 || _.isEmpty(mblog.user) === true) {
        // 微博不可见(已被删除/半年内可见/主动隐藏/etc)
        mblogEle = (
          <div className="weibo-rp">
            <div className="weibo-text">
              <span>
                <a>---</a>:
              </span>
              {/* <div>${mblog.text}</div> */}
              <span dangerouslySetInnerHTML={{ __html: `${mblog.text}` }} />
            </div>
            <div>
              {/* 如果是图片的话, 需要展示九张图 */}
              <div className="weibo-media-wraps weibo-media media-b">
                <ul className="m-auto-list" />
              </div>
            </div>
          </div>
        )
        return mblogEle
      }
      let articleRecord = mblog.article
      let articleElement = null
      if (articleRecord) {
        // 渲染文章元素
        let isExistCoverImg = articleRecord?.cover_img?.image?.url
        let coverImgEle = isExistCoverImg ? (
          <div className="main_toppic">
            <div className="picbox">
              <img node-type="articleHeaderPic" src={articleRecord?.cover_img?.image?.url} />
            </div>
          </div>
        ) : null
        articleElement = (
          <div className="WB_artical">
            <div className="article-split-line"></div>
            {coverImgEle}
            <div className="main_editor " node-type="articleContent">
              <div className="title" node-type="articleTitle">
                {articleRecord.title}
              </div>
              <div className="art-line"></div>
              <div className="WB_editor_iframe_new" node-type="contentBody">
                {/* 正文 */}
                <div className="article-content" dangerouslySetInnerHTML={{ __html: articleRecord.content }} />
                <div className="DCI_v2 clearfix" />
              </div>
            </div>
          </div>
        )
      }
      // 正常微博
      let mblogPictureList = []
      if (mblog?.pics?.length > 0) {
        // 是否有图片
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
      let videoEle = null
      if (mblog?.page_info?.type === 'video') {
        let imgUrl = mblog?.page_info?.page_pic?.url || ''
        let during_s = mblog?.page_info?.media_info?.duration || 0
        let during_str = CommonUtil.seconds2DuringStr(during_s)
        videoEle = (
          <div className="weibo-video-container">
            <div className="video-img-container">
              <img src={imgUrl} className="video-img"></img>
            </div>
            <div className="video-info-container">
              <div className="card-video_plusInfo"> {mblog?.page_info?.play_count} </div>
              <div className="card-video_during">{during_str}</div>
            </div>
          </div>
        )
      }

      mblogEle = (
        <div className="weibo-rp">
          <div className="weibo-text">
            <span>
              <a href={mblog.user.profile_url}>@{mblog.user.screen_name}</a>:
            </span>
            <div dangerouslySetInnerHTML={{ __html: `${mblog.text}` }} />
            {/* <div>${mblog.text}</div> */}
          </div>
          <div className="weibo-img-list-container">
            {/* 如果是图片的话, 需要展示九张图 */}
            <div className="weibo-media-wraps weibo-media media-b">
              <ul className="m-auto-list">{mblogPictureList}</ul>
            </div>
          </div>
          {/* 视频内容 */}
          {videoEle}
          <div className="weibo-article-container">
            {/* 文章内容 */}
            {articleElement}
          </div>
        </div>
      )
      return mblogEle
    }
    let retweetEle = null
    if (_.isEmpty(mblog.retweeted_status) === false) {
      retweetEle = generateMlogRecord(mblog.retweeted_status!)
    }

    let articleRecord = mblog.article
    let articleElement = null
    if (articleRecord) {
      // 渲染文章元素
      let isExistCoverImg = articleRecord?.cover_img?.image?.url
      let coverImgEle = isExistCoverImg ? (
        <div className="main_toppic">
          <div className="picbox">
            <img node-type="articleHeaderPic" src={articleRecord?.cover_img?.image?.url} />
          </div>
        </div>
      ) : null
      articleElement = (
        <div className="WB_artical">
          <div className="article-split-line"></div>
          {coverImgEle}
          <div className="main_editor " node-type="articleContent">
            <div className="title" node-type="articleTitle">
              {articleRecord.title}
            </div>
            <div className="art-line"></div>
            <div className="WB_editor_iframe_new" node-type="contentBody">
              {/* 正文 */}
              <div className="article-content" dangerouslySetInnerHTML={{ __html: articleRecord.content }} />
              <div className="DCI_v2 clearfix" />
            </div>
          </div>
        </div>
      )
    }
    // 正常微博
    let mblogPictureList = []
    if (mblog?.pics?.length > 0) {
      // 是否有图片
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

    let videoEle = null
    if (mblog?.page_info?.type === 'video') {
      let imgUrl = mblog?.page_info?.page_pic?.url || ''
      let during_s = mblog?.page_info?.media_info?.duration || 0
      let during_str = CommonUtil.seconds2DuringStr(during_s)
      videoEle = (
        <div className="weibo-video-container">
          <div className="video-img-container">
            <img src={imgUrl} className="video-img"></img>
          </div>
          <div className="video-info-container">
            <div className="card-video_plusInfo"> {mblog?.page_info?.play_count} </div>
            <div className="card-video_during">{during_str}</div>
          </div>
        </div>
      )
    }

    let mblogElement = (
      <div key={CommonUtil.getUuid()} className="mblog-container">
        <div className="card m-panel card9 weibo-member card-vip">
          <div className="card-wrap">
            <div className="card-main">
              {/*以下html结构整理自微博m站*/}
              {/*用户头像*/}
              <header className="weibo-top m-box m-avatar-box">
                <a className="m-img-box">
                  <img src={mblog.user.avatar_hd} />
                  <i className="m-icon m-icon-goldv-static" />
                </a>
                <div className="m-box-col m-box-dir m-box-center">
                  <div className="m-text-box">
                    <a>
                      <h3 className="m-text-cut">
                        {mblog.user.screen_name} <i className="m-icon m-icon-vipl7"></i>
                      </h3>
                    </a>
                    <h4 className="m-text-cut">
                      <span className="time">
                        {dayjs.unix(mblog.created_timestamp_at as number).format(DATE_FORMAT.DISPLAY_BY_DAY)}
                      </span>
                    </h4>
                  </div>
                </div>
              </header>
              {/*微博正文*/}
              {/*转发文字*/}
              <article className="weibo-main">
                <div className="weibo-og">
                  <div className="weibo-text" dangerouslySetInnerHTML={{ __html: `${mblog.text}` }}>
                    {/* 微博评论内容 */}
                  </div>
                </div>
                {/* 所发布九图内容 */}
                <div className="weibo-img-list-container">
                  <div className="weibo-media-wraps weibo-media media-b">
                    <ul className="m-auto-list">{mblogPictureList}</ul>
                  </div>
                </div>
                {/* 视频内容 */}
                {videoEle}
                {/* 所发布文章内容 */}
                <div className="weibo-article-container">{articleElement}</div>
                {/* 所转发的微博 */}
                {retweetEle}
              </article>
              <footer className="m-ctrl-box m-box-center-a">
                <div className="m-diy-btn m-box-col m-box-center m-box-center-a m-box-center-retweet">
                  <i className="m-font m-font-forward lite-iconf lite-iconf-report" />
                  {/* 转发数 */}
                  <h4>{mblog.reposts_count}</h4>
                </div>
                <span className="m-line-gradient" />
                <div className="m-diy-btn m-box-col m-box-center m-box-center-a m-box-center-comment">
                  <i className="m-font m-font-comment  lite-iconf lite-iconf-comments" />
                  {/* 评论数 */}
                  <h4>{mblog.comments_count}</h4>
                </div>
                <span className="m-line-gradient" />
                <div className="m-diy-btn m-box-col m-box-center m-box-center-a m-box-center-agree">
                  <i className="m-icon m-icon-like lite-iconf lite-iconf-like" />
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

  /**
   * 生成页面底部的导航action
   * @returns
   */
  static generateFooterGuideAction(
    param: {
      backUrl: string
      nextUrl: string
      indexUrl: string
    } = {
      backUrl: '#',
      nextUrl: '#',
      indexUrl: '#',
    },
  ) {
    return (
      <div key="footer-guide">
        <div className="footer-container">
          <div className={`action action-go-back ${param.backUrl === '#' ? 'action-disable' : ''}`}>
            <a href={param.backUrl || '#'}>上一页</a>
          </div>
          <span className="gradient"></span>
          <div className="action action-go-category">
            <a href={param.indexUrl || '#'}>目录</a>
          </div>
          <span className="gradient"></span>
          <div className={`action action-go-next ${param.nextUrl === '#' ? 'action-disable' : ''}`}>
            <a href={param.nextUrl || '#'}>下一页</a>
          </div>
        </div>
        <div className="footer-container-placeholder"></div>
      </div>
    )
  }

  static renderToString(contentElement: React.ReactElement<any>) {
    return ReactDomServer.renderToString(contentElement)
  }
}
export default Base
