const WEIBO_UID_PATTERN = /^\d{1,32}$/

export function requiresWeiboLoginForNewTask(config: { isSkipFetch: boolean }): boolean {
  return config.isSkipFetch === false
}

/**
 * Resolve only identities that require no redirect or API request. A stored UID
 * remains authoritative; otherwise accept a numeric value or a direct Weibo URL.
 */
export function resolveLocalWeiboTargetUid(input: {
  uid?: string
  rawInputText?: string
}): string {
  const storedUid = input.uid?.trim() ?? ''
  if (WEIBO_UID_PATTERN.test(storedUid)) return storedUid

  const rawInput = input.rawInputText?.trim() ?? ''
  if (WEIBO_UID_PATTERN.test(rawInput)) return rawInput

  try {
    const parsed = new URL(rawInput)
    if (
      (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') ||
      isWeiboHost(parsed.hostname) === false
    ) return ''
    const match = parsed.pathname.match(/^\/(?:u\/|profile\/)?(\d{1,32})(?:\/|$)/)
    return match?.[1] ?? ''
  } catch {
    return ''
  }
}

function isWeiboHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase()
  return normalized === 'weibo.com' || normalized.endsWith('.weibo.com') ||
    normalized === 'weibo.cn' || normalized.endsWith('.weibo.cn')
}
