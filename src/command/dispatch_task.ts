import RunTaskWorkflow from '~/src/application/workflow/run_task/run_task_workflow.js'
import Base from '~/src/command/base.js'
import { ApplicationError } from '~/src/shared/error/application_error.js'
import { ExecutionStatus } from '~/src/shared/runtime/execution_result.js'

class DispatchCommand extends Base {
  static get signature() {
    return `
      Dispatch:Task
     `
  }

  static get description() {
    return '根据task_config_list.json配置, 分发任务'
  }

  async execute(args: any, options: any) {
    const workflow = new RunTaskWorkflow()
    const result = await workflow.run({
      trigger: args?.trigger ?? (args?.subWindow ? 'gui' : 'cli'),
      configPath: args?.configPath,
      localConfigPath: args?.localConfigPath,
      databasePath: args?.databasePath,
      cachePath: args?.cachePath,
      logPath: args?.logPath,
      outputPath: args?.outputPath,
      renderWindow: args?.subWindow,
      rebase: options?.rebase ?? false,
      skipUpgradeCheck: options?.skipUpgradeCheck ?? false,
    })
    if (result.status === ExecutionStatus.FAILURE && result.failures[0]) {
      throw ApplicationError.fromSerialized(result.failures[0].error)
    }
    return result
  }
}

export default DispatchCommand
