CREATE TABLE  IF NOT EXISTS `total_mblog` (
  `id` varchar(30) NOT NULL , ---- COMMENT '微博id，唯一值',
  `author_uid` varchar(30) NOT NULL , ---- COMMENT '博主uid',
  `is_retweet` int(10) NOT NULL , ---- COMMENT '是否为转发微博',
  `is_article` int(10) NOT NULL , ---- COMMENT '是否为文章',
  `post_publish_at` int(10) NOT NULL , ---- COMMENT '微博记录发布时间戳,方便排序',
  `raw_json` text, --- COMMENT '原始响应json'
  PRIMARY KEY (`id`)
); 

CREATE TABLE  IF NOT EXISTS `total_user` (
  `author_uid` varchar(30) NOT NULL , ---- COMMENT '博主uid',
  `raw_json` text, --- COMMENT '原始响应json'
  PRIMARY KEY (`author_uid`)
); 

