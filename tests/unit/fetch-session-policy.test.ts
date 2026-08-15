import { describe, expect, it } from 'vitest'
import {
  requiresWeiboLoginForNewTask,
  resolveLocalWeiboTargetUid,
} from '../../client/src/pages/customer_task/execution_policy.js'
import {
  OFFLINE_WEIBO_LOGIN_UID,
  hasOutstandingFetchWork,
  requiresWeiboFetchSession,
} from '../../src/application/fetch/fetch_session_policy.js'

describe('抓取会话策略', () => {
  it('新的离线批次使用明确的非数字身份标识', () => {
    expect(OFFLINE_WEIBO_LOGIN_UID).toBe('offline-skip-fetch')
    expect(OFFLINE_WEIBO_LOGIN_UID).not.toMatch(/^\d+$/)
  })

  it('只有新增或未完成的在线抓取任务需要会话', () => {
    expect(requiresWeiboFetchSession({ isSkipFetch: false })).toBe(true)
    expect(requiresWeiboFetchSession({
      isSkipFetch: false,
      taskCounts: { pending: 0, running: 0, failed: 0 },
    })).toBe(false)
    expect(requiresWeiboFetchSession({
      isSkipFetch: false,
      taskCounts: { pending: 0, running: 0, failed: 1 },
    })).toBe(true)
    expect(requiresWeiboFetchSession({
      isSkipFetch: true,
      taskCounts: { pending: 1, running: 1, failed: 1 },
    })).toBe(false)
    expect(hasOutstandingFetchWork({ pending: 0, running: 1, failed: 0 })).toBe(true)
  })
})

describe('客户任务界面的离线身份策略', () => {
  it('跳过抓取启动时不需要界面登录检查', () => {
    expect(requiresWeiboLoginForNewTask({ isSkipFetch: true })).toBe(false)
    expect(requiresWeiboLoginForNewTask({ isSkipFetch: false })).toBe(true)
  })

  it.each([
    [{ uid: '1000000000', rawInputText: '' }, '1000000000'],
    [{ uid: '1000000001', rawInputText: 'https://weibo.com/n/fixture' }, '1000000001'],
    [{ uid: '', rawInputText: '1000000002' }, '1000000002'],
    [{ uid: '', rawInputText: 'https://weibo.com/u/1000000003' }, '1000000003'],
    [{ uid: '', rawInputText: 'https://m.weibo.cn/profile/1000000004/' }, '1000000004'],
    [{ uid: '', rawInputText: 'https://www.weibo.com/1000000005' }, '1000000005'],
  ])('无需重定向即可在本地解析直接填写的用户编号', (input, expected) => {
    expect(resolveLocalWeiboTargetUid(input)).toBe(expected)
  })

  it.each([
    'https://weibo.com/n/fixture-name',
    'https://example.invalid/u/1000000001',
    'ftp://weibo.com/u/1000000001',
    'not-a-weibo-profile',
    '123456789012345678901234567890123',
  ])('拒绝需要远程解析的身份信息', (rawInputText) => {
    expect(resolveLocalWeiboTargetUid({ uid: '', rawInputText })).toBe('')
  })
})
