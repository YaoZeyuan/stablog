import type { BrowserWindow } from 'electron'
import type { CustomerTaskConfig } from '~/src/shared/config/task_config.js'
import type { StructuredLogEntry } from '~/src/shared/logging/log_contract.js'
import type { ExecutionResult } from '~/src/shared/runtime/execution_result.js'
import type { RunContext } from '~/src/shared/runtime/run_context.js'

export type WorkflowAction = 'init' | 'fetch' | 'generate' | 'run'
export type WorkflowStage = 'init' | 'fetch' | 'generate'

export type WorkflowStageInput = {
  context: RunContext
  config?: CustomerTaskConfig
  action: WorkflowAction
  willGenerate: boolean
  runtimeState: {
    batchId?: string
  }
  fetchSession?: {
    cookie?: string
    loginUid?: string
  }
  rebase: boolean
  skipUpgradeCheck: boolean
  renderWindow?: BrowserWindow | null
}

export interface WorkflowStageAdapter {
  execute(input: WorkflowStageInput): Promise<ExecutionResult>
}

export interface WorkflowEventSink {
  event(entry: StructuredLogEntry, logPath: string): unknown
}

export type WorkflowStageSummary = {
  stage: WorkflowStage
  result: ExecutionResult
}

export type RunTaskWorkflowOutput = {
  context: RunContext
  action: WorkflowAction
  stages: WorkflowStageSummary[]
}
