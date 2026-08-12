# 数据与持久化

## 生产路径

默认路径由 `src/config/path.ts` 和 `src/config/database.ts` 给出，仍位于应用根目录：

| 数据 | 默认位置 |
| --- | --- |
| 请求配置 | `config.json` |
| 任务配置 | `customer_task_config.json` |
| SQLite | `mblog_v1.1.0.sqlite` |
| 缓存 | `缓存文件/` |
| 文本/JSONL 日志 | `log/runtime.YYYY-MM-DD.{log,jsonl}` |
| 电子书 | `稳部落输出的电子书/` |

数据库实体在第一阶段继续由 model 和 `init.sql` 定义，没有为后续 JSON 格式重构。Knex 改为按当前 database URI 延迟创建，不会因为 import model 就打开生产数据库；路径改变或显式 `destroy()` 后会建立对应 client。

## 任务配置 schema

任务配置采用严格运行时校验。字段包括用户列表、图片质量、时间/页码范围、抓取与 PDF 开关、原创/文章筛选和分卷方式。未知的缺省值不会被静默补齐；范围倒置、非法枚举或错误类型返回 `CONFIG_SCHEMA_INVALID`。保存时允许空用户列表/UID，启动任务前必须至少有一个非空 UID。

## 测试隔离

测试用 `os.tmpdir()` 下的唯一目录分别提供 config、任务配置、SQLite、cache、log 和 output；完成后删除。`KEEP_TEST_ARTIFACTS=1` 仅用于诊断时保留该临时目录。任何 fixture 都不得引用上述生产默认路径。
