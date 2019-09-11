import AuthorApi from '~/src/api/author'
import MAuthorAskQuestion from '~/src/model/author_ask_question'
import MAuthor from '~/src/model/author'
import BatchFetchPin from '~/src/command/fetch/batch/pin'
import Base from '~/src/command/fetch/batch/base'

class BatchFetchAuthorPin extends Base {
  async fetch(urlToken: string) {
    this.log(`开始抓取用户${urlToken}的数据`)
    this.log(`获取用户信息`)
    const authorInfo = await AuthorApi.asyncGetAutherInfo(urlToken)
    await MAuthor.asyncReplaceAuthor(authorInfo)
    this.log(`用户信息获取完毕`)
    const name = authorInfo.name
    const authorId = authorInfo.id
    const pinCount = authorInfo.pins_count
    this.log(`用户${name}(${urlToken})共发布了${pinCount}个想法`)
    this.log(`开始抓取想法列表`)
    let batchFetchPin = new BatchFetchPin()
    let pinIdList = []
    for (let offset = 0; offset < pinCount; offset = offset + this.max) {
      let authorPinsList = await AuthorApi.asyncGetAutherPinList(urlToken, offset, this.max)
      for (let authorPin of authorPinsList) {
        let pinId = `${authorPin.id}`
        pinIdList.push(pinId)
      }
      this.log(`第${offset}~${offset + this.max}条用户想法记录获取完毕`)
    }
    this.log(`开始抓取用户${name}(${urlToken})的所有想法详情记录,共${pinIdList.length}条`)
    await batchFetchPin.fetchListAndSaveToDb(pinIdList)
    this.log(`用户${name}(${urlToken})的想法列表抓取完毕`)
  }
}

export default BatchFetchAuthorPin
