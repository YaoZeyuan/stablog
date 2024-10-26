# 稳部落 stablog

**稳部落** 由 [姚泽源](http://www.yaozeyuan.online/) 编写，采用 [MIT](http://opensource.org/licenses/MIT) 协议进行许可。

- 项目基于微博现有接口+TypeScript 构建，为微博网友提供一个方便的, 以供自己阅读/备份/自身结集整理的方式

目前支持 Windows 64 位系统 & Mac 平台上使用

**严禁将本软件及其衍生品用于任何商业用途**

接受功能建议, 但一般不接受定制开发需求

## 项目动机

由于微博检测脚本识别能力有限, 在治理微博风气中先后误炸了一批爱国者账号(@马前卒/@于帅洋是琢玉郎/@Aiorios 先生/etc), 所以起一个项目, 为大家提供一个可以备份/导出微博的工具.

# 软件下载

最新版本: 3.5.1

[点击进入下载页](https://www.yaozeyuan.online/stablog/)

[更新历史](./changelog.md)

# 使用指南

1.  点击`登录微博`, 登录.
    1.  由于微博网页本身问题, 输入账号/密码/验证码时略有卡顿, 请等待 10 秒后鼠标多点几下即可
    2.  ![登录微博](https://cdn.jsdelivr.net/gh/YaoZeyuan/stablog@master/./doc/img/登录微博.png)
2.  备份微博
    1.  回到`系统设置`页面, 将自己的微博主页地址贴进输入框
        1.  支持识别以下形式的 url
            1.  https://weibo.com/u/1234567890
            2.  https://weibo.com/abcdefg
            3.  https://m.weibo.cn/profile/1234567890
            4.  https://m.weibo.cn/u/1234567890
    2.  点击`同步用户信息`按钮, 可看到预估的备份时长
    3.  点击`开始备份`, 执行备份操作
    4.  ![填写用户主页地址](https://cdn.jsdelivr.net/gh/YaoZeyuan/stablog@master/./doc/img/点击开始备份.png)
3.  在`运行日志`中可见当前备份进度.
    1.  ![查看运行日志](https://cdn.jsdelivr.net/gh/YaoZeyuan/stablog@master/./doc/img/查看运行日志.png)
4.  备份完成后自动打开电子书所在目录
    1.  在`稳部落输出的电子书`目录下, 即为输出的电子书, 其中,
        1.  `html`目录下为网页文件输出地址, `index.html`为入口页.
        2.  `pdf`目录下为 pdf 输出位置
        3.  ![电子书输出目录](https://cdn.jsdelivr.net/gh/YaoZeyuan/stablog@master/./doc/img/电子书输出目录.png)
    2.  pdf 电子书输出效果
        1.  ![pdf电子书效果](https://cdn.jsdelivr.net/gh/YaoZeyuan/stablog@master/./doc/img/pdf电子书效果.png)
    3.  html 电子书输出效果
        1.  ![html电子书效果](https://cdn.jsdelivr.net/gh/YaoZeyuan/stablog@master/./doc/img/html电子书效果.png)
5.  输出的 pdf 文件中, 按`年-月-日`生成目录, 支持在文件内搜索文本

# 高级功能

更复杂的使用方法见

[高级功能](./doc/高级功能.md)

# Q & A

问: 软件安全吗, 为什么一定要登录后才能使用?
答: 作者可以保证从项目 Github 主页上下载的软件安全可靠. 项目源代码开放, 实在不放心可以基于源代码自行编译. 由于是微博备份项目,只有登录自己的微博账号后才能看到发布的所有微博, 所以必须要登录.

问: 为什么备份这么慢? 为什么每次都要等 20s 之后才抓取下一条微博?
答: 新浪对爬虫进行了严格限制, 20s 抓一次是我试验多次之后, 可以安全备份微博数据的最短间隔. 作为为非开发人员提供的备份工具, **稳定**第一

问: 能不能加速备份, 实在是太慢了...
答: 3.1.0 版本后添加了`数据导入导出`和`指定备份范围`功能, 可以多找几台电脑, 每台电脑只备份 10~100 页, 导出数据后再集中导入. 输出时在`开发调试`面板中选择`跳过抓取`即可
附: 单台电脑所有应用出口都是一个 ip, 而微博会根据 ip 屏蔽爬虫, 所以本机开多个应用不能加速(只能导致 ip 被 ban, 无法备份), 必须要多地多台电脑才行.

问: 20 秒备份 10 条微博, 但我有 10 万条微博需要备份, 全程备份预估需要 180 小时, 是不是超出软件能力范围了
答: 这么多微博备份起来确实很麻烦...但还是有机会, 可以参考[高级功能](./doc/高级功能.md#微博数量巨大1-万条以上)中的介绍.

问: 我是 XXX 系统, 没法运行软件, 我该怎么办
答: 由于硬件缺失, 作者目前只在 Windows10 64 位系统上进行过测试. 如果有问题的话可以留言反馈 & 找同事借用台 win10 64 位系统的电脑(2020 年后出品的笔记本电脑基本都可以).

问: 安装完之后无法运行, 弹框提示:"A JavaScript error occurred in main process" 是怎么回事?
答: 一般是因为软件没有写入文件权限, 改装到 D 盘就可以了

# 功能建议

欢迎通过[issue](https://github.com/YaoZeyuan/stablog/issues)提建议

[开发说明](./doc/开发说明.md)

## Stargazers over time

![Stargazers over time](https://starchart.cc/YaoZeyuan/stablog.svg)
