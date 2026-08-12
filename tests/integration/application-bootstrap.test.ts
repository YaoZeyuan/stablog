import { describe, expect, it, vi } from 'vitest'
import {
  bootstrapApplication,
  STARTUP_FAILURE_CONTRACT,
} from '../../src/application/bootstrap/application_bootstrap.js'
import {
  AppErrorCode,
  ServiceLevel,
} from '../../src/shared/error/application_error.js'
import { serializeLogError } from '../../src/shared/logging/log_contract.js'

function createEventSink() {
  return {
    event: vi.fn(),
    serializeError: vi.fn(serializeLogError),
  }
}

describe('应用启动链路', () => {
  it('初始化完成后建窗，并记录 APP_START 成功事件', async () => {
    const callOrder: string[] = []
    const eventSink = createEventSink()
    const now = vi.fn().mockReturnValueOnce(100).mockReturnValueOnce(125)

    await bootstrapApplication({
      initialize: async () => { callOrder.push('initialize') },
      createWindow: async () => { callOrder.push('createWindow') },
      eventSink,
      now,
    })

    expect(callOrder).toEqual(['initialize', 'createWindow'])
    expect(eventSink.event.mock.calls.map(([entry]) => entry)).toMatchObject([
      { eventCode: 'app.start', status: 'start', serviceLevel: ServiceLevel.S0 },
      { eventCode: 'app.start', status: 'success', durationMs: 25, serviceLevel: ServiceLevel.S0 },
    ])
  })

  it('初始化失败时不建窗，记录 INITIALIZATION_FAILED/S0 后重新抛出', async () => {
    const eventSink = createEventSink()
    const createWindow = vi.fn()
    const startup = bootstrapApplication({
      initialize: async () => {
        throw new Error('authorization=Bearer private-token')
      },
      createWindow,
      eventSink,
      now: (() => {
        let current = 0
        return () => current += 10
      })(),
    })

    await expect(startup).rejects.toMatchObject({
      code: AppErrorCode.INITIALIZATION_FAILED,
      serviceLevel: ServiceLevel.S0,
      stage: 'app',
    })
    expect(STARTUP_FAILURE_CONTRACT).toEqual({
      code: AppErrorCode.INITIALIZATION_FAILED,
      serviceLevel: ServiceLevel.S0,
    })
    expect(createWindow).not.toHaveBeenCalled()
    const failure = eventSink.event.mock.calls.at(-1)?.[0]
    expect(failure).toMatchObject({
      eventCode: 'app.error',
      status: 'failure',
      errorCode: AppErrorCode.INITIALIZATION_FAILED,
      serviceLevel: ServiceLevel.S0,
    })
    expect(JSON.stringify(failure)).not.toContain('private-token')
  })
})
