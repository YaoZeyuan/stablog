let shelljs = require('shelljs')
let path = require('node:path')
let fs = require('node:fs')

const Const_Root_Path = path.resolve(__dirname, '..')
// const Const_App_Path = path.resolve(Const_Root_Path, 'app')
// const Const_App_Dist_Path = path.resolve(Const_App_Path, 'dist')
const Const_Dist_Path = path.resolve(Const_Root_Path, 'dist')
const Const_Client_Path = path.resolve(Const_Root_Path, 'client')
const Const_Client_Dist_Path = path.resolve(Const_Client_Path, 'dist')
// sqlite3的构建文件, 没有实际用处, 17mb
const Const_NodeModules_Path = path.resolve(Const_Root_Path, 'node_modules')
const Const_NodeModules_Sqlite3_Cache_build_Path = path.resolve(Const_NodeModules_Path, 'sqlite3/build')
const Const_NodeModules_Sqlite3_Cache_deps_Path = path.resolve(Const_NodeModules_Path, 'sqlite3/deps')
const Const_NodeModules_JsPdf_Dist_Path = path.resolve(Const_NodeModules_Path, 'jspdf/dist')

function getAllJsMapUri(basePath) {
  let pathUri = path.resolve(basePath)
  let jsMapUriSet = new Set()
  let currentDirList = [pathUri]
  let nextDirList = []
  while (currentDirList.length > 0) {
    for (currentPath of currentDirList) {
      let filenameList = fs.readdirSync(currentPath)
      for (let filename of filenameList) {
        let uri = path.resolve(currentPath, filename)
        let fsStat = fs.statSync(uri)
        if (fsStat.isDirectory()) {
          nextDirList.push(uri)
          continue
        }
        if (fsStat.isFile()) {
          if (filename.endsWith('.js.map')) {
            jsMapUriSet.add(uri)
          }
        }
      }
    }
    currentDirList = nextDirList
    nextDirList = []
  }
  // 得到所有js.map文件的地址
  return [...jsMapUriSet.values()]
}

// 清除旧目录资源
console.log('0. clear')
shelljs.rm('-rf', Const_Dist_Path)
shelljs.rm('-rf', Const_Client_Dist_Path)
// 开始构建页面
// 先构建dist目录
console.log('1. build server')
shelljs.exec('npm run build-server')
console.log('server build complete')
// 再构建gui
console.log('2. build gui')
console.log('entry client directory')
shelljs.cd(Const_Client_Path)
// 再构建gui
console.log('run `npm run build`')
shelljs.exec('npm run build')
console.log('client build complete')
// 返回首页
console.log('return to root category`')
shelljs.cd(Const_Root_Path)
console.log('3. copy new static`')
shelljs.mkdir('-p', './dist/client/dist')
console.log('move resource')
shelljs.cp('-rf', './client/dist/*', './dist/client/dist/')

if (process.env['CI_ENV']) {
  console.log(`env.CI_ENV is exist => ${process.env['CI_ENV']}`)
  console.log(`auto clear js.map and sqlite3`)
  // 减少体积, 删除构建文件
  shelljs.rm('-rf', Const_NodeModules_Sqlite3_Cache_build_Path)
  shelljs.rm('-rf', Const_NodeModules_Sqlite3_Cache_deps_Path)
  // 递归删除所有.js.map文件
  console.log('remove all js.map')
  let allJsMapUriList = getAllJsMapUri(Const_Root_Path)
  console.log(`all js.map count => ${allJsMapUriList.length}`)
  for (let uri of allJsMapUriList) {
    shelljs.rm('-rf', uri)
  }
}

// 将dist目录迁移到app目录中, 只发布需要的部分
// shelljs.mkdir('-p', Const_App_Dist_Path)
// shelljs.cp('-rf', './dist/*', Const_App_Dist_Path)
// console.log('4. cd 2 category app and run make')
// shelljs.cd('./app')
// shelljs.exec('npm run make')
