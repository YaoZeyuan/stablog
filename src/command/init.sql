CREATE TABLE  IF NOT EXISTS `total_mblog` (
  `id` varchar(30) NOT NULL , ---- COMMENT '微博id，唯一值',
  `author_id` varchar(30) NOT NULL , ---- COMMENT '博主uid',
  `raw_json` text, --- COMMENT '原始响应json'
  PRIMARY KEY (`id`)
); 

CREATE TABLE  IF NOT EXISTS `total_user` (
  `author_id` varchar(30) NOT NULL , ---- COMMENT '博主uid',
  `raw_json` text, --- COMMENT '原始响应json'
  PRIMARY KEY (`author_id`)
); 

