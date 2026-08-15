import fs from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'
import {
  assertRunnableCustomerTaskConfig,
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
    postAtOrderBy: 'asc',
    fetchStartDate: '2020-01-01',
    fetchEndDate: '2020-01-31',
    requestIntervalSeconds: 10,
    cacheReadMode: 'prefer-cache',
    outputStartAtMs: 0,
    outputEndAtMs: 100,
    isSkipFetch: false,
    isSkipGeneratePdf: false,
    isRegenerateHtml2PdfImage: false,
    isOnlyArticle: false,
    isOnlyOriginal: false,
    volumeSplitBy: 'single',
    volumeSplitCount: 100,
  }
}

describe('任务配置校验规则', () => {
  let sandbox: TestSandbox | undefined

  afterEach(() => {
    sandbox?.cleanup()
    sandbox = undefined
  })

  it('校验并保留完整的第一阶段配置', () => {
    expect(parseCustomerTaskConfig(validTaskConfig())).toMatchObject({
      configList: [{ uid: '10001' }],
      imageQuilty: 'default',
      fetchEndDate: '2020-01-31',
      requestIntervalSeconds: 10,
      volumeSplitBy: 'single',
    })
  })

  it('将无效日期范围转换为稳定的配置错误', () => {
    const input = { ...validTaskConfig(), fetchStartDate: '2020-02-01', fetchEndDate: '2020-01-31' }
    expect(() => parseCustomerTaskConfig(input)).toThrowError(ApplicationError)
    try {
      parseCustomerTaskConfig(input)
    } catch (error) {
      expect(error).toMatchObject({ code: AppErrorCode.CONFIG_SCHEMA_INVALID, stage: 'config' })
    }
  })

  it('运行配置拒绝重复目标用户', () => {
    const input = validTaskConfig()
    input.configList = [
      { uid: '10001', rawInputText: '', comment: '' },
      { uid: '10001', rawInputText: '', comment: '重复' },
    ]
    expect(() => assertRunnableCustomerTaskConfig(parseCustomerTaskConfig(input)))
      .toThrowError(ApplicationError)
  })

  it('运行配置拒绝带空白、无法直接用于接口和缓存身份的用户编号', () => {
    const input = validTaskConfig()
    input.configList = [{ uid: ' 10001 ', rawInputText: '', comment: '' }]
    expect(() => assertRunnableCustomerTaskConfig(parseCustomerTaskConfig(input)))
      .toThrowError(ApplicationError)
  })

  it('只在临时沙箱读写配置', () => {
    sandbox = createTestSandbox('task-config')
    writeCustomerTaskConfig(sandbox.customerTaskConfigPath, validTaskConfig())
    expect(fs.existsSync(sandbox.customerTaskConfigPath)).toBe(true)
    expect(readCustomerTaskConfig(sandbox.customerTaskConfigPath).configList[0].uid).toBe('10001')
  })
})
