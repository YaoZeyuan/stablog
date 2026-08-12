import type { StructuredLogEntry } from '~/src/shared/logging/log_contract.js'
import {
  AppErrorCode,
  ApplicationFailureKind,
  classifyApplicationError,
  ServiceLevel,
} from '~/src/shared/error/application_error.js'
import {
  LogEventCode,
  LogLevel,
  LogStage,
  LogStatus,
} from '~/src/shared/logging/log_contract.js'

export type ApplicationBootstrapEventSink = {
  event(entry: StructuredLogEntry): unknown
  serializeError(error: unknown): StructuredLogEntry['error']
}

export type ApplicationBootstrapDependencies = {
  initialize(): Promise<void>
  createWindow(): Promise<void> | void
  eventSink: ApplicationBootstrapEventSink
  now?: () => number
}

/**
 * Electron 之外可测试的最小启动编排：初始化持久化环境后再创建并接线窗口。
 * 入口只负责在失败后退出进程；错误分类和日志在此边界统一完成。
 */
export async function bootstrapApplication(
  dependencies: ApplicationBootstrapDependencies,
): Promise<void> {
  const now = dependencies.now ?? Date.now
  const startedAt = now()
  dependencies.eventSink.event({
    eventCode: LogEventCode.APP_START,
    stage: LogStage.APP,
    status: LogStatus.START,
    level: LogLevel.INFO,
    serviceLevel: ServiceLevel.S0,
    message: '应用启动开始',
  })

  try {
    await dependencies.initialize()
    await dependencies.createWindow()
    dependencies.eventSink.event({
      eventCode: LogEventCode.APP_START,
      stage: LogStage.APP,
      status: LogStatus.SUCCESS,
      level: LogLevel.INFO,
      serviceLevel: ServiceLevel.S0,
      durationMs: now() - startedAt,
      message: '应用启动完成',
    })
  } catch (error) {
    const appError = classifyApplicationError(error, ApplicationFailureKind.STARTUP, {
      message: 'Electron 初始化失败',
    })
    dependencies.eventSink.event({
      eventCode: LogEventCode.APP_ERROR,
      stage: LogStage.APP,
      status: LogStatus.FAILURE,
      level: LogLevel.ERROR,
      serviceLevel: appError.serviceLevel,
      errorCode: appError.code,
      error: dependencies.eventSink.serializeError(appError),
      durationMs: now() - startedAt,
      message: appError.message,
    })
    throw appError
  }
}

export const STARTUP_FAILURE_CONTRACT = Object.freeze({
  code: AppErrorCode.INITIALIZATION_FAILED,
  serviceLevel: ServiceLevel.S0,
})
