# 架构与业务链路

## 分层

`src/interface` 是入口适配层：Electron IPC 与 Optique CLI 只校验输入、提供运行能力并调用 application。`src/application/bootstrap` 是可离线测试的应用启动边界，按“初始化目录/数据库 → 创建窗口并注册 IPC → 加载页面”执行；`src/application/workflow/run_task` 是 GUI/CLI 共用的唯一任务编排入口。`src/application/legacy` 暂时适配旧 command；`src/shared` 提供配置、IPC、错误、执行结果、日志和运行上下文契约。

`RunTaskWorkflow` 提供 `init`、`fetch`、`generate`、`run`。完整 `run` 按 `init → fetch → generate` 执行；某阶段返回 failure 后不再执行后续阶段。每次运行生成不可变 `traceId`、`runId` 和路径快照，返回 `success | partial_success | failure` 结果。

## 现有链路与等级

| 链路 | 主要步骤 | 等级 |
| --- | --- | --- |
| 应用启动 | Electron ready → bootstrap 初始化目录/数据库 → 建窗 → 注册 IPC → 加载页面 | S0；失败统一为 `INITIALIZATION_FAILED` |
| GUI 备份 | schema 校验 → 保存任务配置/cookie → workflow → 打开输出目录 | S1；配置/持久化损坏按 S0 |
| 抓取 | 用户信息 → 分页/详情/文章 → SQLite → 失败项重抓 | S1；首屏请求异常、异常响应及 SQLite 写入失败必须抛出并使 workflow 失败，禁止把异常空值记录为成功 |
| 生成 | SQLite → HTML → Electron 截图 → PDF → 输出目录 | S1 |
| 数据浏览/导入导出 | IPC → model/command → SQLite/文件 | S2；可能破坏数据的导入失败按 S0 |
| 日志/DevTools/帮助页 | IPC 或远程页面 | S3 |

## 兼容边界

旧 command 仍读取静态 `PathConfig`/`DatabaseConfig`。`legacy_runtime_bridge` 通过进程内队列串行执行旧 adapter，在执行前切换到本次 context，并在 `finally` 恢复；GUI 另用 active run 锁拒绝第二次启动。跨进程 CLI 互不共享全局，但不能同时写同一个 SQLite/输出目录。

旧生成器需要 Electron `BrowserWindow` 渲染 HTML；CLI 可独立执行 init/fetch，但 generate/run 在缺少该能力时明确失败，不会假成功。
