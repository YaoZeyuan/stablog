import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Base from '../../src/command/base.js'
import PathConfig from '../../src/config/path.js'
import { createTestSandbox, TestSandbox } from '../helpers/sandbox.js'

class TestCommand extends Base {
  write(value: unknown): Promise<unknown> {
    return this.log('返回内容', value)
  }
}

describe('旧命令日志脱敏边界', () => {
  let sandbox: TestSandbox | undefined
  const originalLogPath = PathConfig.logPath

  afterEach(() => {
    PathConfig.setLogPath(originalLogPath)
    sandbox?.cleanup()
    sandbox = undefined
    vi.restoreAllMocks()
  })

  it('对象保持结构进入日志器，正文、会话凭证与请求头不会落盘', async () => {
    sandbox = createTestSandbox('base-log-redaction')
    PathConfig.setLogPath(sandbox.logPath)
    vi.spyOn(console, 'log').mockImplementation(() => undefined)

    await new TestCommand().write({
      cookie: 'SUB=private-cookie',
      headers: { authorization: 'Bearer private-token' },
      responseBody: 'private-content',
      safeCount: 2,
    })

    const fileName = fs.readdirSync(sandbox.logPath).find((name) => name.endsWith('.log'))
    expect(fileName).toBeDefined()
    const content = fs.readFileSync(path.join(sandbox.logPath, fileName!), 'utf8')
    expect(content).toContain('[REDACTED]')
    expect(content).toContain('safeCount')
    expect(content).not.toContain('private-cookie')
    expect(content).not.toContain('private-token')
    expect(content).not.toContain('private-content')
  })
})
