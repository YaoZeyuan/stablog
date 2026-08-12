import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Logger from '../../src/library/logger.js'
import { LogLevel, LogStage, LogStatus } from '../../src/shared/logging/log_contract.js'
import { createTestSandbox, TestSandbox } from '../helpers/sandbox.js'
import { AppErrorCode, ServiceLevel } from '../../src/shared/error/application_error.js'

describe('结构化日志文件', () => {
  let sandbox: TestSandbox | undefined

  afterEach(() => {
    sandbox?.cleanup()
    sandbox = undefined
  })

  it('只写入注入的临时日志目录', () => {
    sandbox = createTestSandbox('logger')
    Logger.event({
      runId: 'run-log',
      stage: LogStage.INIT,
      status: LogStatus.SUCCESS,
      level: LogLevel.INFO,
      message: '初始化完成',
    }, sandbox.logPath)

    const fileList = fs.readdirSync(sandbox.logPath)
    expect(fileList.some((name) => name.endsWith('.jsonl'))).toBe(true)
    const jsonlPath = path.join(sandbox.logPath, fileList.find((name) => name.endsWith('.jsonl'))!)
    expect(JSON.parse(fs.readFileSync(jsonlPath, 'utf8').trim())).toMatchObject({
      runId: 'run-log',
      eventCode: 'init.success',
    })
  })

  it('日志目录不可写时安全降级且不抛出', () => {
    sandbox = createTestSandbox('logger-failure')
    const invalidDirectory = path.join(sandbox.rootPath, 'not-a-directory')
    fs.writeFileSync(invalidDirectory, 'file')
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    expect(() => Logger.event({ level: LogLevel.ERROR, message: '业务失败' }, invalidDirectory)).not.toThrow()
    expect(Logger.getLastWriteFailure()).not.toBe('')
    expect(Logger.getLastWriteError()).toMatchObject({
      code: AppErrorCode.LOG_WRITE_FAILED,
      serviceLevel: ServiceLevel.S3,
      stage: 'logging',
    })
  })
})
