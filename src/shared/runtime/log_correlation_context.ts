import { AsyncLocalStorage } from 'node:async_hooks'

export type LogCorrelationContext = {
  traceId?: string
  runId?: string
  jobId?: string
}

const storage = new AsyncLocalStorage<LogCorrelationContext>()

export function getLogCorrelationContext(): LogCorrelationContext {
  return storage.getStore() ?? {}
}

export function runWithLogCorrelation<T>(context: LogCorrelationContext, handler: () => T): T {
  const current = getLogCorrelationContext()
  return storage.run(
    {
      traceId: context.traceId ?? current.traceId,
      runId: context.runId ?? current.runId,
      jobId: context.jobId ?? current.jobId,
    },
    handler,
  )
}

