import { describe, expect, it, vi } from 'vitest'
import ApiBase from '~/src/api/base.js'
import WeiboApi from '~/src/api/weibo.js'
import Mblog from '~/src/model/mblog.js'
import FetchCustomer from '~/src/command/fetch/customer.js'

describe('legacy fetch failure propagation', () => {
  it('does not turn a first-page network failure into an empty successful response', async () => {
    vi.spyOn(ApiBase.http, 'get').mockRejectedValueOnce(new Error('network failed'))

    await expect(WeiboApi.asyncGetWeiboList('123')).rejects.toThrow('network failed')
  })

  it('rejects malformed first-page responses instead of treating them as an empty account', async () => {
    vi.spyOn(ApiBase.http, 'get').mockResolvedValueOnce({ ok: 0, msg: 'request failed' } as never)

    await expect(WeiboApi.asyncGetWeiboList('123')).rejects.toThrow('request failed')
  })

  it('does not turn a database write failure into success', async () => {
    vi.spyOn(Mblog, 'replaceInto').mockRejectedValueOnce(new Error('database failed'))
    const command = new FetchCustomer()

    await expect(command.asyncReplaceMblogIntoDb({
      id: '1',
      created_at: '2026-08-13',
      user: { id: 123 },
    } as never)).rejects.toThrow('database failed')
  })
})
