#!/usr/bin/env node
import { message } from '@optique/core/message'
import { defineProgram } from '@optique/core/program'
import { runSync } from '@optique/run'
import { dispatchCliCommand } from '~/src/interface/cli/command/dispatcher.js'
import { cliParser } from '~/src/interface/cli/parser/index.js'
import Logger from '~/src/library/logger.js'
import {
  LogEventCode,
  LogLevel,
  LogStage,
  LogStatus,
} from '~/src/shared/logging/log_contract.js'

const program = defineProgram({
  parser: cliParser,
  metadata: {
    name: 'stablog',
    version: '3.5.4',
    brief: message`稳部落命令行入口`,
    description: message`抓取微博到本地 SQLite，并生成 HTML/PDF 电子书。`,
  },
})

export async function main(): Promise<void> {
  const command = runSync(program, {
    help: 'both',
    version: { value: '3.5.4', option: true },
    aboveError: 'usage',
    showDefault: true,
  })
  await dispatchCliCommand(command)
}

main().catch((error: unknown) => {
  Logger.event({
    eventCode: LogEventCode.WORKFLOW_FAILURE,
    stage: LogStage.CLI,
    status: LogStatus.FAILURE,
    level: LogLevel.ERROR,
    message: 'CLI 执行失败',
    error: Logger.serializeError(error),
  })
  const printable = error instanceof Error ? error.stack ?? error.message : String(error)
  console.error(printable)
  process.exitCode = 1
})
