import { describe, expect, it } from 'vitest'
import { runWithLegacyRuntime } from '~/src/application/legacy/legacy_runtime_bridge.js'
import { createRunContext } from '~/src/shared/runtime/run_context.js'
import { createTestSandbox } from '../helpers/sandbox.js'

describe('旧版运行时桥接器', () => {
  it('串行执行会修改全局路径的并发旧版适配器', async () => {
    const firstSandbox = createTestSandbox('legacy-first')
    const secondSandbox = createTestSandbox('legacy-second')
    const events: string[] = []
    let releaseFirst: () => void = () => undefined
    const firstGate = new Promise<void>((resolve) => { releaseFirst = resolve })

    try {
      const first = runWithLegacyRuntime(createRunContext({
        rootPath: firstSandbox.rootPath,
        configPath: firstSandbox.configPath,
        customerTaskConfigPath: firstSandbox.customerTaskConfigPath,
        databasePath: firstSandbox.databasePath,
        cachePath: firstSandbox.cachePath,
        logPath: firstSandbox.logPath,
        outputPath: firstSandbox.outputPath,
      }), async () => {
        events.push('first:start')
        await firstGate
        events.push('first:end')
      })
      const second = runWithLegacyRuntime(createRunContext({
        rootPath: secondSandbox.rootPath,
        configPath: secondSandbox.configPath,
        customerTaskConfigPath: secondSandbox.customerTaskConfigPath,
        databasePath: secondSandbox.databasePath,
        cachePath: secondSandbox.cachePath,
        logPath: secondSandbox.logPath,
        outputPath: secondSandbox.outputPath,
      }), async () => {
        events.push('second:start')
      })

      await Promise.resolve()
      expect(events).toEqual(['first:start'])
      releaseFirst()
      await Promise.all([first, second])
      expect(events).toEqual(['first:start', 'first:end', 'second:start'])
    } finally {
      firstSandbox.cleanup()
      secondSandbox.cleanup()
    }
  })
})
