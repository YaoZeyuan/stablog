export const OFFLINE_WEIBO_LOGIN_UID = 'offline-skip-fetch'

export type FetchTaskSessionCounts = {
  pending: number
  running: number
  failed: number
}

/**
 * A failed or interrupted fetch task becomes pending when a batch is resumed,
 * so all three non-terminal states require a live Weibo session.
 */
export function hasOutstandingFetchWork(counts: FetchTaskSessionCounts): boolean {
  return counts.pending + counts.running + counts.failed > 0
}

/**
 * New online batches always need a session. Existing batches can run offline
 * only when fetching is explicitly skipped or every durable fetch task has
 * already succeeded and the workflow is merely retrying generation.
 */
export function requiresWeiboFetchSession(input: {
  isSkipFetch: boolean
  taskCounts?: FetchTaskSessionCounts
}): boolean {
  if (input.isSkipFetch) return false
  return input.taskCounts === undefined || hasOutstandingFetchWork(input.taskCounts)
}
