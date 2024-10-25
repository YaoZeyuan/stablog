CREATE TABLE  IF NOT EXISTS `total_mblog` (
  `id` varchar(30) NOT NULL , ---- COMMENT '微博id，唯一值',
  `author_uid` varchar(30) NOT NULL DEFAULT '', ---- COMMENT '博主uid',
  `is_retweet`	INTEGER NOT NULL DEFAULT 0, ---- COMMENT '是否为转发微博',
  `is_article`	INTEGER NOT NULL DEFAULT 0, ---- COMMENT '是否为文章',
  `post_publish_at` int(10) NOT NULL DEFAULT 0, ---- COMMENT '微博记录发布时间戳,方便排序',
  `raw_json` text, --- COMMENT '原始响应json'
  PRIMARY KEY (`id`)
); 

CREATE TABLE  IF NOT EXISTS `fetch_error_record` (
  `id`  INTEGER PRIMARY KEY AUTOINCREMENT, ---- COMMENT '记录id',
  `author_uid` varchar(30) NOT NULL DEFAULT '', ---- COMMENT '博主uid',
  `resource_type` varchar(30) NOT NULL DEFAULT 'weibo_page', ---- COMMENT '错误类型: weibo_page=>页面抓取失败, long_text_weibo => 长微博抓取失败, article => 文章抓取失败',
  `long_text_weibo_id` varchar(30) NOT NULL DEFAULT '', ---- COMMENT '抓取失败的长微博id',
  `article_url` varchar(1000) NOT NULL DEFAULT '', ---- COMMENT '抓取失败的微博文章url',
  `lastest_page_mid` varchar(30) NOT NULL DEFAULT '', ---- COMMENT '上一页成功抓取的微博id, 重抓时, 使用微博id进行抓取',
  `lastest_page_offset` int(10) NOT NULL DEFAULT 1, ---- COMMENT '距离最近成功抓取微博的页码, 重抓时, 通过该页面确认应向后抓取多少页, 默认只抓取一页',
  `error_info_json` text, --- COMMENT '报错内容json, 用于调试'
  `debug_info_json` text, --- COMMENT '当时运行配置, 用于调试'
  `mblog_json` text --- COMMENT '故障微博记录, 二次抓取时使用'
); 

---- 添加唯一索引, 方便执行replace into
---- 当有多个相同lastest_page_mid, 只有 lastest_page_offset 不同时, 说明连续多页抓取失败, 只要记录最后一个lastest_page_mid和最大的offset即可
CREATE UNIQUE INDEX IF NOT EXISTS uniq_fetch_error_record
on fetch_error_record (author_uid, resource_type, long_text_weibo_id, article_url, lastest_page_mid);

CREATE TABLE  IF NOT EXISTS `total_user` (
  `author_uid` varchar(30) NOT NULL DEFAULT '', ---- COMMENT '博主uid',
  `raw_json` text, --- COMMENT '原始响应json'
  PRIMARY KEY (`author_uid`)
); 

