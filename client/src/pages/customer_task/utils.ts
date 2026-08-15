import packageConfig from '@/../../package.json'
import semver from 'semver'
import { invokeDesktop, type WeiboLoginStatus, type WeiboUserSummary } from '../../library/desktop'
import type { CustomerTaskConfig, TaskCommandAck } from './task_type'

export async function asyncGetUid(rawInputUrl: string) {
  return invokeDesktop<string>('resolve-weibo-uid', { rawInputUrl })
}

export async function asyncGetUserInfo(uid: number | string) {
  return invokeDesktop<WeiboUserSummary>('get-weibo-user-info', { uid: String(uid) })
}

export async function getConfig() {
  return invokeDesktop<CustomerTaskConfig>('get-task-config')
}

export async function saveConfig(taskConfig: CustomerTaskConfig) {
  return invokeDesktop<CustomerTaskConfig>('save-task-config', { taskConfig })
}

export async function resetTaskConfig() {
  return invokeDesktop<CustomerTaskConfig>('reset-task-config', {})
}

export async function openOutputDir() {
  return invokeDesktop('open-output-dir')
}

export async function resetSession() {
  await invokeDesktop('reset-session')
  window.location.reload()
}

export async function debugOpenDevTools() {
  return invokeDesktop('open-devtools')
}

export async function asyncCheckIsLogin() {
  const record = await invokeDesktop<WeiboLoginStatus>('get-weibo-login-status')
  return record.isLogin
}

export async function startBackupTask(taskConfig: CustomerTaskConfig) {
  return invokeDesktop<TaskCommandAck>('start-customer-task', { config: taskConfig })
}

export async function continueBackupTask(batchId: string) {
  return invokeDesktop<TaskCommandAck>('continue-customer-task', { batchId })
}

export async function retryBackupTaskItems(batchId: string, taskIds?: string[]) {
  return invokeDesktop<TaskCommandAck>('retry-customer-task-items', {
    batchId,
    ...(taskIds === undefined ? {} : { taskIds }),
  })
}

export async function clearWeiboRequestCache(targetUid: string) {
  return invokeDesktop<boolean>('clear-weibo-request-cache', { targetUid })
}

export async function asyncCheckNeedUpdate() {
  type UpgradeConfig = {
    version: string
    downloadUrl: string
    releaseAt: string
    releaseNote: string
  }
  const remoteVersionConfig = await invokeDesktop<UpgradeConfig>('check-upgrade').catch(() => null)

  if (remoteVersionConfig === null || semver.valid(remoteVersionConfig.version) === null) {
    return false
  }
  return semver.lt(packageConfig.version, remoteVersionConfig.version) ? remoteVersionConfig : false
}

export async function jumpToUpgrade(downloadUrl: string) {
  return invokeDesktop('open-external', { targetPath: downloadUrl })
}
