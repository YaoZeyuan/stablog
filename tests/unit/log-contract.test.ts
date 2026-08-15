import { describe, expect, it } from 'vitest'
import {
  createStructuredLogRecord,
  LOG_SCHEMA_VERSION,
  LogLevel,
  LogStage,
  LogStatus,
  sanitizeLogValue,
  serializeLogError,
} from '../../src/shared/logging/log_contract.js'
import { ApplicationError, AppErrorCode, ServiceLevel } from '../../src/shared/error/application_error.js'

describe('结构化日志契约', () => {
  it('补充稳定格式、时间、事件码和来源', () => {
    const record = createStructuredLogRecord({
      stage: LogStage.FETCH,
      status: LogStatus.START,
      level: LogLevel.INFO,
      message: '开始抓取',
    }, '2026-08-12T12:00:00.000Z')
    expect(record).toMatchObject({
      schemaVersion: LOG_SCHEMA_VERSION,
      triggerAt: '2026-08-12T12:00:00.000Z',
      eventCode: 'fetch.start',
      source: 'backend',
    })
  })

  it('递归脱敏会话凭证、请求头、正文、地址查询参数和循环引用', () => {
    const input: Record<string, unknown> = {
      cookie: 'SUB=secret-cookie',
      nested: {
        accessToken: 'secret-token',
        headers: { authorization: 'Bearer secret' },
        responseBody: { text: 'private' },
        url: 'https://weibo.com/api/list?token=secret',
      },
    }
    input.self = input
    const result = sanitizeLogValue(input) as Record<string, any>
    expect(result.cookie).toBe('[REDACTED]')
    expect(result.nested.accessToken).toBe('[REDACTED]')
    expect(result.nested.headers).toBe('[REDACTED]')
    expect(result.nested.responseBody).toBe('[REDACTED]')
    expect(result.nested.url).toBe('https://weibo.com/api/list?[REDACTED]')
    expect(result.self).toBe('[Circular]')
    expect(JSON.stringify(result)).not.toContain('secret')
  })

  it('序列化异常对象与普通值均不抛异常', () => {
    expect(serializeLogError(Object.assign(new Error('failed'), { code: 'E_TEST' }))).toMatchObject({
      name: 'Error',
      message: 'failed',
      code: 'E_TEST',
    })
    expect(serializeLogError({ cookie: 'private' }).name).toBe('NonError')
  })

  it('序列化并脱敏应用错误的原始原因', () => {
    const cause = Object.assign(new Error('request failed: authorization=Bearer private-token'), {
      code: 'E_REQUEST',
      cause: { cookie: 'SUB=private-cookie', responseBody: 'private-content' },
    })
    const error = new ApplicationError({
      code: AppErrorCode.FETCH_FAILED,
      message: '抓取失败',
      serviceLevel: ServiceLevel.S1,
      stage: 'fetch',
      retryable: true,
      cause,
    })
    const serialized = serializeLogError(error)

    expect(serialized.cause).toMatchObject({ code: 'E_REQUEST' })
    expect(serialized.cause?.cause).toMatchObject({ name: 'NonError' })
    expect(JSON.stringify(serialized)).not.toContain('private-token')
    expect(JSON.stringify(serialized)).not.toContain('private-cookie')
    expect(JSON.stringify(serialized)).not.toContain('private-content')
  })
})
