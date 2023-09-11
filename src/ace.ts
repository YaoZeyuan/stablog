import ace from '@adonisjs/ace'

/*
|--------------------------------------------------------------------------
| Ace Setup
|--------------------------------------------------------------------------
|
| Ace is the command line utility to create and run terminal commands.
| Here we setup the environment and register ace commands.
|
*/

const registedCommandList = [
  './command/demo', //  命令demo
  './command/debug', //  专业debug命令
  './command/init_env', //  初始化运行环境
  './command/dispatch_task', //  分发任务


  './command/fetch/customer', //  [抓取]执行自定义任务
  './command/generate/customer', //  [生成]执行自定义任务
  './command/datatransfer/export', //  [数据转移]导出
  './command/datatransfer/import', //  [数据转移]导入
]
// register commands
for (const command of registedCommandList) {
  ace.addCommand(require(command)['default'])
}

// Boot ace to execute commands
ace.wireUpWithCommander()
ace.invoke()
