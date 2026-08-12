# 错误、服务等级与日志

## 服务等级

| 等级 | 含义 | 例子 | 处理 |
| --- | --- | --- | --- |
| S0 | 无法启动或有数据损坏风险 | 配置 schema、初始化/数据库、危险导入 | 立即失败并阻止后续步骤；成功/失败测试必需 |
| S1 | 核心抓取或生成不可用 | FETCH_FAILED、GENERATE_FAILED | workflow 失败并短路；记录 run/stage/cause |
| S2 | 部分任务或非核心能力失败 | 单项浏览、文件/IPC 操作 | 返回可诊断失败，可按 retryable 决定重试 |
| S3 | 体验或诊断问题 | DevTools、帮助页、日志展示 | 不影响核心结果，记录 warning/error |

稳定错误码：`CONFIG_SCHEMA_INVALID`、`IPC_PAYLOAD_INVALID`、`WORKFLOW_FAILED`、`INITIALIZATION_FAILED`、`FETCH_FAILED`、`GENERATE_FAILED`、`DATABASE_FAILED`、`FILE_SYSTEM_FAILED`、`LOG_WRITE_FAILED`、`DIAGNOSTIC_FAILED`、`UNKNOWN_ERROR`。`ApplicationError` 必含 code、message、serviceLevel、stage、retryable，可选 cause/details，并可无损序列化。基础设施分类函数将启动映射为 `INITIALIZATION_FAILED/S0`、数据库映射为 `DATABASE_FAILED/S0`、普通文件操作映射为 `FILE_SYSTEM_FAILED/S2`，日志写入及诊断能力分别映射为 `LOG_WRITE_FAILED/S3`、`DIAGNOSTIC_FAILED/S3`。

## 结构化日志

每条 JSONL 记录至少包含 `schemaVersion`、`triggerAt`、`level`、`eventCode`、`source`、`message`；workflow 事件还带 `traceId`、`runId`、stage、status、durationMs，失败事件带 serviceLevel、errorCode 和序列化 error/cause。启动边界实际记录 `APP_START` 的 start/success，失败记录含 `INITIALIZATION_FAILED/S0` 的 `APP_ERROR`。日志同时写可读 `.log` 和 `.jsonl`；单个目的地失败时会尝试另一路并写 stderr，同时保留 `LOG_WRITE_FAILED/S3` 诊断对象，不覆盖原业务错误。

日志递归脱敏 cookie、authorization、token、secret、请求/响应 header、正文/HTML/原始 JSON，并限制字符串、数组、对象键、堆栈和递归深度。旧 command 的 `Base.log/warn` 也把原始对象参数交给 Logger 后再脱敏，不得先 stringify；业务代码不得主动把 cookie 或完整响应放入 message。
