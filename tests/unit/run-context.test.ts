import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import PathConfig from '../../src/config/path.js'
import DatabaseConfig from '../../src/config/database.js'
import Logger from '../../src/library/logger.js'
import { createRunContext } from '../../src/shared/runtime/run_context.js'
import { createTestSandbox, TestSandbox } from '../helpers/sandbox.js'

describe('隔离运行上下文', () => {
  let sandbox: TestSandbox | undefined

  afterEach(() => {
    sandbox?.cleanup()
    sandbox = undefined
  })

  it('使用注入路径且不修改业务全局路径', () => {
    sandbox = createTestSandbox('run-context')
    const original = {
      configPath: PathConfig.configUri,
      databasePath: DatabaseConfig.uri,
      cachePath: PathConfig.cachePath,
      logPath: PathConfig.logPath,
      outputPath: PathConfig.outputPath,
    }
    vi.spyOn(Logger, 'event')

    const context = createRunContext({
      rootPath: sandbox.rootPath,
      configPath: sandbox.configPath,
      customerTaskConfigPath: sandbox.customerTaskConfigPath,
      databasePath: sandbox.databasePath,
      cachePath: sandbox.cachePath,
      logPath: sandbox.logPath,
      outputPath: sandbox.outputPath,
      runId: 'run-test',
      traceId: 'trace-test',
      trigger: 'gui',
    })

    expect(context).toMatchObject({
      runId: 'run-test',
      traceId: 'trace-test',
      trigger: 'gui',
      databasePath: sandbox.databasePath,
    })
    expect(PathConfig.configUri).toBe(original.configPath)
    expect(DatabaseConfig.uri).toBe(original.databasePath)
    expect(PathConfig.cachePath).toBe(original.cachePath)
    expect(PathConfig.logPath).toBe(original.logPath)
    expect(PathConfig.outputPath).toBe(original.outputPath)
    expect(fs.readdirSync(sandbox.logPath).some((name) => name.endsWith('.jsonl'))).toBe(true)
    expect(Logger.event).toHaveBeenCalledOnce()
  })
})
