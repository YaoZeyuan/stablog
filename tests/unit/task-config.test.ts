import fs from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'
import {
  parseCustomerTaskConfig,
  readCustomerTaskConfig,
  writeCustomerTaskConfig,
} from '../../src/shared/config/task_config.js'
import { AppErrorCode, ApplicationError } from '../../src/shared/error/application_error.js'
import { createTestSandbox, TestSandbox } from '../helpers/sandbox.js'

function validTaskConfig(): Record<string, unknown> {
  return {
    configList: [{ uid: '10001', rawInputText: 'https://weibo.com/u/10001', comment: '' }],
    imageQuilty: 'default',
    bookTitle: '测试任务',
    comment: '',
    enableAutoConfig: false,
    postAtOrderBy: 'asc',
    fetchStartAtPageNo: 0,
    fetchEndAtPageNo: 10,
    outputStartAtMs: 0,
    outputEndAtMs: 100,
    onlyRetry: false,
    isSkipFetch: false,
    isSkipGeneratePdf: false,
    isRegenerateHtml2PdfImage: false,
    isOnlyArticle: false,
    isOnlyOriginal: false,
    volumeSplitBy: 'single',
    volumeSplitCount: 100,
  }
}

describe('任务配置 schema', () => {
  let sandbox: TestSandbox | undefined

  afterEach(() => {
    sandbox?.cleanup()
    sandbox = undefined
  })

  it('校验并保留完整的第一阶段配置', () => {
    expect(parseCustomerTaskConfig(validTaskConfig())).toMatchObject({
      configList: [{ uid: '10001' }],
      imageQuilty: 'default',
      fetchEndAtPageNo: 10,
      volumeSplitBy: 'single',
    })
  })

  it('将无效页码范围转换为稳定的配置错误', () => {
    const input = { ...validTaskConfig(), fetchStartAtPageNo: 5, fetchEndAtPageNo: 4 }
    expect(() => parseCustomerTaskConfig(input)).toThrowError(ApplicationError)
    try {
      parseCustomerTaskConfig(input)
    } catch (error) {
      expect(error).toMatchObject({ code: AppErrorCode.CONFIG_SCHEMA_INVALID, stage: 'config' })
    }
  })

  it('只在临时沙箱读写配置', () => {
    sandbox = createTestSandbox('task-config')
    writeCustomerTaskConfig(sandbox.customerTaskConfigPath, validTaskConfig())
    expect(fs.existsSync(sandbox.customerTaskConfigPath)).toBe(true)
    expect(readCustomerTaskConfig(sandbox.customerTaskConfigPath).configList[0].uid).toBe('10001')
  })
})
