import ColumnApi from '~/src/api/column'
import MColumn from '~/src/model/column'
import Base from '~/src/command/fetch/batch/base'
import CommonUtil from '~/src/library/util/common'
import BatchFetchArticle from '~/src/command/fetch/batch/article'

class BatchFetchColumn extends Base {
  async fetch(id: string) {
    this.log(`开始抓取专栏${id}的数据`)
    this.log(`获取专栏信息`)
    const columnInfo = await ColumnApi.asyncGetColumnInfo(id)
    await MColumn.asyncReplaceColumnInfo(columnInfo)
    this.log(`专栏信息获取完毕`)
    const title = columnInfo.title
    const articleCount = columnInfo.articles_count
    this.log(`专栏${title}(${id})下共有${articleCount}篇文章`)
    this.log(`开始抓取文章概要列表`)
    let articleIdList: Array<string> = []
    let batchFetchArticle = new BatchFetchArticle()
    for (let offset = 0; offset < articleCount; offset = offset + this.max) {
      await CommonUtil.asyncAppendPromiseWithDebounce(this.asyncGetColumnArticleExcerptList(id, offset, articleIdList))
      this.log(`将第${offset}~${offset + this.max}文章添加到任务队列中`)
    }
    await CommonUtil.asyncDispatchAllPromiseInQueen()
    this.log(`全部文章概要抓取完毕`)

    this.log(`开始抓取专栏${columnInfo.title}(${columnInfo.id})的下所有文章,共${articleIdList.length}条`)
    await batchFetchArticle.fetchListAndSaveToDb(articleIdList)
    this.log(`专栏${columnInfo.title}(${columnInfo.id})下的所有文章抓取完毕`)
  }

  private async asyncGetColumnArticleExcerptList(columnId: number, offset: number, articleIdList: Array<string>) {
    let articleExcerptList = await ColumnApi.asyncGetArticleExcerptList(columnId, offset, this.max)
    for (let articleExcerpt of articleExcerptList) {
      // 传递给外部
      articleIdList.push(`${articleExcerpt.id}`)
      await MColumn.asyncReplaceColumnArticleExcerpt(columnId, articleExcerpt).catch(e => {
        console.log('catch error')
        console.log(e)
      })
    }
    this.log(`专栏:${columnId}中第${offset}~${offset + articleExcerptList.length}篇文章摘要抓取完毕`)
  }
}

export default BatchFetchColumn
