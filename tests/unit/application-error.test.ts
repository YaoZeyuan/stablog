import { describe, expect, it } from 'vitest'
import {
  AppErrorCode,
  ApplicationError,
  ApplicationFailureKind,
  classifyApplicationError,
  ServiceLevel,
} from '../../src/shared/error/application_error.js'

describe('结构化应用错误', () => {
  it('序列化并还原服务等级、阶段、重试属性与原始原因', () => {
    const source = new ApplicationError({
      code: AppErrorCode.DATABASE_FAILED,
      message: '写入失败',
      serviceLevel: ServiceLevel.S0,
      stage: 'persist',
      retryable: true,
      cause: Object.assign(new Error('SQLITE_BUSY'), { code: 'SQLITE_BUSY' }),
      details: { entityType: 'mblog' },
    })

    const restored = ApplicationError.fromSerialized(source.toJSON())
    expect(restored).toMatchObject({
      code: AppErrorCode.DATABASE_FAILED,
      message: '写入失败',
      serviceLevel: ServiceLevel.S0,
      stage: 'persist',
      retryable: true,
      details: { entityType: 'mblog' },
    })
    expect((restored.cause as Error & { code?: string }).code).toBe('SQLITE_BUSY')
  })

  it('将任意异常包装为稳定的应用错误', () => {
    const error = ApplicationError.from(new Error('network down'), {
      code: AppErrorCode.FETCH_FAILED,
      serviceLevel: ServiceLevel.S1,
      stage: 'fetch',
      retryable: true,
    })
    expect(error).toMatchObject({
      code: AppErrorCode.FETCH_FAILED,
      message: 'network down',
      serviceLevel: ServiceLevel.S1,
      retryable: true,
    })
  })

  it('将文件、日志和诊断边界映射到稳定错误码与等级', () => {
    expect(classifyApplicationError(new Error('EACCES'), ApplicationFailureKind.FILE_SYSTEM)).toMatchObject({
      code: AppErrorCode.FILE_SYSTEM_FAILED,
      serviceLevel: ServiceLevel.S2,
      stage: 'filesystem',
    })
    expect(classifyApplicationError(new Error('disk full'), ApplicationFailureKind.LOG_WRITE)).toMatchObject({
      code: AppErrorCode.LOG_WRITE_FAILED,
      serviceLevel: ServiceLevel.S3,
      stage: 'logging',
    })
    expect(classifyApplicationError(new Error('devtools unavailable'), ApplicationFailureKind.DIAGNOSTIC)).toMatchObject({
      code: AppErrorCode.DIAGNOSTIC_FAILED,
      serviceLevel: ServiceLevel.S3,
      stage: 'diagnostic',
    })
  })
})
