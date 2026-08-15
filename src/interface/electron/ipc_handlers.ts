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
import PathConfig from '~/src/config/path.js'
import DatabaseConfig from '~/src/config/database.js'
import Logger from '~/src/library/logger.js'
import MBlog from '~/src/model/mblog.js'
import MUser from '~/src/model/mblog_user.js'
import MFetchErrorRecord from '~/src/model/fetch_error_record.js'
import {
  createDefaultCustomerTaskConfig,
  readCustomerTaskConfig,
  writeCustomerTaskConfig,
} from '~/src/shared/config/task_config.js'
import CustomerTaskRunManager from '~/src/application/fetch/customer_task_run_manager.js'
import WeiboApiClient, { resolveWeiboLoginUid } from '~/src/api/weibo_api_client.js'
import { globalWeiboRequestLimiter } from '~/src/application/fetch/weibo_request_limiter.js'
import { WeiboResponseCache } from '~/src/application/fetch/weibo_response_cache.js'
import { adaptProfileInfoUser } from '~/src/application/fetch/weibo_canonical_adapter.js'
import {
  parseFileReadRequest,
  parseFileWriteRequest,
  parseIpcTraceMetadata,
  parseDataTransferExportRequest,
  parseDataTransferImportRequest,
  parseResolveWeiboUidRequest,
  parseStartCustomerTaskRequest,
  parseContinueCustomerTaskRequest,
  parseRetryCustomerTaskItemsRequest,
  parseCustomerTaskDashboardRequest,
  parseCustomerTaskFailuresRequest,
  parseClearWeiboRequestCacheRequest,
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
  if (
    channel === 'start-customer-task' ||
    channel === 'continue-customer-task' ||
    channel === 'retry-customer-task-items' ||
    channel === 'get-customer-task-dashboard' ||
    channel === 'get-customer-task-failures' ||
    channel === 'clear-weibo-request-cache'
  ) {
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
  return [...cookieMap]
    .sort(([leftName], [rightName]) => leftName.localeCompare(rightName))
    .map(([name, value]) => `${name}=${value}`)
    .join('; ')
}

function directUidFromWeiboUrl(rawInputUrl: string): string {
  const parsed = new URL(rawInputUrl)
  const match = parsed.pathname.match(/^\/(?:u|profile)\/(\d+)/)
  return match?.[1] ?? ''
}

export function registerIpcHandlers(options: RegisterIpcHandlersOptions): void {
  const { ipcMain, session, shell, dialog, mainWindow } = options
  const taskRunManager = new CustomerTaskRunManager({
    databasePath: DatabaseConfig.uri,
    localConfigPath: PathConfig.configUri,
    customerTaskConfigPath: PathConfig.customerTaskConfigUri,
    cachePath: PathConfig.cachePath,
    logPath: PathConfig.logPath,
    outputPath: PathConfig.outputPath,
    getRenderWindow: options.getRenderWindow,
    async onCompleted(outputPath) {
      const errorMessage = await shell.openPath(outputPath)
      if (errorMessage !== '') Logger.warn(`无法自动打开输出目录：${errorMessage}`)
    },
  })
  let approvedExportPath: string | undefined
  let approvedImportPath: string | undefined
  let cachedLoginIdentity: { cookie: string; uid: string; expiresAt: number } | undefined

  const getCachedLoginUid = (cookie: string): string | undefined => (
    cachedLoginIdentity !== undefined &&
    cachedLoginIdentity.cookie === cookie &&
    cachedLoginIdentity.expiresAt > Date.now()
      ? cachedLoginIdentity.uid
      : undefined
  )

  const getLoginUid = async (cookie: string): Promise<string> => {
    const cachedUid = getCachedLoginUid(cookie)
    if (cachedUid !== undefined) return cachedUid
    const uid = await resolveWeiboLoginUid({ cookie })
    cachedLoginIdentity = { cookie, uid, expiresAt: Date.now() + 60_000 }
    return uid
  }

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
  handle('get-task-config', async () => {
    if (fs.existsSync(PathConfig.customerTaskConfigUri) === false) {
      return taskRunManager.runMaintenance(async () => writeCustomerTaskConfig(
          PathConfig.customerTaskConfigUri,
          createDefaultCustomerTaskConfig(),
        ), '其他进程正在执行备份，不能创建任务配置')
    }
    return readCustomerTaskConfig(PathConfig.customerTaskConfigUri)
  })
  handle('save-task-config', async (payload) => {
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new TypeError('save-task-config payload必须是对象')
    }
    return taskRunManager.runMaintenance(async () => writeCustomerTaskConfig(
        PathConfig.customerTaskConfigUri,
        (payload as { taskConfig?: unknown }).taskConfig,
      ), '活动任务期间不能修改任务配置')
  })
  handle('reset-task-config', async () => {
    return taskRunManager.runMaintenance(async () => writeCustomerTaskConfig(
        PathConfig.customerTaskConfigUri,
        createDefaultCustomerTaskConfig(),
      ), '活动任务期间不能重置任务配置')
  })
  handle('get-file-content', (payload) => {
    const { uri } = parseFileReadRequest(payload)
    const safePath = assertAllowedDataPath(uri)
    return fs.existsSync(safePath) ? fs.readFileSync(safePath, 'utf8') : ''
  })
  handle('write-file-content', async (payload) => {
    const { uri, content } = parseFileWriteRequest(payload)
    const safePath = assertAllowedDataPath(uri)
    const writeFile = async () => {
      fs.mkdirSync(path.dirname(safePath), { recursive: true })
      fs.writeFileSync(safePath, content, 'utf8')
      return true
    }
    const protectedConfigFiles = [PathConfig.configUri, PathConfig.customerTaskConfigUri]
      .map((value) => path.resolve(value))
    return protectedConfigFiles.includes(path.resolve(safePath))
      ? taskRunManager.runMaintenance(writeFile, '活动任务期间不能修改运行配置')
      : writeFile()
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
    return taskRunManager.runMaintenance(async () => {
      await session.clearCache()
      await session.clearStorageData()
      await session.clearHostResolverCache()
      cachedLoginIdentity = undefined
      return true
    }, '活动任务期间不能退出微博登录')
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
    try {
      return { isLogin: true, uid: await getLoginUid(cookie) }
    } catch {
      return { isLogin: false, uid: '' }
    }
  })
  handle('resolve-weibo-uid', async (payload) => {
    const { rawInputUrl } = parseResolveWeiboUidRequest(payload)
    const directUid = directUidFromWeiboUrl(rawInputUrl)
    if (directUid !== '') {
      return directUid
    }
    const cookie = await getWeiboCookie(session)
    const response = await globalWeiboRequestLimiter.schedule(() => axios.get(rawInputUrl, {
      timeout: 10_000,
      maxRedirects: 5,
      headers: { cookie },
    }))
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
    const loginUid = await getLoginUid(cookie)
    const response = await new WeiboApiClient({
      cookie,
      loginUid,
      limiter: globalWeiboRequestLimiter,
      cache: new WeiboResponseCache(PathConfig.cachePath),
    }).getProfileInfo(uid)
    const userInfo = adaptProfileInfoUser(response.data) as unknown as Record<string, unknown>
    const statusesCount = Number(userInfo.statuses_count) || 0
    return {
      screen_name: typeof userInfo.screen_name === 'string' ? userInfo.screen_name : '',
      statuses_count: statusesCount,
      total_page_count: Math.ceil(statusesCount / 50),
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
    const { config } = parseStartCustomerTaskRequest(payload)
    const traceId = parseIpcTraceMetadata(metadata).traceId
    const cookie = await getWeiboCookie(session)
    return taskRunManager.start(config, cookie, traceId, getCachedLoginUid(cookie))
  })
  handle('continue-customer-task', async (payload, metadata) => {
    const { batchId } = parseContinueCustomerTaskRequest(payload)
    const traceId = parseIpcTraceMetadata(metadata).traceId
    const cookie = await getWeiboCookie(session)
    return taskRunManager.continue(batchId, cookie, traceId, getCachedLoginUid(cookie))
  })
  handle('retry-customer-task-items', async (payload, metadata) => {
    const { batchId, taskIds } = parseRetryCustomerTaskItemsRequest(payload)
    const traceId = parseIpcTraceMetadata(metadata).traceId
    const cookie = await getWeiboCookie(session)
    return taskRunManager.retry(batchId, taskIds, cookie, traceId, getCachedLoginUid(cookie))
  })
  handle('get-customer-task-dashboard', (payload) => {
    const { batchId } = parseCustomerTaskDashboardRequest(payload)
    return taskRunManager.getDashboard(batchId)
  })
  handle('get-customer-task-failures', (payload) => {
    const { batchId, offset, limit } = parseCustomerTaskFailuresRequest(payload)
    return taskRunManager.listFailures(batchId, { offset, limit })
  })
  handle('clear-weibo-request-cache', async (payload) => {
    const { targetUid } = parseClearWeiboRequestCacheRequest(payload)
    const cookie = await getWeiboCookie(session)
    await taskRunManager.clearResponseCache(targetUid, cookie, getCachedLoginUid(cookie))
    return true
  })
}
