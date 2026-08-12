import RunTaskWorkflow from '~/src/application/workflow/run_task/run_task_workflow.js'
import type { RunTaskWorkflowOutput } from '~/src/application/workflow/run_task/contracts.js'
import type { CliCommand } from '~/src/interface/cli/parser/index.js'
import {
  ApplicationError,
  AppErrorCode,
  ServiceLevel,
} from '~/src/shared/error/application_error.js'
import type { ExecutionResult } from '~/src/shared/runtime/execution_result.js'
import { ExecutionStatus } from '~/src/shared/runtime/execution_result.js'

/** Optique 只负责解析；所有业务编排都进入 application workflow。 */
export async function dispatchCliCommand(
  command: CliCommand,
  workflow = new RunTaskWorkflow(),
): Promise<ExecutionResult<RunTaskWorkflowOutput>> {
  const common = {
    trigger: 'cli' as const,
    configPath: command.configPath,
    localConfigPath: command.localConfigPath,
    databasePath: command.databasePath,
  }
  let result: ExecutionResult<RunTaskWorkflowOutput>
  switch (command.action) {
    case 'init':
      result = await workflow.init({ ...common, rebase: command.rebase, skipUpgradeCheck: true })
      break
    case 'fetch':
      result = await workflow.fetch(common)
      break
    case 'generate':
      result = await workflow.generate({ ...common, outputPath: command.outputPath })
      break
    case 'run':
      result = await workflow.run({ ...common, outputPath: command.outputPath, rebase: command.rebase })
      break
  }

  if (result.status === ExecutionStatus.FAILURE) {
    const serialized = result.failures[0]?.error
    throw serialized
      ? ApplicationError.fromSerialized(serialized)
      : new ApplicationError({
          code: AppErrorCode.WORKFLOW_FAILED,
          message: `${command.action} workflow 执行失败`,
          serviceLevel: ServiceLevel.S1,
          stage: 'cli',
          retryable: false,
        })
  }
  return result
}
