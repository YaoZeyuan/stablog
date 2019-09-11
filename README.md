#   微备份

##  项目说明

**微备份** 由 [姚泽源](http://www.yaozeyuan.online/) 创作，采用 [MIT](http://opensource.org/licenses/MIT) 协议进行许可。

*   项目基于微博现有接口+TypeScript构建，为微博网友提供方便的, 以供自己阅读/数据导出/自身结集整理为目的, 将微博内容转为Epub电子书的途径

不考虑商业用途

接受功能建议, 但一般不考虑定制开发

##  项目动机

鉴于知乎世风日下, 还禁了项目前身[知乎助手](https://github.com/YaoZeyuan/zhihuhelp_with_node)的推广. 作者决定转战微博, 造福社会

严肃保护以[@Aioros先生](https://weibo.com/u/6646798696?refer_flag=0000015010_&from=feed&loc=nickname&sudaref=www.weibo.com&is_all=1)为代表的野生读物博主


#   注意事项

1.  在生成电子书时可能会有卡顿, 根据电子书的体积(100k~2G)卡顿时间在1s~1分钟不等, 函请谅解
2.  所有图片缓存都会存在安装目录下, 随着制作的电子书数量增加, 体积可能会非常大, 因此建议将软件安装在非系统盘根目录, 体积大了直接删除即可


#   代码规范
1.  变量命名规范
    1.  类型统一使用namespace方式声明, 导入时使用`Type + xxx`形式进行导入
    2.  Model导入时统一使用`M + xxx`形式进行导入
    3.  View导入时统一使用`View + xxx`形式进行导入
    4.  Util工具函数导入时统一使用`xxx + Util`形式进行导入
    5.  async函数前统一添加`async`前缀, 以和正常函数进行区分
2.  文件命名规范
    1.  统一使用下划线方式命名

#   开发说明

1.  建议只开发命令版
    1.  使用`npm run ace`启动
2.  GUI版需要为Electron编译sqlite3, 非常麻烦, 不建议尝试
    1.  编译指南: https://www.cnblogs.com/DonaHero/p/9809325.html
    2.  流程
        1.  Windows用户
            1.  安装[VS 2015社区版](http://download.microsoft.com/download/B/4/8/B4870509-05CB-447C-878F-2F80E4CB464C/vs2015.com_chs.iso), 是的你没看错
            2.  文件-新建项目-Visual C++ -> 选择 安装vs2015所需的C++开发环境
            3.  好了一个小时过去了
            6.  执行 `npm run rebuild-electron-with-sqlite3`, 编译完成sqlite3之后, 就可以启动GUI界面了
        2.  Mac用户
            1.  我没有mac谢谢
    3.  注意:
        1.  打包时会向dist目录中复制一份node_modules目录, 导致npm run 时优先从dist中获取node_module信息, 导致无法启动
            1.  因此, 打包结束后需要将dist里的node_modules目录删掉, 以免影响后续开发工作
3.  电子书封面分辨率为: 100 * 130(宽*高)
4.  commit信息规范 => 
    | 关键字 | 功能          |
    | ------ | ------------- |
    | feat   | 添加新功能    |
    | format | 调整代码格式  |
    | fix    | 修复错误      |
    | doc    | 修订文档/注释 |

#   开发指南

##  基本思路

1.  TypeScript提供类型支持, 在编写代码时可以自动提示变量下的属性 
2.  Electron提供图形界面, 利用webview标签直接登陆知乎
3.  利用知乎接口抓取数据
4.  ace/command提供命令行支持
5.  sqlite3提供数据库支持

##  实现方式
1.  将电子书制作分为以下三步
    1.  初始化环境 => 对应于`npm run ace Init:Env`命令
    2.  抓取指定内容 => 对应于`npm run ace Fetch:XXX`系列命令, 目前支持`Column`/`Author`/`Activity`/`Collection`/`Topic`
    3.  从数据库中获得数据, 生成指定内容电子书 => 对应于`npm run ace Generate:XXX`系列命令, 目前支持`Column`/`Author`/`Activity`/`Collection`/`Topic`
    4.  因此, 实际任务流程就是根据用户输入url, 生成对应命令配置, 不断执行命令即可
2.  项目开发流程
    1.  `npm run watch` 启动监控, 将`ts`自动编译为`js`文件
    2.  `npm run startgui`, 启动前端界面(vue项目, 基于Element-UI简单构建)
    3.  修改`src/index.ts`, 将代码由
        ```js
        // 线上地址
        mainWindow.loadFile('./gui/dist/index.html')
        // 本地调试 & 打开控制台
        // mainWindow.loadURL('http://127.0.0.1:8080')
        // mainWindow.webContents.openDevTools()
        ```
        替换为
        ```js
        // 线上地址
        // mainWindow.loadFile('./gui/dist/index.html')
        // 本地调试 & 打开控制台
        mainWindow.loadURL('http://127.0.0.1:8080')
        mainWindow.webContents.openDevTools()
        ```
        使用本地页面进行调试
    4.  执行`npm run start`, 启动Electron
        1.  前端点击`开始任务`按钮后, 将任务配置写入`task_config_list.json`, 再由Electron收集登陆后产生的知乎cookie, 存入`config.json`文件中, 随后启动`Dispatch:Command`命令, 开始执行任务
3.  注意事项
    1.  Electron需要编译sqlite3后才能启动, 不容易搞, 建议直接使用`npm run ace`命令行方式进行调试
    2.  命令使用说明详见代码


#   功能建议

欢迎通过[issue](https://github.com/YaoZeyuan/zhihuhelp_with_node/issues)提建议

#   支持作者

![感谢支持](http://ww1.sinaimg.cn/large/6671cfa8ly1g08k8rm5grj20ri16sq4r.jpg)

[致谢列表](https://www.easy-mock.com/mock/5c680a151b1cdb683581355c/zhihuhelp/thank_you/list)
