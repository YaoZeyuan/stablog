1.  ❌ 输出 epub 电子书, 而非 pdf
    1.  测试 epub 在多看上的效果
    2.  寻找 epub 生成库(大概率找不到)
    3.  寻找 epub3.2 规范
        1.  https://dpublishing.github.io/epub-specs-tc/epub32/epub-spec.html
    4.  编写基于 epub3.2 规范的生成库
    5.  多看不支持现代 css, 因此不能生成对应电子书. 手机端
2.  移除赞助入口
3.  体积优化-> 将体积优化到 100mb 以内
4.  允许备份他人微博
5.  优化 html 文件样式, 调整为 octoman 备份出的样式
6.  导出关注人 uid 列表[不建议做]
7.  解决用户名折行问题[https://github.com/YaoZeyuan/stablog/issues/33]
8.  测试微博新版 api 有没有防爬虫功能.
    1.  看起来可以尝试 => https://weibo.com/ajax/statuses/mymblog?uid=1764741287&page=9&feature=0
9.  使用mozjpeg-js 压缩 jpg 图片
