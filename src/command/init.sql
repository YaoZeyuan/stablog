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

---- 可恢复抓取批次。batch id 是跨应用重启稳定的业务标识，run id 只标识一次执行。
CREATE TABLE IF NOT EXISTS `fetch_batch` (
  `id` varchar(80) NOT NULL,
  `created_run_id` varchar(120) NOT NULL,
  `active_run_id` varchar(120) NOT NULL,
  `phase` varchar(20) NOT NULL DEFAULT 'planning'
    CHECK (`phase` IN ('planning', 'fetching', 'generating', 'done')),
  `status` varchar(30) NOT NULL DEFAULT 'pending'
    CHECK (`status` IN ('pending', 'running', 'succeeded', 'partial_success', 'failed')),
  `config_json` text NOT NULL,
  `login_uid` varchar(32) NOT NULL,
  `cache_read_mode` varchar(30) NOT NULL
    CHECK (`cache_read_mode` IN ('prefer_cache', 'bypass_cache')),
  `request_interval_seconds` REAL NOT NULL
    CHECK (`request_interval_seconds` > 0),
  `fetch_start_at` INTEGER NOT NULL,
  `fetch_end_at` INTEGER NOT NULL,
  `created_at` INTEGER NOT NULL,
  `updated_at` INTEGER NOT NULL,
  `started_at` INTEGER,
  `finished_at` INTEGER,
  CHECK (`fetch_end_at` >= `fetch_start_at`),
  PRIMARY KEY (`id`)
);

CREATE INDEX IF NOT EXISTS idx_fetch_batch_status
ON fetch_batch (`status`, `updated_at`);

CREATE INDEX IF NOT EXISTS idx_fetch_batch_created_at
ON fetch_batch (`created_at` DESC);

---- 一个批次内每个目标用户只出现一次，sequence 用于稳定串行顺序。
CREATE TABLE IF NOT EXISTS `fetch_target` (
  `id` varchar(80) NOT NULL,
  `batch_id` varchar(80) NOT NULL,
  `target_uid` varchar(32) NOT NULL,
  `sequence` INTEGER NOT NULL DEFAULT 0,
  `status` varchar(30) NOT NULL DEFAULT 'pending'
    CHECK (`status` IN ('pending', 'running', 'succeeded', 'partial_success', 'failed')),
  `created_at` INTEGER NOT NULL,
  `updated_at` INTEGER NOT NULL,
  `started_at` INTEGER,
  `finished_at` INTEGER,
  PRIMARY KEY (`id`),
  UNIQUE (`batch_id`, `target_uid`),
  FOREIGN KEY (`batch_id`) REFERENCES `fetch_batch` (`id`) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_fetch_target_batch_status
ON fetch_target (`batch_id`, `status`, `sequence`);

---- 年、月、7 日段和分页共用一张层级任务表；page_no=0 表示非分页任务。
CREATE TABLE IF NOT EXISTS `fetch_task` (
  `id` varchar(80) NOT NULL,
  `batch_id` varchar(80) NOT NULL,
  `target_id` varchar(80) NOT NULL,
  `parent_task_id` varchar(80),
  `task_type` varchar(20) NOT NULL
    CHECK (`task_type` IN ('year_probe', 'month_probe', 'segment_probe', 'page')),
  `range_start_at` INTEGER NOT NULL,
  `range_end_at` INTEGER NOT NULL,
  `page_no` INTEGER NOT NULL DEFAULT 0,
  `sequence` INTEGER NOT NULL DEFAULT 0,
  `status` varchar(20) NOT NULL DEFAULT 'pending'
    CHECK (`status` IN ('pending', 'running', 'succeeded', 'failed')),
  `attempt_count` INTEGER NOT NULL DEFAULT 0,
  `total_count` INTEGER,
  `cache_hits` INTEGER NOT NULL DEFAULT 0 CHECK (`cache_hits` >= 0),
  `claimed_by_run_id` varchar(120),
  `last_error_json` text,
  `created_at` INTEGER NOT NULL,
  `updated_at` INTEGER NOT NULL,
  `started_at` INTEGER,
  `finished_at` INTEGER,
  PRIMARY KEY (`id`),
  UNIQUE (`target_id`, `task_type`, `range_start_at`, `range_end_at`, `page_no`),
  CHECK (`range_end_at` >= `range_start_at`),
  CHECK (
    (`task_type` = 'page' AND `page_no` >= 1) OR
    (`task_type` <> 'page' AND `page_no` = 0)
  ),
  CHECK (`attempt_count` >= 0),
  CHECK (`total_count` IS NULL OR `total_count` >= 0),
  FOREIGN KEY (`batch_id`) REFERENCES `fetch_batch` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`target_id`) REFERENCES `fetch_target` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`parent_task_id`) REFERENCES `fetch_task` (`id`) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_fetch_task_claim
ON fetch_task (`batch_id`, `status`, `target_id`, `sequence`, `created_at`);

CREATE INDEX IF NOT EXISTS idx_fetch_task_parent
ON fetch_task (`parent_task_id`, `status`);

CREATE INDEX IF NOT EXISTS idx_fetch_task_failed_page
ON fetch_task (`batch_id`, `task_type`, `status`, `target_id`, `range_start_at`, `page_no`);

---- 跨进程备份流程执行租约。固定 lease_name 主键保证同一数据库同一时刻只有一个流程。
CREATE TABLE IF NOT EXISTS `workflow_execution_lease` (
  `lease_name` varchar(80) NOT NULL,
  `run_id` varchar(120) NOT NULL,
  `owner_kind` varchar(40) NOT NULL,
  `owner_pid` INTEGER NOT NULL,
  `acquired_at` INTEGER NOT NULL,
  `heartbeat_at` INTEGER NOT NULL,
  PRIMARY KEY (`lease_name`),
  CHECK (`acquired_at` >= 0),
  CHECK (`heartbeat_at` >= `acquired_at`)
);

