import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type {
  WorkflowStageAdapter,
  WorkflowStageInput,
} from '../../src/application/workflow/run_task/contracts.js'
import RunTaskWorkflow from '../../src/application/workflow/run_task/run_task_workflow.js'
import { createTestSandbox, TestSandbox } from '../helpers/sandbox.js'
import {
  AppErrorCode,
  ApplicationError,
  ServiceLevel,
} from '../../src/shared/error/application_error.js'
import {
  createExecutionSuccess,
  ExecutionStatus,
} from '../../src/shared/runtime/execution_result.js'
import { createRunContext } from '../../src/shared/runtime/run_context.js'

const validConfig = {
  configList: [{ uid: '123', rawInputText: 'https://weibo.com/u/123', comment: '' }],
  imageQuilty: 'default' as const,
  bookTitle: '',
  comment: '',
  enableAutoConfig: true,
  postAtOrderBy: 'asc' as const,
  fetchStartAtPageNo: 0,
  fetchEndAtPageNo: 2,
  outputStartAtMs: 0,
  outputEndAtMs: 10,
  onlyRetry: false,
  isSkipFetch: false,
  isSkipGeneratePdf: true,
  isRegenerateHtml2PdfImage: false,
  isOnlyArticle: false,
  isOnlyOriginal: false,
  volumeSplitBy: 'single' as const,
  volumeSplitCount: 100,
}

function adapter(handler: (input: WorkflowStageInput) => Promise<void> | void): WorkflowStageAdapter {
  return {
    async execute(input) {
      await handler(input)
      return createExecutionSuccess(undefined, 1)
    },
  }
}

function createWorkflow(sandbox: TestSandbox, calls: string[], failingStage?: string) {
  const event = vi.fn()
  const stageAdapter = (stage: string) => adapter(() => {
    calls.push(stage)
    if (stage === failingStage) {
      throw new ApplicationError({
        code: stage === 'fetch' ? AppErrorCode.FETCH_FAILED : AppErrorCode.GENERATE_FAILED,
        message: `${stage} failed`,
        serviceLevel: ServiceLevel.S1,
        stage,
        retryable: false,
      })
    }
  })
  return {
    event,
    workflow: new RunTaskWorkflow({
      createContext: (options) => createRunContext({
        ...options,
        rootPath: sandbox.rootPath,
        resourcePath: path.join(sandbox.rootPath, 'resource'),
        configPath: sandbox.configPath,
        customerTaskConfigPath: sandbox.customerTaskConfigPath,
        databasePath: sandbox.databasePath,
        cachePath: sandbox.cachePath,
        logPath: sandbox.logPath,
        outputPath: sandbox.outputPath,
      }),
      readConfig: () => validConfig,
      eventSink: { event },
      initAdapter: stageAdapter('init'),
      fetchAdapter: stageAdapter('fetch'),
      generateAdapter: stageAdapter('generate'),
      now: (() => {
        let value = 0
        return () => ++value
      })(),
    }),
  }
}

describe('RunTaskWorkflow 离线集成', () => {
  const sandboxList: TestSandbox[] = []
  afterEach(() => sandboxList.splice(0).forEach((sandbox) => sandbox.cleanup()))

  it('按 init、fetch、generate 顺序执行并返回结构化成功结果', async () => {
    const sandbox = createTestSandbox('workflow-success')
    sandboxList.push(sandbox)
    const calls: string[] = []
    const { workflow, event } = createWorkflow(sandbox, calls)

    const result = await workflow.run({
      configPath: sandbox.customerTaskConfigPath,
      localConfigPath: sandbox.configPath,
      trigger: 'gui',
    })

    expect(result.status).toBe(ExecutionStatus.SUCCESS)
    expect(result.value?.context.customerTaskConfigPath).toBe(sandbox.customerTaskConfigPath)
    expect(result.value?.stages.map((item) => item.stage)).toEqual(['init', 'fetch', 'generate'])
    expect(calls).toEqual(['init', 'fetch', 'generate'])
    expect(event).toHaveBeenCalled()
  })

  it('抓取失败后停止生成并返回可序列化失败', async () => {
    const sandbox = createTestSandbox('workflow-failure')
    sandboxList.push(sandbox)
    const calls: string[] = []
    const { workflow } = createWorkflow(sandbox, calls, 'fetch')

    const result = await workflow.run({ configPath: sandbox.customerTaskConfigPath })

    expect(result.status).toBe(ExecutionStatus.FAILURE)
    expect(result.failures).toHaveLength(1)
    expect(result.failures[0].error.code).toBe(AppErrorCode.FETCH_FAILED)
    expect(calls).toEqual(['init', 'fetch'])
  })

  it('独立 fetch 不执行初始化与生成并使用隔离路径', async () => {
    const sandbox = createTestSandbox('workflow-fetch')
    sandboxList.push(sandbox)
    const calls: string[] = []
    const { workflow } = createWorkflow(sandbox, calls)

    const result = await workflow.fetch({ configPath: sandbox.customerTaskConfigPath })

    expect(result.status).toBe(ExecutionStatus.SUCCESS)
    expect(calls).toEqual(['fetch'])
    expect(result.value?.context.databasePath).toBe(sandbox.databasePath)
    expect(result.value?.context.outputPath).toBe(sandbox.outputPath)
  })
})
