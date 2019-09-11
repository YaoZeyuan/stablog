import _ from 'lodash'
import Base from '~/src/api/base'
import TypeTopic from '~/src/type/namespace/topic'
import TypeAnswer from '~/src/type/namespace/answer'

class Topic extends Base {
  /**
   * 获取话题下回答列表
   * @param offset
   * @param limit
   */
  static async asyncGetAnswerList(topicId: number, offset: number = 0, limit: number = 20): Promise<Array<TypeAnswer.Record>> {
    const baseUrl = `https://www.zhihu.com/api/v4/topics/${topicId}/feeds/essence`
    const config = {
      include: `data[?(target.type=topic_sticky_module)].target.data[?(target.type=answer)].target.content,relationship.is_authorized,is_author,voting,is_thanked,is_nothelp;data[?(target.type=topic_sticky_module)].target.data[?(target.type=answer)].target.is_normal,comment_count,voteup_count,content,relevant_info,excerpt.author.badge[?(type=best_answerer)].topics;data[?(target.type=topic_sticky_module)].target.data[?(target.type=article)].target.content,voteup_count,comment_count,voting,author.badge[?(type=best_answerer)].topics;data[?(target.type=topic_sticky_module)].target.data[?(target.type=people)].target.answer_count,articles_count,gender,follower_count,is_followed,is_following,badge[?(type=best_answerer)].topics;data[?(target.type=answer)].target.annotation_detail,content,hermes_label,is_labeled,relationship.is_authorized,is_author,voting,is_thanked,is_nothelp;data[?(target.type=answer)].target.author.badge[?(type=best_answerer)].topics;data[?(target.type=article)].target.annotation_detail,content,hermes_label,is_labeled,author.badge[?(type=best_answerer)].topics;data[?(target.type=question)].target.annotation_detail,comment_count;`,
      offset: offset,
      limit: limit,
    }
    const record = await Base.http.get(baseUrl, {
      params: config
    })
    const rawTopicAnswerList = _.get(record, ['data'], [])
    let answerList = []
    for (let rawTopicAnswer of rawTopicAnswerList) {
      answerList.push(rawTopicAnswer.target)
    }
    return answerList
  }

  /**
   * 获取话题信息
   * @param topicId 
   */
  static async asyncGetTopicInfo(topicId: number | string): Promise<TypeTopic.Info> {
    const baseUrl = `https://www.zhihu.com/api/v4/topics/${topicId}`
    const config = {
    }
    const topicInfoRecord: TypeTopic.Info = await Base.http.get(baseUrl, {
      params: config
    })
    return topicInfoRecord
  }
}
export default Topic
