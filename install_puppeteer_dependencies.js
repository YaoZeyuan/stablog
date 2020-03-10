// windows下, 打包前需要同时安装chrome32/64两版浏览器, 以保证最终产品的兼容性
console.log("auto check puppeteer dependencies")

const host = 'https://storage.googleapis.com.cnpmjs.org/'
// 32位, 64位都装上
const puppeteer = require('puppeteer/index');
const os = require('os');
const revision = require('puppeteer/package').puppeteer.chromium_revision;

async function autoInstall(platform){
    let browserFetcher = puppeteer.createBrowserFetcher({host, platform})
    const revisionInfo = browserFetcher.revisionInfo(revision);
    
    let readyToInstallVersion = revisionInfo.revision
    console.log("start to install ", platform, ' version chrome')
    console.log("install revision =>", readyToInstallVersion)
    
    await browserFetcher.download(readyToInstallVersion)
      .then(() => { console.log(`install chrome browser(${platform}-${readyToInstallVersion}) success!`) })
      .catch(err => { 
        console.log(`install chrome browser(${platform}-${readyToInstallVersion}) failed!`)  
        console.log('Error', err) 
    })
    return
}
async function dispatchTask(){
    // 对于windows操作系统, 需要额外安装32位/64位chrome浏览器
    let currentPlatform = os.platform();
    if(currentPlatform ==='win32'){
        console.log(`windows系统需要额外安装 32位 & 64位 的chrome浏览器`)
        await autoInstall("win32")
        await autoInstall("win64")
        console.log("install complete")
    }
}
dispatchTask()