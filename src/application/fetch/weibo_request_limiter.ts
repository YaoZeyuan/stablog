export type RequestLimiterClock = {
  now(): number
  sleep(delayMs: number): Promise<void>
}

export type WeiboRequestLimiterOptions = {
  intervalMs?: number
  minimumIntervalMs?: number
  clock?: Partial<RequestLimiterClock>
}

const defaultClock: RequestLimiterClock = {
  now: Date.now,
  sleep: (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)),
}

/**
 * 单进程微博 API 请求起始时间限流器。
 * 队列在失败后也会继续推进，且失败请求同样占用一个请求时隙。
 */
export class WeiboRequestLimiter {
  private readonly clock: RequestLimiterClock
  private readonly minimumIntervalMs: number
  private intervalMs: number
  private lastStartedAt: number | undefined
  private nextAllowedStartAt = 0
  private tail: Promise<void> = Promise.resolve()

  constructor(options: WeiboRequestLimiterOptions = {}) {
    this.minimumIntervalMs = options.minimumIntervalMs ?? 10_000
    this.clock = {
      now: options.clock?.now ?? defaultClock.now,
      sleep: options.clock?.sleep ?? defaultClock.sleep,
    }
    this.intervalMs = this.validateInterval(options.intervalMs ?? 10_000)
  }

  get requestIntervalMs(): number {
    return this.intervalMs
  }

  setRequestIntervalMs(intervalMs: number): void {
    this.intervalMs = this.validateInterval(intervalMs)
    this.nextAllowedStartAt = this.lastStartedAt === undefined
      ? 0
      : this.lastStartedAt + this.intervalMs
  }

  schedule<T>(request: () => Promise<T>): Promise<T> {
    const run = this.tail.then(async () => {
      const waitMs = Math.max(0, this.nextAllowedStartAt - this.clock.now())
      if (waitMs > 0) {
        await this.clock.sleep(waitMs)
      }
      const startedAt = this.clock.now()
      this.lastStartedAt = startedAt
      this.nextAllowedStartAt = startedAt + this.intervalMs
      return request()
    })
    this.tail = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }

  private validateInterval(intervalMs: number): number {
    if (
      Number.isSafeInteger(intervalMs) === false ||
      intervalMs < this.minimumIntervalMs
    ) {
      throw new RangeError(`请求间隔不得小于 ${this.minimumIntervalMs}ms`)
    }
    return intervalMs
  }
}

/** 主进程内所有抓取 API 默认共享这一实例。 */
export const globalWeiboRequestLimiter = new WeiboRequestLimiter()
