CREATE TABLE  IF NOT EXISTS `Answer` (
  `id` varchar(30) NOT NULL , ---- COMMENT '答案id，唯一值',
  `author_url_token` varchar(100) NOT NULL , ---- COMMENT '答主url_token',
  `author_id` varchar(100) NOT NULL , ---- COMMENT '答主id',
  `question_id` varchar(30) NOT NULL , ---- COMMENT '问题id',
  `raw_json` text, --- COMMENT '原始响应json'
  --- 回答记录表
  PRIMARY KEY (`id`)
) ; 


CREATE TABLE  IF NOT EXISTS `Article` (
  `article_id` varchar(100) NOT NULL  , ---- COMMENT '文章id',
  `column_id` varchar(100) NOT NULL  , ---- COMMENT '专栏id',
  `raw_json` json, --- COMMENT '原始响应json'
  --- 专栏文章表
  PRIMARY KEY (`article_id`)
) ; 


CREATE TABLE  IF NOT EXISTS `Column` (
  `column_id` varchar(100) NOT NULL  , ---- COMMENT '专栏id',
  `raw_json` json, --- COMMENT '原始响应json'
  --- 专栏信息表
  PRIMARY KEY (`column_id`)
) ; 


CREATE TABLE  IF NOT EXISTS `ColumnArticleExcerpt` (
  `column_id` varchar(100) NOT NULL  , ---- COMMENT '专栏id',
  `article_id` varchar(100) NOT NULL  , ---- COMMENT '文章id',
  `raw_json` json, --- COMMENT '原始响应json'
  --- 专栏文章摘要列表(用于获取专栏列表)
  PRIMARY KEY (`column_id`, `article_id`)
) ; 



CREATE TABLE  IF NOT EXISTS `Author` (
  `id` varchar(100) NOT NULL DEFAULT '' , ---- COMMENT 'hash_id',
  `url_token` varchar(200) NOT NULL , ---- COMMENT '用户主页id.随时可能会更换',
  `raw_json` text, --- COMMENT '原始响应json'
  --- 作者信息表
  PRIMARY KEY (`id`)
) ; 


CREATE TABLE  IF NOT EXISTS `Activity` (
  `id` varchar(100) NOT NULL DEFAULT '' , ---- COMMENT 'id', 实际上是用户行为记录发生时间,
  `url_token` varchar(200) NOT NULL , ---- COMMENT '用户主页id.随时可能会更换',
  `verb` varchar(200) NOT NULL , ---- COMMENT '行为类别',
  `raw_json` text, --- COMMENT '原始响应json'
  --- 用户活动列表
  PRIMARY KEY (`id`, `url_token`)
) ; 


CREATE TABLE  IF NOT EXISTS `Collection` (
  `collection_id` int(11) NOT NULL , ---- COMMENT '收藏夹id',
  `raw_json` text, --- COMMENT '收藏夹信息json'
  --- 收藏夹信息表
  PRIMARY KEY (`collection_id`)
); 

CREATE TABLE  IF NOT EXISTS `CollectionAnswer` (
  `collection_id` int(11) NOT NULL , ---- COMMENT '收藏夹id',
  `answer_id` int(11) NOT NULL , ---- COMMENT '收藏夹回答id',
  `raw_answer_excerpt_json` text, --- COMMENT '收藏夹响应的答案摘要json'
  `raw_answer_json` text, --- COMMENT '答案api响应json'
  --- 收藏夹内回答列表(收藏夹接口只提供了answer响应, 没有返回文章列表)
  PRIMARY KEY (`collection_id`, `answer_id`)
);


CREATE TABLE  IF NOT EXISTS `Topic` (
  `topic_id` int(11) NOT NULL , ---- COMMENT '话题id',
  `raw_json` text, --- COMMENT '原始响应json'
  --- 话题信息表
  PRIMARY KEY (`topic_id`)
) ; 


CREATE TABLE  IF NOT EXISTS `TopicAnswer` (
  `topic_id` int(11) NOT NULL , ---- COMMENT '话题id',
  `answer_id` int(11) NOT NULL , ---- COMMENT '答案id',
  `raw_json` text, --- COMMENT '原始响应json'
  --- 话题下精华回答表
  PRIMARY KEY (`topic_id`, `answer_id`)
) ; 

CREATE TABLE  IF NOT EXISTS `Question` (
  `question_id` varchar(100) NOT NULL , ---- COMMENT '问题id',
  `raw_json` text, --- COMMENT '原始响应json'
  --- 问题信息表
  PRIMARY KEY (`question_id`)
) ; 

CREATE TABLE  IF NOT EXISTS `QuestionAnswer` (
  `question_id` varchar(100) NOT NULL , ---- COMMENT '问题id',
  `answer_id` varchar(100) NOT NULL , ---- COMMENT '答案id',
  `raw_json` text, --- COMMENT '原始响应json'
  --- 问题下回答列表
  PRIMARY KEY (`question_id`, `answer_id`)
) ; 


CREATE TABLE  IF NOT EXISTS `Author_Ask_Question` (
  `question_id` varchar(100) NOT NULL , ---- COMMENT '问题id',
  `author_url_token` varchar(100) NOT NULL , ---- COMMENT '答主url_token',
  `author_id` varchar(100) NOT NULL , ---- COMMENT '答主id',
  `raw_json` text, --- COMMENT '原始响应json'
  --- '总答案记录表'
  PRIMARY KEY (`question_id`)
); 

CREATE TABLE  IF NOT EXISTS `V2_Total_Answer` (
  `answer_id` varchar(100) NOT NULL , ---- COMMENT '答案id，唯一值',
  `author_url_token` varchar(100) NOT NULL , ---- COMMENT '答主url_token',
  `author_id` varchar(100) NOT NULL , ---- COMMENT '答主id',
  `question_id` varchar(100) NOT NULL , ---- COMMENT '问题id',
  `raw_json` text, --- COMMENT '原始响应json'
  --- '总答案记录表'
  PRIMARY KEY (`answer_id`)
); 

CREATE TABLE  IF NOT EXISTS `V2_Total_Pin` (
  `pin_id` varchar(100) NOT NULL , ---- COMMENT '想法id',
  `author_id` varchar(100) NOT NULL , ---- COMMENT '答主id',
  `author_url_token` varchar(100) NOT NULL , ---- COMMENT '答主url_token',
  `raw_json` text, --- COMMENT '原始响应json'
  --- '总想法记录表'
  PRIMARY KEY (`pin_id`)
); 

CREATE TABLE  IF NOT EXISTS `V2_Total_Article` (
  `article_id` varchar(100) NOT NULL  , ---- COMMENT '文章id',
  `column_id` varchar(100) NOT NULL  , ---- COMMENT '专栏id',
  `author_url_token` varchar(100) NOT NULL , ---- COMMENT '答主url_token',
  `author_id` varchar(100) NOT NULL , ---- COMMENT '答主id',
  `raw_json` json, --- COMMENT '原始响应json'
  --- '总想法记录表'
  PRIMARY KEY (`article_id`)
); 