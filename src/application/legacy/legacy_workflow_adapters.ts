import {
  WorkflowStageAdapter,
  WorkflowStageInput,
} from '~/src/application/workflow/run_task/contracts.js'
import { runWithLegacyRuntime } from '~/src/application/legacy/legacy_runtime_bridge.js'
import {
  AppErrorCode,
  ApplicationError,
  ServiceLevel,
} from '~/src/shared/error/application_error.js'
import {
  createExecutionSuccess,
  ExecutionResult,
} from '~/src/shared/runtime/execution_result.js'

async function executeLegacyStage(
  input: WorkflowStageInput,
  code: string,
  stage: 'init' | 'fetch' | 'generate',
  handler: () => Promise<unknown>,
): Promise<ExecutionResult> {
  try {
    await runWithLegacyRuntime(input.context, handler)
    return createExecutionSuccess(undefined, input.config?.configList.length ?? 1)
  } catch (error) {
    throw ApplicationError.from(error, {
      code,
      message: `${stage} 阶段执行失败`,
      serviceLevel: stage === 'init' ? ServiceLevel.S0 : ServiceLevel.S1,
      stage,
      retryable: stage === 'fetch',
    })
  }
}

export class LegacyInitAdapter implements WorkflowStageAdapter {
  async execute(input: WorkflowStageInput): Promise<ExecutionResult> {
    return executeLegacyStage(input, AppErrorCode.INITIALIZATION_FAILED, 'init', async () => {
      const { default: InitEnvCommand } = await import('~/src/command/init_env.js')
      await new InitEnvCommand().handle({}, {
        rebase: input.rebase,
        skipUpgradeCheck: input.skipUpgradeCheck,
      })
    })
  }
}

export class LegacyFetchAdapter implements WorkflowStageAdapter {
  async execute(input: WorkflowStageInput): Promise<ExecutionResult> {
    return executeLegacyStage(input, AppErrorCode.FETCH_FAILED, 'fetch', async () => {
      const { default: FetchCustomerCommand } = await import('~/src/command/fetch/customer.js')
      await new FetchCustomerCommand().handle({}, {})
    })
  }
}

export class LegacyGenerateAdapter implements WorkflowStageAdapter {
  async execute(input: WorkflowStageInput): Promise<ExecutionResult> {
    if (input.renderWindow === undefined || input.renderWindow === null) {
      throw new ApplicationError({
        code: AppErrorCode.GENERATE_FAILED,
        message: '当前生成器需要 Electron 渲染窗口；CLI 可执行 init/fetch，完整生成请使用 GUI',
        serviceLevel: ServiceLevel.S1,
        stage: 'generate',
        retryable: false,
      })
    }
    return executeLegacyStage(input, AppErrorCode.GENERATE_FAILED, 'generate', async () => {
      const { default: GenerateCustomerCommand } = await import('~/src/command/generate/customer.js')
      await new GenerateCustomerCommand().handle({ subWindow: input.renderWindow }, {})
    })
  }
}
