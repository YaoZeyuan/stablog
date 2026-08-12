import type { BrowserWindow } from 'electron'
import Logger from '~/src/library/logger.js'
import {
  LegacyFetchAdapter,
  LegacyGenerateAdapter,
  LegacyInitAdapter,
} from '~/src/application/legacy/legacy_workflow_adapters.js'
import {
  RunTaskWorkflowOutput,
  WorkflowAction,
  WorkflowEventSink,
  WorkflowStage,
  WorkflowStageAdapter,
  WorkflowStageSummary,
} from '~/src/application/workflow/run_task/contracts.js'
import { readCustomerTaskConfig } from '~/src/shared/config/task_config.js'
import {
  AppErrorCode,
  ApplicationError,
  ServiceLevel,
} from '~/src/shared/error/application_error.js'
import {
  LogEventCode,
  LogLevel,
  LogStage,
  LogStatus,
} from '~/src/shared/logging/log_contract.js'
import {
  createExecutionFailure,
  createExecutionPartial,
  createExecutionSuccess,
  ExecutionResult,
  ExecutionStatus,
} from '~/src/shared/runtime/execution_result.js'
import { runWithLogCorrelation } from '~/src/shared/runtime/log_correlation_context.js'
import {
  createRunContext,
  RunContext,
  RunContextOptions,
} from '~/src/shared/runtime/run_context.js'

export type { RunTaskWorkflowOutput } from '~/src/application/workflow/run_task/contracts.js'

export type RunTaskWorkflowOptions = Omit<RunContextOptions, 'configPath' | 'customerTaskConfigPath'> & {
  /** 任务配置路径；保留 configPath 名称以兼容 GUI/CLI 入口。 */
  configPath?: string
  /** 本地请求配置路径，未提供时使用生产默认值。 */
  localConfigPath?: string
  rebase?: boolean
  skipUpgradeCheck?: boolean
  renderWindow?: BrowserWindow | null
  onRunCreated?: (runId: string) => void
}

export type RunTaskWorkflowDependencies = {
  createContext(options: RunContextOptions): RunContext
  readConfig(configPath: string): ReturnType<typeof readCustomerTaskConfig>
  eventSink: WorkflowEventSink
  initAdapter: WorkflowStageAdapter
  fetchAdapter: WorkflowStageAdapter
  generateAdapter: WorkflowStageAdapter
  now(): number
}

const defaultDependencies: RunTaskWorkflowDependencies = {
  createContext: createRunContext,
  readConfig: readCustomerTaskConfig,
  eventSink: Logger,
  initAdapter: new LegacyInitAdapter(),
  fetchAdapter: new LegacyFetchAdapter(),
  generateAdapter: new LegacyGenerateAdapter(),
  now: Date.now,
}

const stageEventCode = {
  init: {
    start: LogEventCode.INIT_START,
    success: LogEventCode.INIT_SUCCESS,
    failure: LogEventCode.INIT_FAILURE,
  },
  fetch: {
    start: LogEventCode.FETCH_START,
    success: LogEventCode.FETCH_SUCCESS,
    partial: LogEventCode.FETCH_PARTIAL_SUCCESS,
    failure: LogEventCode.FETCH_FAILURE,
  },
  generate: {
    start: LogEventCode.GENERATE_START,
    success: LogEventCode.GENERATE_SUCCESS,
    partial: LogEventCode.GENERATE_PARTIAL_SUCCESS,
    failure: LogEventCode.GENERATE_FAILURE,
  },
} as const

/** GUI 与 CLI 共用的唯一任务编排入口。 */
export default class RunTaskWorkflow {
  private readonly dependencies: RunTaskWorkflowDependencies

  constructor(dependencies: Partial<RunTaskWorkflowDependencies> = {}) {
    this.dependencies = { ...defaultDependencies, ...dependencies }
  }

  init(options: RunTaskWorkflowOptions = {}): Promise<ExecutionResult<RunTaskWorkflowOutput>> {
    return this.execute('init', options)
  }

  fetch(options: RunTaskWorkflowOptions = {}): Promise<ExecutionResult<RunTaskWorkflowOutput>> {
    return this.execute('fetch', options)
  }

  generate(options: RunTaskWorkflowOptions = {}): Promise<ExecutionResult<RunTaskWorkflowOutput>> {
    return this.execute('generate', options)
  }

  run(options: RunTaskWorkflowOptions = {}): Promise<ExecutionResult<RunTaskWorkflowOutput>> {
    return this.execute('run', options)
  }

  private async execute(
    action: WorkflowAction,
    options: RunTaskWorkflowOptions,
  ): Promise<ExecutionResult<RunTaskWorkflowOutput>> {
    const context = this.dependencies.createContext({
      ...options,
      configPath: options.localConfigPath,
      customerTaskConfigPath: options.configPath,
    })
    options.onRunCreated?.(context.runId)

    return runWithLogCorrelation({ traceId: context.traceId, runId: context.runId }, async () => {
      const startedAt = this.dependencies.now()
      this.emit(context, {
        eventCode: LogEventCode.WORKFLOW_START,
        stage: context.trigger === 'gui' ? LogStage.IPC : LogStage.CLI,
        status: LogStatus.START,
        level: LogLevel.INFO,
        message: `开始执行 ${action} workflow`,
        details: { action },
      })

      try {
        const config = action === 'init'
          ? undefined
          : this.dependencies.readConfig(context.customerTaskConfigPath)
        const stageList = this.getStageList(action)
        const summaries: WorkflowStageSummary[] = []

        for (const stage of stageList) {
          const result = await this.runStage(stage, context, options, config)
          summaries.push({ stage, result })
          if (result.status === ExecutionStatus.FAILURE) {
            return this.completeFailure(action, context, startedAt, summaries, result)
          }
        }

        const output: RunTaskWorkflowOutput = { context, action, stages: summaries }
        const failures = summaries.flatMap((summary) => summary.result.failures)
        const successCount = summaries.reduce((total, summary) => total + summary.result.successCount, 0)
        const result = failures.length > 0
          ? createExecutionPartial(output, successCount, failures)
          : createExecutionSuccess(output, successCount)

        this.emit(context, {
          eventCode: result.status === ExecutionStatus.PARTIAL_SUCCESS
            ? LogEventCode.WORKFLOW_PARTIAL_SUCCESS
            : LogEventCode.WORKFLOW_SUCCESS,
          stage: context.trigger === 'gui' ? LogStage.IPC : LogStage.CLI,
          status: result.status === ExecutionStatus.PARTIAL_SUCCESS
            ? LogStatus.PARTIAL_SUCCESS
            : LogStatus.SUCCESS,
          level: result.status === ExecutionStatus.PARTIAL_SUCCESS ? LogLevel.WARN : LogLevel.INFO,
          durationMs: this.dependencies.now() - startedAt,
          message: result.status === ExecutionStatus.PARTIAL_SUCCESS
            ? `${action} workflow 部分完成`
            : `${action} workflow 完成`,
          details: { action, stageCount: summaries.length },
        })
        return result
      } catch (error) {
        const appError = ApplicationError.from(error, {
          code: AppErrorCode.WORKFLOW_FAILED,
          message: `${action} workflow 执行失败`,
          serviceLevel: ServiceLevel.S1,
          stage: action,
          retryable: false,
        })
        const result = createExecutionFailure<RunTaskWorkflowOutput>(appError)
        this.emitFailure(context, action, startedAt, appError)
        return result
      }
    })
  }

  private getStageList(action: WorkflowAction): WorkflowStage[] {
    switch (action) {
      case 'init': return ['init']
      case 'fetch': return ['fetch']
      case 'generate': return ['generate']
      case 'run': return ['init', 'fetch', 'generate']
    }
  }

  private async runStage(
    stage: WorkflowStage,
    context: RunContext,
    options: RunTaskWorkflowOptions,
    config: ReturnType<typeof readCustomerTaskConfig> | undefined,
  ): Promise<ExecutionResult> {
    const startedAt = this.dependencies.now()
    const adapter = this.dependencies[`${stage}Adapter`]
    const eventCodes = stageEventCode[stage]
    this.emit(context, {
      eventCode: eventCodes.start,
      stage,
      status: LogStatus.START,
      level: LogLevel.INFO,
      message: `开始 ${stage} 阶段`,
    })

    try {
      const result = await adapter.execute({
        context,
        config,
        rebase: options.rebase ?? false,
        skipUpgradeCheck: options.skipUpgradeCheck ?? false,
        renderWindow: options.renderWindow,
      })
      const status = result.status === ExecutionStatus.PARTIAL_SUCCESS
        ? LogStatus.PARTIAL_SUCCESS
        : result.status === ExecutionStatus.FAILURE
          ? LogStatus.FAILURE
          : LogStatus.SUCCESS
      const eventCode = result.status === ExecutionStatus.PARTIAL_SUCCESS && 'partial' in eventCodes
        ? eventCodes.partial
        : result.status === ExecutionStatus.FAILURE
          ? eventCodes.failure
          : eventCodes.success
      this.emit(context, {
        eventCode,
        stage,
        status,
        level: result.status === ExecutionStatus.SUCCESS ? LogLevel.INFO : LogLevel.WARN,
        durationMs: this.dependencies.now() - startedAt,
        message: `${stage} 阶段${status === LogStatus.SUCCESS ? '完成' : status === LogStatus.FAILURE ? '失败' : '部分完成'}`,
        details: { successCount: result.successCount, failureCount: result.failureCount },
      })
      return result
    } catch (error) {
      const defaults = this.stageErrorDefaults(stage)
      const appError = ApplicationError.from(error, defaults)
      this.emit(context, {
        eventCode: eventCodes.failure,
        stage,
        status: LogStatus.FAILURE,
        level: LogLevel.ERROR,
        serviceLevel: appError.serviceLevel,
        errorCode: appError.code,
        error: Logger.serializeError(appError),
        durationMs: this.dependencies.now() - startedAt,
        message: `${stage} 阶段失败`,
      })
      return createExecutionFailure(appError)
    }
  }

  private completeFailure(
    action: WorkflowAction,
    context: RunContext,
    startedAt: number,
    summaries: WorkflowStageSummary[],
    failure: ExecutionResult,
  ): ExecutionResult<RunTaskWorkflowOutput> {
    const output: RunTaskWorkflowOutput = { context, action, stages: summaries }
    const result: ExecutionResult<RunTaskWorkflowOutput> = {
      status: ExecutionStatus.FAILURE,
      value: output,
      successCount: summaries.reduce((total, summary) => total + summary.result.successCount, 0),
      failureCount: failure.failureCount,
      failures: failure.failures,
    }
    const error = failure.failures[0]?.error
      ? ApplicationError.fromSerialized(failure.failures[0].error)
      : new ApplicationError({
          code: AppErrorCode.WORKFLOW_FAILED,
          message: `${action} workflow 返回失败结果`,
          serviceLevel: ServiceLevel.S1,
          stage: action,
          retryable: false,
        })
    this.emitFailure(context, action, startedAt, error)
    return result
  }

  private emitFailure(context: RunContext, action: WorkflowAction, startedAt: number, error: ApplicationError): void {
    this.emit(context, {
      eventCode: LogEventCode.WORKFLOW_FAILURE,
      stage: context.trigger === 'gui' ? LogStage.IPC : LogStage.CLI,
      status: LogStatus.FAILURE,
      level: LogLevel.ERROR,
      serviceLevel: error.serviceLevel,
      errorCode: error.code,
      error: Logger.serializeError(error),
      durationMs: this.dependencies.now() - startedAt,
      message: `${action} workflow 失败`,
      details: { action },
    })
  }

  private stageErrorDefaults(stage: WorkflowStage) {
    return {
      code: stage === 'init'
        ? AppErrorCode.INITIALIZATION_FAILED
        : stage === 'fetch'
          ? AppErrorCode.FETCH_FAILED
          : AppErrorCode.GENERATE_FAILED,
      message: `${stage} 阶段执行失败`,
      serviceLevel: stage === 'init' ? ServiceLevel.S0 : ServiceLevel.S1,
      stage,
      retryable: stage === 'fetch',
    }
  }

  private emit(context: RunContext, entry: Parameters<WorkflowEventSink['event']>[0]): void {
    this.dependencies.eventSink.event({
      traceId: context.traceId,
      runId: context.runId,
      ...entry,
    }, context.logPath)
  }
}
