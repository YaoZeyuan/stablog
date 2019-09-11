import Base from '~/src/model/base'
import TypeAuthor from '~/src/type/namespace/author'
import _ from 'lodash'

class AuthorAskQuestion extends Base {
  static TABLE_NAME = `Author_Ask_Question`
  static TABLE_COLUMN = [`question_id`, `author_url_token`, `author_id`, `raw_json`]

  /**
   * 从数据库中获取用户提问的问题id列表
   * @param urlToken
   */
  static async asyncGetAuthorAskQuestionIdList(urlToken: string): Promise<Array<string>> {
    let recordList = await this.db
      .select(`question_id`)
      .from(this.TABLE_NAME)
      .where('author_url_token', '=', urlToken)
      .catch(() => {
        return []
      })

    let questionIdList = []
    for (let record of recordList) {
      let questionId: string = _.get(record, ['question_id'], '')
      if (questionId === '') {
        continue
      }
      questionIdList.push(questionId)
    }
    return questionIdList
  }

  /**
   * 存储用户提问记录
   * @param authorQuestionRecord
   */
  static async asyncReplaceAuthorQuestion(author_url_token: string, author_id: string, authorQuestionRecord: TypeAuthor.Question): Promise<void> {
    let question_id = authorQuestionRecord.id
    let raw_json = JSON.stringify(authorQuestionRecord)
    await this.replaceInto({
      question_id,
      author_url_token,
      author_id,
      raw_json,
    })
    return
  }
}

export default AuthorAskQuestion
