# 数据与持久化

## 生产路径

默认路径由 `src/config/path.ts` 和 `src/config/database.ts` 给出，仍位于应用根目录：

| 数据 | 默认位置 |
| --- | --- |
| 本地请求配置 | `config.json` |
| 任务配置 | `customer_task_config.json` |
| SQLite | `mblog_v1.1.0.sqlite` |
| 图片/HTML 等旧缓存 | `缓存文件/imgPool`、`缓存文件/html` |
| 微博 HTTP JSON 缓存 | `缓存文件/weibo-http/` |
| 文本/JSONL 日志 | `log/runtime.YYYY-MM-DD.{log,jsonl}` |
| 电子书 | `稳部落输出的电子书/` |

Knex 按当前 database URI 延迟创建，不会因为 import model 就打开生产数据库；路径改变或显式 `destroy()` 后会建立对应 client。日期任务入口会再次以 `CREATE TABLE IF NOT EXISTS` 确认 schema，并设置 60 秒 SQLite busy timeout。

## 任务配置 schema

`CustomerTaskConfig` 采用严格运行时校验，旧页码任务配置不兼容，也不会静默补默认值。`fetchStartAtPageNo`、`fetchEndAtPageNo`、`onlyRetry` 和 `enableAutoConfig` 不再是有效字段；无法读取旧配置时由用户通过 `reset-task-config` 明确重置为新默认配置。

| 字段 | 约束与含义 |
| --- | --- |
| `configList` | `{ uid, rawInputText, comment }[]`；保存草稿时可为空或 UID 为空，启动时至少一项、UID 为 1~32 位数字且批次内不重复 |
| `fetchStartDate` / `fetchEndDate` | `YYYY-MM-DD` 北京日期；开始不早于 `2009-09-01`，结束不早于开始且不晚于当天 |
| `requestIntervalSeconds` | 10~3600 的整数，默认 10；控制全局微博网络请求开始间隔 |
| `cacheReadMode` | `prefer-cache | refresh`，默认 `prefer-cache` |
| `outputStartAtMs` / `outputEndAtMs` | 独立于抓取范围的非负毫秒时间戳，结束不得早于开始 |
| `imageQuilty` | 保留既有字段拼写；`default | none | raw | hd` |
| `postAtOrderBy` | `asc | desc` |
| `volumeSplitBy` / `volumeSplitCount` | `single | year | month | count` 及大于等于 1 的分卷数量 |
| 其余输出字段 | `bookTitle`、`comment`、`isSkipFetch`、`isSkipGeneratePdf`、`isRegenerateHtml2PdfImage`、`isOnlyArticle`、`isOnlyOriginal` |

新批次把完整配置序列化到 `fetch_batch.config_json`。batch、配置中的全部 target 和所有初始 year probe 在一个事务中提交，任一创建失败则全部回滚。继续和重试始终读取该快照，而不是当前磁盘草稿；抓取起止秒、执行身份、缓存策略和请求间隔也作为独立列冻结。在线批次的 `login_uid` 是经校验的数字登录 UID；`isSkipFetch=true` 的离线新批次使用保留值 `offline-skip-fetch`，该值不得用于 API client 或 HTTP 缓存。仅生成失败的在线批次离线继续时保留其原数字 `login_uid`，不改写持久化身份。

## SQLite 日期任务表

`src/command/init.sql` 增量保留 `total_mblog`、`total_user` 和旧 `fetch_error_record`，并新增三张表。旧错误表不再是日期任务恢复的真相源。

| 表 | 关键列 | 状态/约束 |
| --- | --- | --- |
| `fetch_batch` | `id`、`created_run_id`、`active_run_id`、`phase`、`status`、`config_json`、`login_uid`、`cache_read_mode`、`request_interval_seconds`、`fetch_start_at`、`fetch_end_at`、时间戳 | phase 为 `planning | fetching | generating | done`；status 为 `pending | running | succeeded | partial_success | failed` |
| `fetch_target` | `id`、`batch_id`、`target_uid`、`sequence`、`status`、时间戳 | 同一批次 UID 唯一；status 与批次状态集合相同，按子任务聚合 |
| `fetch_task` | `id`、`batch_id`、`target_id`、`parent_task_id`、`task_type`、`range_start_at`、`range_end_at`、`page_no`、`sequence`、`status`、`attempt_count`、`total_count`、`cache_hits`、`claimed_by_run_id`、`last_error_json`、时间戳 | task type 为 `year_probe | month_probe | segment_probe | page`；status 为 `pending | running | succeeded | failed` |
| `workflow_execution_lease` | `lease_name`、`run_id`、`owner_kind`、`owner_pid`、`acquired_at`、`heartbeat_at` | 固定主键的跨进程执行租约；同 runId 可重入，不同 runId 只能在 owner PID 已死亡或无 PID 的 heartbeat 已过期时用条件 CAS 接管 |

`fetch_start_at`、`fetch_end_at`、`range_start_at` 和 `range_end_at` 是北京时间闭区间对应的 Unix 秒；`created_at`、`updated_at`、`started_at`、`finished_at` 是 Unix 毫秒。非页任务 `page_no = 0`，页任务 `page_no >= 1`。逻辑任务由 `(target_id, task_type, range_start_at, range_end_at, page_no)` 唯一确定，重复展开不会创建第二项；任务、目标与批次使用稳定 ID，batch ID 与每次执行的 run ID 分离。

claim 使用条件更新把 pending 变为 running，同时增加 `attempt_count` 并记录 `claimed_by_run_id`。只有 running 能完成为 succeeded/failed。成功 probe 的子任务创建、`total_count`/缓存命中写入、父任务成功和聚合刷新原子提交；历史半提交留下的后代仅在全部从未开始时才可于同一事务中删除重建，已开始的进度绝不覆盖。失败保存受限的结构化 `code/message/retryable` 诊断。目标和批次根据子状态聚合；同时存在成功与失败时为 `partial_success`。同进程 workflow 失败会立即恢复本批次遗留 running；硬退出后的启动恢复将其标成 `FETCH_TASK_INTERRUPTED`/failed。继续或重试只把选中的 failed 重置为 pending，保留 attempt count 和全部 succeeded 项；仓储拒绝把已经 succeeded 的批次重新打开，即使调用方持有过期状态快照。生成阶段失败即使没有 failed fetch task 也仍可继续，且这类仅生成恢复不需要 Cookie 或登录 UID 查询。任一 pending/running/failed 抓取任务都使会话鉴权重新成为必需条件。

微博页数据继续按 `total_mblog.id` upsert，用户资料按 `total_user.author_uid` upsert。日期任务表只记录调度与诊断，不复制微博正文。

执行租约实际保存在业务数据库同目录的 `.stablog-execution-lock.sqlite`，与可被 `init --rebase` 删除重建的业务 SQLite 分离。持有者每 5 秒更新 heartbeat，默认 stale 窗口为 5 分钟；本机 owner PID 死亡时无需等待 stale 即可接管。独立协调库不会保存 Cookie、请求响应或微博正文。`init.sql` 同时保留该表的增量定义，以便现有数据库 schema 检查保持完整。

## HTTP JSON 缓存

缓存文件路径为：

```text
PathConfig.cachePath/
└─ weibo-http/<apiVersion>/<targetUid>/<loginUid>/<sha256>.json
```

SHA-256 输入是稳定排序后的 `{ apiVersion, endpoint, loginUid, targetUid, params }`；请求头、Cookie、token、动态文章时间戳不进入签名或缓存文件。envelope 保存 schema version、key hash、ISO 缓存时间、规范化请求和通过 schema 校验的响应。写入采用同目录临时文件后 rename，损坏或校验失败按 cache miss 处理。

缓存只适用于范围结束秒严格早于批次创建时刻减一个自然月的日期检索、长微博和文章请求；用户资料始终请求网络。`prefer-cache` 可读取，`refresh` 只跳过读取；两种模式的成功网络响应都会覆盖符合条件的缓存。缓存不设 TTL。清理操作精确删除当前 `apiVersion + targetUid + loginUid` 目录，不影响其他登录身份、其他目标、图片/HTML 缓存、SQLite 微博或任务历史。

## 测试隔离

测试用 `os.tmpdir()` 下的唯一目录分别提供 config、任务配置、SQLite、cache、log 和 output；完成后删除。`KEEP_TEST_ARTIFACTS=1` 仅用于诊断时保留该临时目录。任何 fixture 都不得引用上述生产默认路径。
