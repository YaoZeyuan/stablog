import DatabaseConfig from '~/src/config/database.js'
import PathConfig from '~/src/config/path.js'
import type { RunContext } from '~/src/shared/runtime/run_context.js'

type LegacyRuntimeSnapshot = {
  configPath: string
  customerTaskConfigPath: string
  databasePath: string
  cachePath: string
  logPath: string
  outputPath: string
}

let legacyRuntimeQueue: Promise<void> = Promise.resolve()

function takeSnapshot(): LegacyRuntimeSnapshot {
  return {
    configPath: PathConfig.configUri,
    customerTaskConfigPath: PathConfig.customerTaskConfigUri,
    databasePath: DatabaseConfig.uri,
    cachePath: PathConfig.cachePath,
    logPath: PathConfig.logPath,
    outputPath: PathConfig.outputPath,
  }
}

function applyPaths(paths: LegacyRuntimeSnapshot): void {
  PathConfig.setConfigUri(paths.configPath)
  PathConfig.setCustomerTaskConfigUri(paths.customerTaskConfigPath)
  PathConfig.setCachePath(paths.cachePath)
  PathConfig.setLogPath(paths.logPath)
  PathConfig.setOutputPath(paths.outputPath)
  DatabaseConfig.setUri(paths.databasePath)
}

/**
 * 旧抓取/生成实现仍读取静态 PathConfig。该桥接器把全局切换限制在一次显式、
 * 串行的 adapter 调用内，并始终恢复原值；新 workflow 和测试不会修改这些全局。
 */
export async function runWithLegacyRuntime<T>(context: RunContext, handler: () => Promise<T>): Promise<T> {
  const previous = legacyRuntimeQueue
  let release: () => void = () => undefined
  legacyRuntimeQueue = new Promise<void>((resolve) => {
    release = resolve
  })
  await previous
  const snapshot = takeSnapshot()
  try {
    applyPaths({
      configPath: context.configPath,
      customerTaskConfigPath: context.customerTaskConfigPath,
      databasePath: context.databasePath,
      cachePath: context.cachePath,
      logPath: context.logPath,
      outputPath: context.outputPath,
    })
    return await handler()
  } finally {
    applyPaths(snapshot)
    release()
  }
}
