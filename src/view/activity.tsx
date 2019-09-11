import React from 'react'
import ReactDomServer from 'react-dom/server'
import TypeActivity from '~/src/type/namespace/activity'
import MActivity from '~/src/model/activity'
import TypeAuthor from '~/src/type/namespace/author'
import TypeAnswer from '~/src/type/namespace/answer'
import TypeArticle from '~/src/type/namespace/article'
import moment from 'moment'
import DATE_FORMAT from '~/src/constant/date_format'
import logger from '~/src/library/logger'
import Base from '~/src/view/base'

class Activity extends Base {
    static generateActivityElement(activityRecord: TypeActivity.Record) {
        let activityElement = (<div></div>)
        switch (activityRecord.verb) {
            case MActivity.VERB_ANSWER_VOTE_UP:
                let answerRecord: TypeAnswer.Record = activityRecord.target
                let answerElement = this.generateSingleAnswerElement(answerRecord)
                activityElement = this.generateQuestionElement(answerRecord.question, [answerElement])
                break;
            case MActivity.VERB_MEMBER_VOTEUP_ARTICLE:
                let articleRecord: TypeArticle.Record = activityRecord.target
                activityElement = this.generateSingleArticleElement(articleRecord)
                break;
            default:
        }
        return activityElement
    }

    static render(activityRecord: TypeActivity.Record) {
        let title = ''
        let pageElement = (<div></div>)
        switch (activityRecord.verb) {
            case MActivity.VERB_ANSWER_VOTE_UP:
                let answerRecord: TypeAnswer.Record = activityRecord.target
                title = answerRecord.question.title
                break;
            case MActivity.VERB_MEMBER_VOTEUP_ARTICLE:
                let articleRecord: TypeArticle.Record = activityRecord.target
                title = articleRecord.title
                break;
            default:
        }
        let activityElement = this.generateActivityElement(activityRecord)
        pageElement = this.generatePageElement(title, [activityElement])
        let content = this.renderToString(pageElement)
        return content
    }

    static renderInSinglePage(title: string, activityRecordList: Array<TypeActivity.Record>) {
        let activityElementList = []
        for (let activityRecord of activityRecordList) {
            let activityElement = this.generateActivityElement(activityRecord)
            activityElementList.push(activityElement)
        }
        let pageElement = this.generatePageElement(title, activityElementList)
        let content = this.renderToString(pageElement)
        return content
    }
}

export default Activity
