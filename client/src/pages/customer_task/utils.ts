import packageConfig from '@/../../package.json';
import semver from 'semver';
import { invokeDesktop, type WeiboLoginStatus, type WeiboUserSummary } from '../../library/desktop'


/**
 * 将用户输入的主页url转为uid
 */
export async function asyncGetUid(rawInputUrl: string) {
  return invokeDesktop<string>('resolve-weibo-uid', { rawInputUrl })
}

/**
 * 获取用户信息
 */
export async function asyncGetUserInfo(uid: number | string) {
  return invokeDesktop<WeiboUserSummary>('get-weibo-user-info', { uid: String(uid) })
}

export async function saveConfig(taskConfig: any) {
  await invokeDesktop('save-task-config', { taskConfig })
}

export async function openOutputDir() {
  // 打开电子书存储目录
  await invokeDesktop('open-output-dir')
}

export async function resetSession() {
  // 注销登录cookie
  await invokeDesktop('reset-session')
  // 注销完成后刷新页面
  window.location.reload();
}

export async function debugOpenDevTools() {
  // 打开调试界面
  await invokeDesktop('open-devtools')
}

export async function asyncCheckIsLogin() {
  // 已登录则返回用户信息 =>
  // {"preferQuickapp":0,"data":{"login":true,"st":"ae34d2","uid":"1728335761"},"ok":1}
  const record = await invokeDesktop<WeiboLoginStatus>('get-weibo-login-status')
  return record.isLogin
}

export async function startBackupTask(taskConfig: unknown) {
  // 将当前任务配置发送给服务器
  return invokeDesktop('start-customer-task', { config: taskConfig })
}

export async function asyncCheckNeedUpdate() {
  type UpgradeConfig = {
    version: string
    downloadUrl: string
    releaseAt: string
    releaseNote: string
  }
  const remoteVersionConfig = await invokeDesktop<UpgradeConfig>('check-upgrade').catch(() => null);

  // 远程端口返回值不正确则不需要继续比较
  if (remoteVersionConfig === null || semver.valid(remoteVersionConfig.version) === null) {
    return false;
  }
  if (semver.lt(packageConfig.version, remoteVersionConfig.version)) {
    return remoteVersionConfig;
  } else {
    return false;
  }
}

export async function jumpToUpgrade(downloadUrl: string) {
  await invokeDesktop('open-external', { targetPath: downloadUrl })
}
