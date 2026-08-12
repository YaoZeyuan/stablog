import fs from 'node:fs'
import path from 'node:path'
import PathConfig from '~/src/config/path.js'
import {
  createStructuredLogRecord,
  LogLevel,
  sanitizeLogValue,
  serializeLogError,
  StructuredLogEntry,
  StructuredLogRecord,
} from '~/src/shared/logging/log_contract.js'
import { getLogCorrelationContext } from '~/src/shared/runtime/log_correlation_context.js'
import {
  ApplicationError,
  ApplicationFailureKind,
  classifyApplicationError,
} from '~/src/shared/error/application_error.js'

export type { StructuredLogEntry, StructuredLogRecord }

class Logger {
  private static lastWriteFailure = ''
  private static lastWriteError: ApplicationError | undefined

  private static formatLocalDate(triggerAt: string): string {
    const date = new Date(triggerAt)
    const pad = (value: number) => `${value}`.padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  }

  private static formatArgument(...argumentList: unknown[]): string {
    const triggerAt = new Date().toISOString()
    const content = argumentList.map((item) => {
      const safeItem = sanitizeLogValue(item)
      if (typeof safeItem === 'string') {
        return safeItem
      }
      try {
        return JSON.stringify(safeItem)
      } catch {
        return '[Unserializable]'
      }
    }).join(' ')
    return `${triggerAt}: ${content}`
  }

  private static appendFile(filePath: string, content: string): boolean {
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true })
      fs.appendFileSync(filePath, content, 'utf8')
      return true
    } catch (error) {
      Logger.lastWriteError = classifyApplicationError(error, ApplicationFailureKind.LOG_WRITE, {
        message: `无法写入日志：${filePath}`,
        details: { diagnosticPath: filePath },
      })
      Logger.lastWriteFailure = Logger.lastWriteError.message
      // 日志失败不能递归记录，也不能覆盖原始业务错误。
      console.error(`[Logger] 写入日志失败: ${Logger.lastWriteFailure}`)
      return false
    }
  }

  static log(...argumentList: unknown[]): void {
    const content = Logger.formatArgument(...argumentList)
    if (Logger.appendFile(PathConfig.runtimeLogUri, `${content}\n`)) {
      Logger.clearLastWriteError()
    }
    console.log(content)
  }

  static warn(...argumentList: unknown[]): void {
    const content = Logger.formatArgument(...argumentList)
    if (Logger.appendFile(PathConfig.runtimeLogUri, `${content}\n`)) {
      Logger.clearLastWriteError()
    }
    console.warn(content)
  }

  static event(entry: StructuredLogEntry, logPath = PathConfig.logPath): StructuredLogRecord {
    const correlation = getLogCorrelationContext()
    const record = createStructuredLogRecord({
      ...entry,
      traceId: entry.traceId ?? correlation.traceId,
      runId: entry.runId ?? correlation.runId,
      jobId: entry.jobId ?? correlation.jobId,
    })
    const localDate = Logger.formatLocalDate(record.triggerAt)
    const jsonlPath = path.resolve(logPath, `runtime.${localDate}.jsonl`)
    const textPath = path.resolve(logPath, `runtime.${localDate}.log`)
    const isJsonlWritten = Logger.appendFile(jsonlPath, `${JSON.stringify(record)}\n`)
    const status = record.status ? `/${record.status}` : ''
    const duration = record.durationMs === undefined ? '' : ` 耗时${record.durationMs}ms`
    const text = Logger.formatArgument(`[${record.stage ?? 'runtime'}${status}] ${record.message}${duration}`)
    const isTextWritten = Logger.appendFile(textPath, `${text}\n`)
    if (isJsonlWritten && isTextWritten) {
      Logger.clearLastWriteError()
    }
    if (record.level === LogLevel.ERROR || record.level === LogLevel.WARN) {
      console.warn(text)
    }
    return record
  }

  static serializeError(error: unknown) {
    return serializeLogError(error)
  }

  static getLastWriteFailure(): string {
    return Logger.lastWriteFailure
  }

  static getLastWriteError(): ApplicationError | undefined {
    return Logger.lastWriteError
  }

  private static clearLastWriteError(): void {
    Logger.lastWriteFailure = ''
    Logger.lastWriteError = undefined
  }
}

export default Logger
