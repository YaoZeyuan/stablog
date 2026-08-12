import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export type TestSandbox = {
  rootPath: string
  configPath: string
  customerTaskConfigPath: string
  databasePath: string
  cachePath: string
  logPath: string
  outputPath: string
  cleanup: () => void
}

export function createTestSandbox(label: string): TestSandbox {
  const safeLabel = label.replace(/[^a-z0-9_-]/gi, '-').slice(0, 40) || 'case'
  const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), `stablog-${safeLabel}-`))
  const sandbox: TestSandbox = {
    rootPath,
    configPath: path.join(rootPath, 'config.json'),
    customerTaskConfigPath: path.join(rootPath, 'customer_task_config.json'),
    databasePath: path.join(rootPath, 'database', 'test.sqlite'),
    cachePath: path.join(rootPath, 'cache'),
    logPath: path.join(rootPath, 'log'),
    outputPath: path.join(rootPath, 'output'),
    cleanup: () => {
      if (process.env.KEEP_TEST_ARTIFACTS === '1') {
        console.info(`[test-artifacts] ${rootPath}`)
        return
      }
      fs.rmSync(rootPath, { recursive: true, force: true })
    },
  }
  for (const directoryPath of [
    path.dirname(sandbox.databasePath),
    sandbox.cachePath,
    sandbox.logPath,
    sandbox.outputPath,
  ]) {
    fs.mkdirSync(directoryPath, { recursive: true })
  }
  return sandbox
}

