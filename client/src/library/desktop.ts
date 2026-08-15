export type DesktopResult<T> =
  | { ok: true; value: T }
  | {
      ok: false
      error: {
        name: 'ApplicationError'
        code: string
        message: string
        serviceLevel: 'S0' | 'S1' | 'S2' | 'S3'
        stage: string
        retryable: boolean
        stack?: string
        details?: Record<string, unknown>
        cause?: {
          name: string
          message: string
          code?: string
          stack?: string
        }
      }
    }

type DesktopBridge = {
  invoke<T>(channel: string, payload?: unknown, metadata?: { traceId?: string }): Promise<DesktopResult<T>>
}

export type WeiboLoginStatus = {
  isLogin: boolean
  uid: string
}

export type WeiboUserSummary = {
  screen_name: string
  statuses_count: number
  total_page_count: number
  followers_count: number
}

declare global {
  interface Window {
    stablog: DesktopBridge
  }
}

function createTraceId(channel: string): string {
  const random = Math.random().toString(36).slice(2, 8)
  return `${channel}-${Date.now()}-${random}`
}

export async function invokeDesktop<T>(channel: string, payload?: unknown): Promise<T> {
  if (window.stablog === undefined) {
    throw new Error('桌面桥接不可用，请通过 Electron 启动稳部落')
  }
  const result = await window.stablog.invoke<T>(channel, payload, { traceId: createTraceId(channel) })
  if (result.ok) {
    return result.value
  }
  const error = new Error(result.error.message) as Error & {
    code?: string
    serviceLevel?: string
    stage?: string
    retryable?: boolean
  }
  error.code = result.error.code
  error.serviceLevel = result.error.serviceLevel
  error.stage = result.error.stage
  error.retryable = result.error.retryable
  throw error
}
