import React from 'react'
import ReactDomServer from 'react-dom/server'
import TypeArticle from '~/src/type/namespace/article'
import TypeColumn from '~/src/type/namespace/column'
import moment from 'moment'
import DATE_FORMAT from '~/src/constant/date_format'
import logger from '~/src/library/logger'
import Base from '~/src/view/base'

class Column extends Base {
    static render(articleRecord: TypeArticle.Record) {
        // 都是同一个
        let title = articleRecord.title
        let articleElement = this.generateSingleArticleElement(articleRecord)
        let pageElement = this.generatePageElement(title, [articleElement])
        return this.renderToString(pageElement)
    }

    /**
     * 将所有文章渲染到同一个html中
     * 
     * @param title 最后生成html的标题
     * @param articleRecordList 文章列表 
     */
    static renderInSinglePage(title: string, articleRecordList: Array<TypeArticle.Record>) {
        let articleElementList = []
        for (let articleRecord of articleRecordList) {
            let articleElement = this.generateSingleArticleElement(articleRecord)
            articleElementList.push(articleElement)
        }
        let pageElement = this.generatePageElement(title, articleElementList)
        return this.renderToString(pageElement)
    }
}

export default Column
