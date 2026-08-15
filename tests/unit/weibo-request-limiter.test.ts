import { describe, expect, it } from 'vitest'
import { WeiboRequestLimiter } from '../../src/application/fetch/weibo_request_limiter.js'

function fakeClock(startAt = 1_000) {
  let now = startAt
  const sleeps: number[] = []
  return {
    sleeps,
    now: () => now,
    sleep: async (delayMs: number) => {
      sleeps.push(delayMs)
      now += delayMs
    },
  }
}

describe('微博全局请求限流器', () => {
  it('串行调度并保证相邻请求开始间隔', async () => {
    const clock = fakeClock()
    const limiter = new WeiboRequestLimiter({
      intervalMs: 10_000,
      minimumIntervalMs: 10_000,
      clock,
    })
    const startedAt: number[] = []

    await Promise.all([
      limiter.schedule(async () => startedAt.push(clock.now())),
      limiter.schedule(async () => startedAt.push(clock.now())),
      limiter.schedule(async () => startedAt.push(clock.now())),
    ])

    expect(startedAt).toEqual([1_000, 11_000, 21_000])
    expect(clock.sleeps).toEqual([10_000, 10_000])
  })

  it('失败请求占用时隙但不会阻断后续队列', async () => {
    const clock = fakeClock(0)
    const limiter = new WeiboRequestLimiter({
      intervalMs: 10_000,
      minimumIntervalMs: 10_000,
      clock,
    })
    const startedAt: number[] = []
    const first = limiter.schedule(async () => {
      startedAt.push(clock.now())
      throw new Error('fixture failure')
    })
    const second = limiter.schedule(async () => {
      startedAt.push(clock.now())
      return 'ok'
    })

    await expect(first).rejects.toThrow('fixture failure')
    await expect(second).resolves.toBe('ok')
    expect(startedAt).toEqual([0, 10_000])
  })

  it('运行时配置仍受 10 秒下限约束', () => {
    const limiter = new WeiboRequestLimiter()
    expect(() => limiter.setRequestIntervalMs(9_999)).toThrow()
    limiter.setRequestIntervalMs(15_000)
    expect(limiter.requestIntervalMs).toBe(15_000)
  })

  it('缩短动态配置时按最后一次开始时间重算下一时隙', async () => {
    const clock = fakeClock(1_000)
    const limiter = new WeiboRequestLimiter({
      intervalMs: 3_600_000,
      minimumIntervalMs: 10_000,
      clock,
    })
    const startedAt: number[] = []
    await limiter.schedule(async () => startedAt.push(clock.now()))

    limiter.setRequestIntervalMs(10_000)
    await limiter.schedule(async () => startedAt.push(clock.now()))

    expect(startedAt).toEqual([1_000, 11_000])
    expect(clock.sleeps).toEqual([10_000])
  })
})
