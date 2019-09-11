import CollectionApi from '~/src/api/collection'
import MCollection from '~/src/model/collection'
import Base from '~/src/command/fetch/batch/base'
import CommonUtil from '~/src/library/util/common'
import BatchFetchAnswer from '~/src/command/fetch/batch/answer'

class BatchFetchCollection extends Base {
  async fetch(id: string) {
    this.log(`开始抓取收藏夹${id}内的回答`)
    this.log(`获取收藏夹信息`)
    const collectionInfo = await CollectionApi.asyncGetCollectionInfo(id)
    await MCollection.asyncReplaceColumnInfo(collectionInfo)
    let answerCount = collectionInfo.answer_count
    this.log(`话题${collectionInfo.title}(${collectionInfo.id})信息获取完毕, 共有回答${answerCount}个`)

    let answerIdList: Array<string> = []
    let batchFetchAnswer = new BatchFetchAnswer()
    this.log(`开始抓取回答列表`)
    for (let offset = 0; offset < answerCount; offset = offset + this.max) {
      await CommonUtil.asyncAppendPromiseWithDebounce(this.asyncGetCollectionAnswerList(id, offset, answerIdList))
      this.log(`将抓取第${offset}~${offset + this.max}个回答任务添加到任务队列中`)
    }
    await CommonUtil.asyncDispatchAllPromiseInQueen()
    this.log(`全部回答列表抓取完毕`)

    this.log(`开始抓取收藏夹${collectionInfo.title}(${collectionInfo.id})的下所有回答,共${answerIdList.length}条`)
    await batchFetchAnswer.fetchListAndSaveToDb(answerIdList)
    this.log(`收藏夹${collectionInfo.title}(${collectionInfo.id})下所有回答抓取完毕`)
  }

  private async asyncGetCollectionAnswerList(id: number, offset: number, answerIdList: Array<string>) {
    let answerList = await CollectionApi.asyncGetAnswerExcerptList(id, offset, this.max)
    for (let answer of answerList) {
      // 传递给外部
      answerIdList.push(`${answer.id}`)
      await MCollection.asyncReplaceColumnAnswerExcerpt(id, answer).catch(e => {
        console.log('catch error')
        console.log(e)
      })
    }
    this.log(`列表中第${offset}~${offset + answerList.length}条回答抓取完毕`)
  }
}

export default BatchFetchCollection
