import http from "../../library/http"
import _ from "lodash"
import fs from "fs"
import packageConfig from '~/../../package.json'
import semver from 'semver'

const electron = require('electron');
const shell = electron.shell;
const ipcRenderer = electron.ipcRenderer;
const remote = electron.remote;
let pathConfig = remote.getGlobal('pathConfig');

/**
 * 将用户输入的主页url转为uid
 */
export async function asyncGetUid(rawInputUrl: string) {
    if (rawInputUrl.includes('m.weibo.cn/u/')) {
        let rawUid = rawInputUrl.split(`m.weibo.cn/u/`)[1]
        let uid = _.get(rawUid.match(/^\d+/), 0, '')
        return uid
    }
    if (rawInputUrl.includes('weibo.com/u/')) {
        let rawUid = rawInputUrl.split(`weibo.com/u/`)[1]
        let uid = _.get(rawUid.match(/^\d+/), 0, '')
        return uid
    } else {
        let rawAccount = rawInputUrl.split(`weibo.com/`)[1]
        rawAccount = rawAccount.split('?')[0]
        let account = rawAccount.split('/')[0] // 有可能会加一个/home/
        // 新浪会将url重定向到uid页面
        let response = await http.rawClient.get(
            `https://m.weibo.cn/${account}?topnav=1&wvr=6&topsug=1&is_all=1&jumpfrom=weibocom&topnav=1&wvr=6&topsug=1&is_all=1`,
        )
        // 对于被封号用户, 会返回一个404, 这时候需要手工匹配html代码
        let uid = ''
        if (response.data.includes('用户不存在') && response.data.includes('出错了')) {
            let rawHtmlResponse = await http.rawClient.get(`https://weibo.com`)
            let rawText = rawHtmlResponse.data
            if (rawText.includes("$CONFIG['uid']='") === false) {
                // uid不存在
                return ''
            }
            let content = rawText.split("$CONFIG['uid']='")[1]
            content = content.split("'")[0]
            // 如果抓取用户为被封用户, 且登录账号不是被封用户, 只能拿到自己的uid
            // 但这个属于例外情况了, 一般用户拿不到被封用户的主页url, 不考虑
            // 假定只有被封用户才能登录被封用户的主页
            uid = content
        } else {
            let url = response.request.responseURL || ''
            let rawUid = url.split(`m.weibo.cn/u/`)[1]
            uid = _.get(rawUid.match(/^\d+/), 0, '')
        }
        return uid
    }
}

/**
 * 获取用户信息
 */
export async function asyncGetUserInfo(uid: number | string) {
    let response = await http.asyncGet(`https://m.weibo.cn/api/container/getIndex?&type=uid&value=${uid}`)
    let userInfo = _.get(response, ['data', 'userInfo'], {})
    let screen_name = userInfo.screen_name || ''
    let statuses_count = userInfo.statuses_count || 0
    let followers_count = userInfo.followers_count || 0
    let total_page_count = Math.floor(statuses_count / 10)
    return {
        screen_name,
        statuses_count,
        total_page_count,
        followers_count,
    }
}

export function saveConfig(taskConfig: any) {
    fs.writeFileSync(pathConfig.customerTaskConfigUri, JSON.stringify(taskConfig, null, 4))
}


export function openOutputDir() {
    // 打开电子书存储目录
    ipcRenderer.sendSync('openOutputDir')
}

export async function asyncCheckIsLogin() {
    // 已登录则返回用户信息 =>
    // {"preferQuickapp":0,"data":{"login":true,"st":"ae34d2","uid":"1728335761"},"ok":1}
    let record = await http.asyncGet('https://m.weibo.cn/api/config')
    let isLogin = _.get(record, ['data', 'login'], false)
    if (isLogin === false) {
        return false
    }
    return true
}

export async function asyncHandleStartTask() {
    this.saveConfig()
    await this.asyncCheckIsLogin()
    if (this.status.isLogin === false) {
        console.log('请先登录微博')
        return
    }
    let asyncSuccess = await this.asyncData()
    if (asyncSuccess !== true) {
        return
    }
    // 将当前任务配置发送给服务器
    ipcRenderer.sendSync('startCustomerTask')
    // 将面板切换到log上
    this.$emit('update:currentTab', 'log')
}

export async function asyncCheckNeedUpdate() {
    let checkUpgradeUri = 'http://api.bookflaneur.cn/stablog/version'
    let remoteVersionConfig = await http
        .asyncGet(checkUpgradeUri, {
            params: {
                now: new Date().toISOString,
            },
        })
        .catch(e => {
            return {}
        })
    // 已经通过Electron拿到了最新cookie并写入了配置文件中, 因此不需要再填写配置文件了
    if (semver.lt(packageConfig.version, remoteVersionConfig.version)) {
        return remoteVersionConfig
    } else {
        return false
    }
}

export function jumpToUpgrade(downloadUrl: string) {
    shell.openExternal(downloadUrl)
}