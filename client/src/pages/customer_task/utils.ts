import http from '../../library/http';
import _ from 'lodash';
import packageConfig from '@/../../package.json';
import semver from 'semver';

const electron = require('electron');
const shell = electron.shell;
const ipcRenderer = electron.ipcRenderer;

let pathConfigStr = ipcRenderer.sendSync('getPathConfig')
let pathConfig = JSON.parse(pathConfigStr)


/**
 * 将用户输入的主页url转为uid
 */
export async function asyncGetUid(rawInputUrl: string) {
  if (rawInputUrl.includes('m.weibo.cn/u/')) {
    let rawUid = rawInputUrl.split(`m.weibo.cn/u/`)[1];
    let uid = _.get(rawUid.match(/^\d+/), 0, '');
    return uid;
  }
  if (rawInputUrl.includes('m.weibo.cn/profile/')) {
    let rawUid = rawInputUrl.split(`m.weibo.cn/profile/`)[1];
    let uid = _.get(rawUid.match(/^\d+/), 0, '');
    return uid;
  }
  if (rawInputUrl.includes('weibo.com/u/')) {
    let rawUid = rawInputUrl.split(`weibo.com/u/`)[1];
    let uid = _.get(rawUid.match(/^\d+/), 0, '');
    return uid;
  }
  let account = '';
  if (rawInputUrl.includes('weibo.com/n/')) {
    let rawAccount = rawInputUrl.split(`weibo.com/n/`)[1];
    rawAccount = rawAccount.split('?')[0];
    account = rawAccount.split('/')[0];
    console.log('account => ', account);
  }
  if (rawInputUrl.includes('weibo.com/') === false) {
    // 避免用户填写错误数据, 导致页面崩溃
    return '';
  } else {
    let rawAccount = rawInputUrl.split(`weibo.com/`)[1];
    rawAccount = rawAccount.split('?')[0];
    account = rawAccount.split('/')[0]; // 有可能会加一个/home/
  }
  // 新浪会将url重定向到uid页面
  let response = await http.rawClient.get(
    `https://m.weibo.cn/${account}?&jumpfrom=weibocom`,
  );
  // 对于被封号用户, 会返回一个404, 这时候需要手工匹配html代码
  let uid = '';
  if (
    response.data.includes('用户不存在') &&
    response.data.includes('出错了')
  ) {
    let rawHtmlResponse = await http.rawClient.get(`https://weibo.com`);
    let rawText = rawHtmlResponse.data;
    if (rawText.includes("$CONFIG['uid']='") === false) {
      // uid不存在
      return '';
    }
    let content = rawText.split("$CONFIG['uid']='")[1];
    content = content.split("'")[0];
    // 如果抓取用户为被封用户, 且登录账号不是被封用户, 只能拿到自己的uid
    // 但这个属于例外情况了, 一般用户拿不到被封用户的主页url, 不考虑
    // 假定只有被封用户才能登录被封用户的主页
    uid = content;
  } else {
    let url = response.request.responseURL || '';
    let rawUid = url.split(`m.weibo.cn/u/`)[1];
    uid = _.get(rawUid.match(/^\d+/), 0, '');
  }
  return uid;
}

/**
 * 获取用户信息
 */
export async function asyncGetUserInfo(uid: number | string) {
  let response = await http.asyncGet(
    `https://m.weibo.cn/api/container/getIndex?&type=uid&value=${uid}`,
  );
  let userInfo = _.get(response, ['data', 'userInfo'], {});
  let screen_name = userInfo.screen_name || '';
  let statuses_count = userInfo.statuses_count || 0;
  let followers_count = userInfo.followers_count || 0;
  let total_page_count = Math.floor(statuses_count / 10);
  return {
    screen_name,
    statuses_count,
    total_page_count,
    followers_count,
  };
}

export function saveConfig(taskConfig: any) {
  ipcRenderer.sendSync('saveConfig', {
    taskConfig,
    pathConfigUri: pathConfig.customerTaskConfigUri,
  });
}

export function openOutputDir() {
  // 打开电子书存储目录
  ipcRenderer.sendSync('openOutputDir');
}

export async function resetSession() {
  // 注销登录cookie
  await ipcRenderer.sendSync('resetSession');
  // 注销完成后刷新页面
  window.location.reload();
}

export async function debugOpenDevTools() {
  // 打开调试界面
  await ipcRenderer.sendSync('debug_openDevTools');
}

export async function asyncCheckIsLogin() {
  // 已登录则返回用户信息 =>
  // {"preferQuickapp":0,"data":{"login":true,"st":"ae34d2","uid":"1728335761"},"ok":1}
  let record = await http.asyncGet('https://m.weibo.cn/api/config');
  console.log('record => ', record);
  let isLogin = _.get(record, ['data', 'login'], false);
  if (isLogin === false) {
    return false;
  }
  return true;
}

export function startBackupTask() {
  // 将当前任务配置发送给服务器
  ipcRenderer.sendSync('startCustomerTask');
}

export async function asyncCheckNeedUpdate() {
  let checkUpgradeUri = 'https://gitee.com/yaozeyuan/stablog/raw/master/upgrade_config/version.json';
  let remoteVersionConfig = await http
    .asyncGet(checkUpgradeUri, {
      params: {
        now: new Date().toISOString,
      },
    })
    .catch((e) => {
      return {};
    });

  // 远程端口返回值不正确则不需要继续比较
  if (semver.valid(remoteVersionConfig.version) === null) {
    return false;
  }
  if (semver.lt(packageConfig.version, remoteVersionConfig.version)) {
    return remoteVersionConfig;
  } else {
    return false;
  }
}

export function jumpToUpgrade(downloadUrl: string) {
  shell.openExternal(downloadUrl);
}
