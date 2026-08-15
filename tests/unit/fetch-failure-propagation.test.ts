import { describe, expect, it, vi } from 'vitest'
import ApiBase from '~/src/api/base.js'
import WeiboApi from '~/src/api/weibo.js'
import Mblog from '~/src/model/mblog.js'
import FetchCustomer from '~/src/command/fetch/customer.js'

describe('旧版抓取流程的失败传递', () => {
  it('不会将首页网络失败转换为空的成功响应', async () => {
    vi.spyOn(ApiBase.http, 'get').mockRejectedValueOnce(new Error('network failed'))

    await expect(WeiboApi.asyncGetWeiboList('123')).rejects.toThrow('network failed')
  })

  it('拒绝格式错误的首页响应而不是将其视为空账号', async () => {
    vi.spyOn(ApiBase.http, 'get').mockResolvedValueOnce({ ok: 0, msg: 'request failed' } as never)

    await expect(WeiboApi.asyncGetWeiboList('123')).rejects.toThrow('request failed')
  })

  it('不会将数据库写入失败转换为成功', async () => {
    vi.spyOn(Mblog, 'replaceInto').mockRejectedValueOnce(new Error('database failed'))
    const command = new FetchCustomer()

    await expect(command.asyncReplaceMblogIntoDb({
      id: '1',
      created_at: '2026-08-13',
      user: { id: 123 },
    } as never)).rejects.toThrow('database failed')
  })
})
