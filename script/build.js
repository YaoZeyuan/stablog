let shelljs = require('shelljs')
let path = require('path')

const Const_Root_Path = path.resolve(__dirname, '..')
const Const_App_Path = path.resolve(Const_Root_Path, 'app')
const Const_App_Dist_Path = path.resolve(Const_App_Path, 'dist')
const Const_Dist_Path = path.resolve(Const_Root_Path, 'dist')
const Const_Client_Path = path.resolve(Const_Root_Path, 'client')
const Const_Client_Dist_Path = path.resolve(Const_Client_Path, 'dist')

// 清除旧目录资源
console.log('0. clear')
shelljs.rm('-rf', Const_Dist_Path)
shelljs.rm('-rf', Const_Client_Dist_Path)
// 开始构建页面
// 先构建dist目录
console.log('1. build server')
shelljs.exec('npm run build-dist')
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
// 将dist目录迁移到app目录中, 只发布需要的部分
shelljs.mkdir('-p', Const_App_Dist_Path)
shelljs.cp('-rf', './dist/*', Const_App_Dist_Path)
console.log('4. cd 2 category app and run make')
shelljs.cd('./app')
shelljs.exec('npm run make')
