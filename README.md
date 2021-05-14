# 稳部落 stablog

**稳部落** 由 [姚泽源](http://www.yaozeyuan.online/) 创作，采用 [MIT](http://opensource.org/licenses/MIT) 协议进行许可。

- 项目基于微博现有接口+TypeScript 构建，为微博网友提供一个方便的, 以供自己阅读/备份/自身结集整理的方式

**严禁将本软件及其衍生品用于任何商业用途**

接受功能建议, 但一般不接受定制开发需求

# 软件下载

最新版本: 3.0.0

[点击下载-win](https://wws.lanzous.com/ie2ECnpdjoj)

[点击下载-mac](https://wws.lanzous.com/iD5Bgnpdjkf)

[更新历史](./changelog.md)

# 使用指南

1.  登录微博. 由于微博网页本身问题, 输入账号/密码/验证码时略有卡顿, 请耐心等待

2.  进入系统设置, 将待备份用户主页地址粘贴进输入栏. 点击`同步个人信息`按钮, 可看到预估的备份时长, 点击`开始备份`, 执行备份操作.
3.  备份完成后会自动打开电子书输出目录, `稳部落输出的电子书`目录下, 即为电子书, 其中, `html`目录下为 html 格式书籍, `index.html`为目录页. `pdf`下为 pdf 输出位置

1)  ![登录微博](http://stablog.bookflaneur.cn//img/%E7%99%BB%E5%BD%95%E5%BE%AE%E5%8D%9A.jfif)
2)  ![配置任务](http://stablog.bookflaneur.cn//img/%E4%BD%BF%E7%94%A8%E6%AD%A5%E9%AA%A4-6.png)
3)  ![查看电子书](http://stablog.bookflaneur.cn//img/%E6%9F%A5%E7%9C%8B%E8%BE%93%E5%87%BA%E7%9A%84%E7%94%B5%E5%AD%90%E4%B9%A6.jfif)

# 使用截图

软件界面:

![主界面|675x499](http://stablog.bookflaneur.cn/img/v2/%E4%B8%BB%E7%95%8C%E9%9D%A2.png)
![配置列表|690x392](http://stablog.bookflaneur.cn/img/v2/%E9%85%8D%E7%BD%AE%E5%88%97%E8%A1%A8.png)

运行截图

![运行截图|644x500](http://stablog.bookflaneur.cn/img/v2/%E8%BF%90%E8%A1%8C%E6%88%AA%E5%9B%BE.png)

输出的文件:

![输出的文件|690x287](http://stablog.bookflaneur.cn/img/v2/%E8%BE%93%E5%87%BA%E7%9A%84%E6%96%87%E4%BB%B6.png)

输出的 html 电子书:

![输出的html电子书|496x500](http://stablog.bookflaneur.cn/img/v2/%E8%BE%93%E5%87%BA%E7%9A%84html%E7%94%B5%E5%AD%90%E4%B9%A6.png)

输出的 pdf 电子书:

![输出的pdf电子书|403x500](http://stablog.bookflaneur.cn/img/v2/%E8%BE%93%E5%87%BA%E7%9A%84pdf%E7%94%B5%E5%AD%90%E4%B9%A6.jpeg)

## 项目动机

严肃保护以[@Aioros 先生](https://weibo.com/u/6646798696?refer_flag=0000015010_&from=feed&loc=nickname&sudaref=www.weibo.com&is_all=1)为代表的珍稀野生读物博主

# 配置项说明

1.  备份页数: 从第 m 页备份到第 n 页
    1.  除首次备份外, 正常使用只要备份前 10 页微博即可, 可以加快备份速度
2.  微博排序
    1.  按微博发布时间进行排序. 精确度为`天`. 建议使用`由旧到新`模式, 符合阅读习惯
3.  图片配置
    1.  电子书内是否包含图片. 建议选择`有图`模式
4.  自动分卷
    1.  解决电子书体积过大问题. 如果单本电子书内微博总数超出配置值, 将会分为多卷输出
5.  时间范围
    1.  只输出指定时间范围内的微博记录.
6.  分页依据
    1.  html 版电子书内, 按什么标准合并微博. 推荐`按月`合并微博. 话痨博主可以`按天`, 不喜欢说话的博主可以`按年`

# Q & A

问: 软件安全吗, 为什么一定要登录后才能使用?
答: 作者可以保证从项目 Github 主页上下载的软件安全可靠. 项目源代码开放, 实在不放心可以基于源代码自行编译. 由于是微博备份项目,只有登录自己的微博账号后才能看到发布的所有微博, 所以必须要登录.

问: 为什么备份这么慢? 为什么每次都要等 20s 之后才抓取下一条微博?
答: 新浪对爬虫进行了严格限制, 20s 抓一次是我试验多次之后, 可以安全备份微博数据的最短间隔. 作为为非开发人员提供的备份工具, **稳定**第一

问: 安装完之后无法运行, 弹框提示:"A JavaScript error occurred in main process" 是怎么回事?
答: 一般是因为软件没有写入文件权限, 改装到 D 盘就可以了

# 代码规范

1.  变量命名规范
    1.  类型统一使用 namespace 方式声明, 导入时使用`Type + xxx`形式进行导入
    2.  Model 导入时统一使用`M + xxx`形式进行导入
    3.  View 导入时统一使用`View + xxx`形式进行导入
    4.  Util 工具函数导入时统一使用`xxx + Util`形式进行导入
    5.  async 函数前统一添加`async`前缀, 以和正常函数进行区分
2.  文件命名规范
    1.  统一使用下划线方式命名

# 开发说明

0.  必须使用 node12
    1.  Electron 版本必须和环境中的 node 版本一致, 才能正常编译 sqlite
        1.  目前使用的是 Electron@6.0.12, 自带 node 为 12.4.0, 因此要求环境 node 也需要为 12.4.0
1.  建议只开发命令版
    1.  使用`npm run ace`启动
1.  GUI 版需要为 Electron 编译 sqlite3, 非常麻烦, 不建议尝试
    1.  流程
        1.  Windows 用户
            1.  安装[VS 2019 社区版](https://visualstudio.microsoft.com/zh-hans/downloads/), 社区版免费下载. Windows 下为 Electron 编译 sqlite3 需要 VS 提供的构建工具
            2.  启动 VS, 选择`工具`-`获取工具和功能`
            3.  勾选`使用C++的桌面开发`-`MSVC v140 - VS 2015 C++生成工具(v14.00)`, 安装即可
            4.  好了一个小时过去了
            5.  执行 `npm run rebuild-sqlite3`, 编译完成 sqlite3 之后, 就可以启动 GUI 界面了
            6.  特别说明: 这套流程只适合纯净环境, 如果是`Electron@4`升级到`Electron@6`, 再编译会编译不过去(会有 v4 的编译残留), 将整个`node_modules`目录删除后重新`install`即可
        2.  Mac 用户
            1.  正常`npm install`即可, 注意安装`puppeteer`和`electron`本身非常耗时, 需要使用淘宝源进行下载`--registry=https://registry.npm.taobao.org/`
    2.  注意:
        1.  打包时会向 dist 目录中复制一份 node_modules 目录, 导致 npm run 时优先从 dist 中获取 node_module 信息, 导致无法启动
            1.  因此, 打包结束后需要将 dist 里的 node_modules 目录删掉, 以免影响后续开发工作
1.  电子书封面分辨率为: 100 * 130(宽*高)

## commit 信息规范

| 关键字 | 功能          |
| ------ | ------------- |
| feat   | 添加新功能    |
| format | 调整代码格式  |
| fix    | 修复错误      |
| doc    | 修订文档/注释 |

# 开发指南

项目使用 yarn 进行开发, 方便配置各种代理

## 基本思路

1.  TypeScript 提供类型支持, 在编写代码时可以自动提示变量下的属性
2.  Electron 提供图形界面, 利用 webview 标签直接登录微博
3.  利用微博接口抓取数据
4.  ace/command 提供命令行支持
5.  sqlite3 提供数据库支持
6.  图形界面使用 React 编写.
    1.  基于[immer](https://immerjs.github.io/immer/docs/introduction) & Hooks 进行状态管理

## 实现方式

1.  将电子书制作分为以下三步
    1.  初始化环境 => 对应于`npm run ace Init:Env`命令
    2.  抓取指定内容 => 对应于`npm run ace Fetch:XXX`系列命令, 目前支持`Column`/`Author`/`Activity`/`Collection`/`Topic`
    3.  从数据库中获得数据, 生成指定内容电子书 => 对应于`npm run ace Generate:XXX`系列命令, 目前支持`Column`/`Author`/`Activity`/`Collection`/`Topic`
    4.  因此, 实际任务流程就是根据用户输入 url, 生成对应命令配置, 不断执行命令即可
2.  项目开发流程
    1.  `npm run watch` 启动监控, 将`ts`自动编译为`js`文件
    2.  `npm run startgui`, 启动前端界面(vue 项目, 基于 Element-UI 简单构建)
    3.  执行`npm run start`, 以调试模式启动 Electron
        1.  前端点击`开始任务`按钮后, 将任务配置写入`task_config_list.json`, 再由 Electron 收集登录后产生的微博 cookie, 存入`config.json`文件中, 随后启动`Dispatch:Command`命令, 开始执行任务
3.  项目发布
    1.  执行`npm run dist`
4.  注意事项
    1.  Electron 需要编译 sqlite3 后才能启动, 不容易搞, 建议直接使用`npm run ace`命令行方式进行调试
    2.  本地 Node 版本要与 Electron 主版本一致(目前 Electron@8.5 对应于 node@12.13.0)
    3.  使用 6.0.12 版本, 以直接使用 sqlite3 提供的官方 npm 包, 绕过本地编译流程
    4.  命令使用说明详见代码

# 功能建议

欢迎通过[issue](https://github.com/YaoZeyuan/stablog/issues)提建议
