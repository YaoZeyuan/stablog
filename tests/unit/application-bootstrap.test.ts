import { describe, expect, it, vi } from 'vitest'
import { bootstrapApplication } from '~/src/application/bootstrap/application_bootstrap.js'
import { AppErrorCode, ServiceLevel } from '~/src/shared/error/application_error.js'
import { LogEventCode, LogStatus } from '~/src/shared/logging/log_contract.js'

describe('application bootstrap', () => {
  it('initializes before creating the window and records startup success', async () => {
    const order: string[] = []
    const event = vi.fn()
    await bootstrapApplication({
      initialize: async () => { order.push('initialize') },
      createWindow: () => { order.push('window') },
      eventSink: { event, serializeError: vi.fn() },
      now: (() => {
        const values = [100, 125]
        return () => values.shift() ?? 125
      })(),
    })

    expect(order).toEqual(['initialize', 'window'])
    expect(event).toHaveBeenNthCalledWith(1, expect.objectContaining({
      eventCode: LogEventCode.APP_START,
      status: LogStatus.START,
      serviceLevel: ServiceLevel.S0,
    }))
    expect(event).toHaveBeenNthCalledWith(2, expect.objectContaining({
      eventCode: LogEventCode.APP_START,
      status: LogStatus.SUCCESS,
      durationMs: 25,
    }))
  })

  it('short-circuits window creation and reports an S0 startup failure', async () => {
    const createWindow = vi.fn()
    const event = vi.fn()
    await expect(bootstrapApplication({
      initialize: async () => { throw new Error('sqlite unavailable') },
      createWindow,
      eventSink: {
        event,
        serializeError: (error) => ({ name: 'Error', message: String(error) }),
      },
    })).rejects.toMatchObject({
      code: AppErrorCode.INITIALIZATION_FAILED,
      serviceLevel: ServiceLevel.S0,
    })

    expect(createWindow).not.toHaveBeenCalled()
    expect(event).toHaveBeenLastCalledWith(expect.objectContaining({
      eventCode: LogEventCode.APP_ERROR,
      status: LogStatus.FAILURE,
      errorCode: AppErrorCode.INITIALIZATION_FAILED,
      serviceLevel: ServiceLevel.S0,
    }))
  })
})
