export type DesktopResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: string; message: string; serviceLevel: string } }

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
  const error = new Error(result.error.message) as Error & { code?: string; serviceLevel?: string }
  error.code = result.error.code
  error.serviceLevel = result.error.serviceLevel
  throw error
}
