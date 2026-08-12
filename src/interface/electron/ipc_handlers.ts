import fs from 'node:fs'
import path from 'node:path'
import axios from 'axios'
import type {
  BrowserWindow,
  Dialog,
  IpcMain,
  Session,
  Shell,
} from 'electron'
import DataTransferExport from '~/src/command/datatransfer/export.js'
import DataTransferImport from '~/src/command/datatransfer/import.js'
import ConfigHelperUtil from '~/src/library/util/config_helper.js'
import PathConfig from '~/src/config/path.js'
import Logger from '~/src/library/logger.js'
import MBlog from '~/src/model/mblog.js'
import MUser from '~/src/model/mblog_user.js'
import MFetchErrorRecord from '~/src/model/fetch_error_record.js'
import RunTaskWorkflow from '~/src/application/workflow/run_task/run_task_workflow.js'
import { readCustomerTaskConfig, writeCustomerTaskConfig } from '~/src/shared/config/task_config.js'
import {
  parseFileReadRequest,
  parseFileWriteRequest,
  parseIpcTraceMetadata,
  parseDataTransferExportRequest,
  parseDataTransferImportRequest,
  parseResolveWeiboUidRequest,
  parseStartCustomerTaskRequest,
  parseWeiboUserInfoRequest,
  assertAllowedIpcPath,
  type WeiboLoginStatus,
  type WeiboUserSummary,
} from '~/src/shared/ipc/contract.js'
import { createIpcFailure, createIpcSuccess, IpcResult } from '~/src/shared/ipc/result.js'
import { ApplicationError, AppErrorCode, ServiceLevel } from '~/src/shared/error/application_error.js'
import { LogEventCode, LogLevel, LogStage, LogStatus } from '~/src/shared/logging/log_contract.js'
import CommonConfig from '~/src/config/common.js'

type RegisterIpcHandlersOptions = {
  ipcMain: IpcMain
  session: Session
  shell: Shell
  dialog: Dialog
  mainWindow: BrowserWindow
  getRenderWindow: () => BrowserWindow | null
}

type PathPayload = { targetPath?: unknown }

function requirePathPayload(payload: unknown): string {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new ApplicationError({
      code: AppErrorCode.IPC_PAYLOAD_INVALID,
      message: '路径请求参数必须是对象',
      serviceLevel: ServiceLevel.S2,
      stage: 'ipc',
      retryable: false,
    })
  }
  const targetPath = (payload as PathPayload).targetPath
  if (typeof targetPath !== 'string' || targetPath.trim() === '') {
    throw new ApplicationError({
      code: AppErrorCode.IPC_PAYLOAD_INVALID,
      message: 'targetPath必须是非空字符串',
      serviceLevel: ServiceLevel.S2,
      stage: 'ipc',
      retryable: false,
    })
  }
  return targetPath
}

function assertAllowedDataPath(targetPath: string): string {
  return assertAllowedIpcPath(targetPath, {
    allowedFiles: [PathConfig.configUri, PathConfig.customerTaskConfigUri],
    allowedDirectories: [PathConfig.cachePath, PathConfig.outputPath, PathConfig.logPath],
  })
}

function assertSamePath(actualPath: string, expectedPath: string, operation: string): string {
  const actual = path.resolve(actualPath)
  const expected = path.resolve(expectedPath)
  if (actual !== expected) {
    throw new ApplicationError({
      code: AppErrorCode.IPC_PAYLOAD_INVALID,
      message: `${operation}路径未由当前主进程对话框授权`,
      serviceLevel: ServiceLevel.S0,
      stage: 'ipc',
      retryable: false,
    })
  }
  return actual
}

function errorDefaultsForChannel(channel: string) {
  if (channel === 'start-customer-task') {
    return { code: AppErrorCode.WORKFLOW_FAILED, serviceLevel: ServiceLevel.S1, stage: 'workflow' }
  }
  if (channel.startsWith('get-') && (channel.includes('user') || channel.includes('mblog') || channel.includes('distribution'))) {
    return { code: AppErrorCode.DATABASE_FAILED, serviceLevel: ServiceLevel.S2, stage: 'database' }
  }
  if (
    channel.includes('file') || channel.includes('config') || channel.includes('dialog') ||
    channel.includes('transfer') || channel.includes('folder') || channel.includes('output')
  ) {
    return { code: AppErrorCode.FILE_SYSTEM_FAILED, serviceLevel: ServiceLevel.S2, stage: 'filesystem' }
  }
  return { code: AppErrorCode.UNKNOWN_ERROR, serviceLevel: ServiceLevel.S2, stage: 'ipc' }
}

async function getWeiboCookie(session: Session): Promise<string> {
  const cookieMap = new Map<string, string>()
  for (const url of ['https://m.weibo.cn/', 'https://weibo.com/']) {
    const cookieList = await session.cookies.get({ url })
    for (const cookie of cookieList) {
      cookieMap.set(cookie.name, cookie.value)
    }
  }
  return [...cookieMap].map(([name, value]) => `${name}=${value}`).join('; ')
}

function directUidFromWeiboUrl(rawInputUrl: string): string {
  const parsed = new URL(rawInputUrl)
  const match = parsed.pathname.match(/^\/(?:u|profile)\/(\d+)/)
  return match?.[1] ?? ''
}

export function registerIpcHandlers(options: RegisterIpcHandlersOptions): void {
  const { ipcMain, session, shell, dialog, mainWindow } = options
  let activeRunId: string | undefined
  let approvedExportPath: string | undefined
  let approvedImportPath: string | undefined

  const handle = <T>(
    channel: string,
    handler: (payload: unknown, metadata: unknown) => Promise<T> | T,
  ) => {
    ipcMain.removeHandler(channel)
    ipcMain.handle(channel, async (_event, payload, metadata): Promise<IpcResult<T>> => {
      const startedAt = Date.now()
      let traceId: string | undefined
      try {
        traceId = parseIpcTraceMetadata(metadata).traceId
        Logger.event({
          traceId,
          eventCode: LogEventCode.IPC_REQUEST_START,
          stage: LogStage.IPC,
          status: LogStatus.START,
          level: LogLevel.INFO,
          message: `IPC请求开始：${channel}`,
        })
        const value = await handler(payload, metadata)
        Logger.event({
          traceId,
          eventCode: LogEventCode.IPC_REQUEST_SUCCESS,
          stage: LogStage.IPC,
          status: LogStatus.SUCCESS,
          level: LogLevel.INFO,
          durationMs: Date.now() - startedAt,
          message: `IPC请求完成：${channel}`,
        })
        return createIpcSuccess(value)
      } catch (error) {
        const defaults = errorDefaultsForChannel(channel)
        const appError = ApplicationError.from(error, {
          ...defaults,
          retryable: false,
        })
        Logger.event({
          traceId,
          eventCode: LogEventCode.IPC_REQUEST_FAILURE,
          stage: LogStage.IPC,
          status: LogStatus.FAILURE,
          level: LogLevel.ERROR,
          serviceLevel: appError.serviceLevel,
          errorCode: appError.code,
          error: Logger.serializeError(appError),
          durationMs: Date.now() - startedAt,
          message: `IPC请求失败：${channel}`,
        })
        return createIpcFailure(appError)
      }
    })
  }

  handle('get-path-config', () => ({
    configUri: PathConfig.configUri,
    customerTaskConfigUri: PathConfig.customerTaskConfigUri,
    outputPath: PathConfig.outputPath,
    runtimeLogUri: PathConfig.runtimeLogUri,
  }))
  handle('get-task-config', () => readCustomerTaskConfig(PathConfig.customerTaskConfigUri))
  handle('save-task-config', (payload) => {
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new TypeError('save-task-config payload必须是对象')
    }
    return writeCustomerTaskConfig(
      PathConfig.customerTaskConfigUri,
      (payload as { taskConfig?: unknown }).taskConfig,
    )
  })
  handle('get-file-content', (payload) => {
    const { uri } = parseFileReadRequest(payload)
    const safePath = assertAllowedDataPath(uri)
    return fs.existsSync(safePath) ? fs.readFileSync(safePath, 'utf8') : ''
  })
  handle('write-file-content', (payload) => {
    const { uri, content } = parseFileWriteRequest(payload)
    const safePath = assertAllowedDataPath(uri)
    fs.mkdirSync(path.dirname(safePath), { recursive: true })
    fs.writeFileSync(safePath, content, 'utf8')
    return true
  })
  handle('open-output-dir', async () => {
    const errorMessage = await shell.openPath(PathConfig.outputPath)
    if (errorMessage) {
      throw new Error(errorMessage)
    }
    return true
  })
  handle('show-item-in-folder', (payload) => {
    shell.showItemInFolder(assertAllowedDataPath(requirePathPayload(payload)))
    return true
  })
  handle('open-external', async (payload) => {
    const targetPath = requirePathPayload(payload)
    const parsed = new URL(targetPath)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new TypeError('只允许打开HTTP(S)网址')
    }
    await shell.openExternal(targetPath)
    return true
  })
  handle('reset-session', async () => {
    await session.clearCache()
    await session.clearStorageData()
    await session.clearHostResolverCache()
    return true
  })
  handle('open-devtools', () => {
    mainWindow.webContents.openDevTools()
    return true
  })
  handle('show-save-dialog', (payload) => {
    const selectedPath = dialog.showSaveDialogSync(mainWindow, payload as Electron.SaveDialogSyncOptions)
    approvedExportPath = selectedPath === undefined ? undefined : path.resolve(selectedPath)
    return selectedPath
  })
  handle('show-open-dialog', (payload) => {
    const selectedPathList = dialog.showOpenDialogSync(mainWindow, payload as Electron.OpenDialogSyncOptions) ?? []
    approvedImportPath = selectedPathList[0] === undefined ? undefined : path.resolve(selectedPathList[0])
    return selectedPathList
  })
  handle('get-weibo-login-status', async (): Promise<WeiboLoginStatus> => {
    const cookie = await getWeiboCookie(session)
    const response = await axios.get('https://m.weibo.cn/api/config', {
      timeout: 10_000,
      headers: { cookie, accept: 'application/json, text/plain, */*' },
    })
    const data = response.data?.data
    return {
      isLogin: data?.login === true,
      uid: data?.uid === undefined ? '' : String(data.uid),
    }
  })
  handle('resolve-weibo-uid', async (payload) => {
    const { rawInputUrl } = parseResolveWeiboUidRequest(payload)
    const directUid = directUidFromWeiboUrl(rawInputUrl)
    if (directUid !== '') {
      return directUid
    }
    const cookie = await getWeiboCookie(session)
    const response = await axios.get(rawInputUrl, {
      timeout: 10_000,
      maxRedirects: 5,
      headers: { cookie },
    })
    const finalUrl = response.request?.res?.responseUrl ?? response.request?.responseURL ?? ''
    const finalUid = typeof finalUrl === 'string' && finalUrl !== '' ? directUidFromWeiboUrl(finalUrl) : ''
    const htmlMatch = typeof response.data === 'string'
      ? response.data.match(/\$CONFIG\['(?:oid|uid)'\]='(\d+)'/)
      : null
    return finalUid || htmlMatch?.[1] || ''
  })
  handle('get-weibo-user-info', async (payload): Promise<WeiboUserSummary> => {
    const { uid } = parseWeiboUserInfoRequest(payload)
    const cookie = await getWeiboCookie(session)
    const response = await axios.get('https://m.weibo.cn/api/container/getIndex', {
      timeout: 10_000,
      params: { type: 'uid', value: uid, containerid: `100505${uid}` },
      headers: { cookie, accept: 'application/json, text/plain, */*' },
    })
    const userInfo = response.data?.data?.userInfo ?? {}
    const statusesCount = Number(userInfo.statuses_count) || 0
    return {
      screen_name: typeof userInfo.screen_name === 'string' ? userInfo.screen_name : '',
      statuses_count: statusesCount,
      total_page_count: Math.floor(statusesCount / 10),
      followers_count: Number(userInfo.followers_count) || 0,
    }
  })
  handle('check-upgrade', async () => {
    const response = await axios.get(CommonConfig.checkUpgradeUri, {
      timeout: 10_000,
      params: { now: new Date().toISOString() },
    })
    return response.data
  })
  handle('get-user-list', () => MUser.asyncGetUserList())
  handle('get-weibo-distribution', (payload) => MBlog.asyncGetWeiboDistribution(...payload as Parameters<typeof MBlog.asyncGetWeiboDistribution>))
  handle('get-mblog-list', (payload) => MBlog.asyncGetMblogList(...payload as Parameters<typeof MBlog.asyncGetMblogList>))
  handle('get-fetch-error-distribution', (payload) => {
    const authorUid = (payload as { author_uid?: unknown })?.author_uid
    if (typeof authorUid !== 'string') {
      throw new TypeError('author_uid必须是字符串')
    }
    return MFetchErrorRecord.asyncGetErrorDistributionCount(authorUid)
  })
  handle('data-transfer-export', async (payload) => {
    const exportRequest = parseDataTransferExportRequest(payload)
    if (approvedExportPath === undefined) {
      throw new TypeError('请先通过保存对话框选择导出文件')
    }
    exportRequest.exportUri = assertSamePath(exportRequest.exportUri, approvedExportPath, '导出')
    approvedExportPath = undefined
    const command = new DataTransferExport()
    await command.handle(exportRequest, {})
    return true
  })
  handle('data-transfer-import', async (payload) => {
    const importRequest = parseDataTransferImportRequest(payload)
    if (approvedImportPath === undefined) {
      throw new TypeError('请先通过打开对话框选择导入文件')
    }
    importRequest.importUri = assertSamePath(importRequest.importUri, approvedImportPath, '导入')
    approvedImportPath = undefined
    const command = new DataTransferImport()
    await command.handle(importRequest, {})
    return true
  })
  handle('start-customer-task', async (payload, metadata) => {
    if (activeRunId !== undefined) {
      return { status: 'running', runId: activeRunId }
    }
    const { config } = parseStartCustomerTaskRequest(payload)
    const traceId = parseIpcTraceMetadata(metadata).traceId
    // Reserve synchronously before reading cookies so concurrent requests cannot both start.
    activeRunId = traceId ?? 'pending'
    try {
      const cookie = await getWeiboCookie(session)
      const localConfig = JSON.parse(fs.readFileSync(PathConfig.configUri, 'utf8')) as Record<string, unknown>
      const requestConfig = (localConfig.request ?? {}) as Record<string, unknown>
      requestConfig.cookie = cookie
      localConfig.request = requestConfig
      fs.writeFileSync(PathConfig.configUri, `${JSON.stringify(localConfig, null, 2)}\n`, 'utf8')
      writeCustomerTaskConfig(PathConfig.customerTaskConfigUri, config)
      ConfigHelperUtil.reloadConfig()
      const renderWindow = options.getRenderWindow()
      const workflow = new RunTaskWorkflow()
      const result = await workflow.run({
        trigger: 'gui',
        traceId,
        configPath: PathConfig.customerTaskConfigUri,
        renderWindow,
        onRunCreated(runId) {
          activeRunId = runId
        },
      })
      if (result.status === 'failure') {
        const serialized = result.failures[0]?.error
        throw serialized
          ? ApplicationError.fromSerialized(serialized)
          : new ApplicationError({
              code: AppErrorCode.WORKFLOW_FAILED,
              message: 'GUI 备份 workflow 执行失败',
              serviceLevel: ServiceLevel.S1,
              stage: 'ipc',
              retryable: false,
            })
      }
      const openError = await shell.openPath(result.value?.context.outputPath ?? PathConfig.outputPath)
      if (openError) {
        Logger.warn(`无法自动打开输出目录：${openError}`)
      }
      return result
    } finally {
      activeRunId = undefined
    }
  })
}
