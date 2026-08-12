import path from 'node:path'
import PathConfig from '~/src/config/path.js'
import DatabaseConfig from '~/src/config/database.js'
import Logger from '~/src/library/logger.js'
import { LogEventCode, LogLevel, LogStage, LogStatus } from '~/src/shared/logging/log_contract.js'

export type RunTrigger = 'cli' | 'gui'
export type RunStage = 'cli' | 'config' | 'init' | 'fetch' | 'persist' | 'generate' | 'render' | 'output' | 'ipc'

export type RunPaths = {
  rootPath: string
  resourcePath: string
  configPath: string
  customerTaskConfigPath: string
  databasePath: string
  cachePath: string
  logPath: string
  outputPath: string
}

export type RunContextOptions = Partial<RunPaths> & {
  runId?: string
  traceId?: string
  trigger?: RunTrigger
}

export type RunContext = Readonly<RunPaths & {
  runId: string
  traceId: string
  trigger: RunTrigger
}>

/**
 * 构建一次任务的不可变路径快照。旧模块的全局 PathConfig 由入口显式同步，
 * 测试和新 workflow 不因创建 context 而修改业务目录。
 */
export function createRunContext(options: RunContextOptions = {}): RunContext {
  const rootPath = path.resolve(options.rootPath ?? PathConfig.rootPath)
  const context: RunContext = Object.freeze({
    runId: options.runId ?? createRunId(),
    traceId: options.traceId ?? createTraceId(),
    trigger: options.trigger ?? 'cli',
    rootPath,
    resourcePath: path.resolve(options.resourcePath ?? PathConfig.resourcePath),
    configPath: path.resolve(options.configPath ?? PathConfig.configUri),
    customerTaskConfigPath: path.resolve(options.customerTaskConfigPath ?? PathConfig.customerTaskConfigUri),
    databasePath: path.resolve(options.databasePath ?? DatabaseConfig.uri),
    cachePath: path.resolve(options.cachePath ?? PathConfig.cachePath),
    logPath: path.resolve(options.logPath ?? PathConfig.logPath),
    outputPath: path.resolve(options.outputPath ?? PathConfig.outputPath),
  })

  Logger.event({
    traceId: context.traceId,
    runId: context.runId,
    eventCode: LogEventCode.CONFIG_CONTEXT_CREATED,
    stage: LogStage.CONFIG,
    status: LogStatus.SUCCESS,
    level: LogLevel.INFO,
    message: '创建运行上下文',
    details: {
      trigger: context.trigger,
      rootPath: context.rootPath,
      configPath: context.configPath,
      customerTaskConfigPath: context.customerTaskConfigPath,
      databasePath: context.databasePath,
      cachePath: context.cachePath,
      logPath: context.logPath,
      outputPath: context.outputPath,
    },
  }, context.logPath)
  return context
}

export function createRunId(): string {
  return createCorrelationId('run')
}

export function createTraceId(): string {
  return createCorrelationId('trace')
}

function createCorrelationId(prefix: string): string {
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '')
  const random = Math.random().toString(36).slice(2, 10)
  return `${prefix}-${timestamp}-${random}`
}
