# 架构与业务链路

## 分层

`src/interface` 是入口适配层：Electron IPC 与 Optique CLI 只校验输入、提供运行能力并调用 application。`src/application/bootstrap` 是可离线测试的应用启动边界，按“初始化目录/数据库 → 恢复中断任务 → 创建窗口并注册 IPC → 加载页面”执行；`src/application/workflow/run_task` 是 GUI/CLI 共用的唯一任务编排入口。`src/application/legacy` 暂时适配旧初始化与生成 command；`src/shared` 提供配置、IPC、错误、执行结果、日志和运行上下文契约。

日期抓取能力位于 `src/application/fetch`：planner 只负责北京时间范围拆分，API schema/client 和 canonical adapter 隔离微博供应商 DTO，response cache 与全局 limiter 负责网络边界，repository/service 负责 SQLite 任务树与执行，`CustomerTaskRunManager` 负责 GUI 后台运行、并发锁和进度快照。`total_mblog`、`total_user` 及旧 HTML/PDF 生成器仍是最终数据与输出链路。

Electron 渲染进程按纯 Web 环境运行，启用 `contextIsolation` 并禁用 Node 集成。前端使用 React + Ant Design + Vite 构建；页面只能通过 preload 暴露的有限 `window.stablog` 能力访问主进程，不依赖 Node 的 `global`、`process` 或 `require`。Vite 的 `base` 固定为 `./`，使生产产物可由 Electron `loadFile` 加载；开发服务器启用严格文件访问，只允许读取当前仓库。现有功能页由根页面的 Tabs 管理，不引入额外前端路由状态。

`RunTaskWorkflow` 提供 `init`、`fetch`、`generate`、`run`。完整 `run` 按 `init → fetch → generate` 执行；阶段返回 failure 后不再执行后续阶段，抓取返回 partial success 时会使用已成功数据继续生成。每次执行生成不可变 `traceId`、`runId` 和路径快照，返回 `success | partial_success | failure` 结果。

## 日期检索任务树

新批次创建时冻结完整任务配置、执行身份、请求间隔和北京时间抓取闭区间。在线抓取冻结当前登录 UID；`isSkipFetch=true` 的新批次冻结显式离线身份 `offline-skip-fetch`。batch、全部 target 和初始 year root 在同一个 SQLite 事务中创建，规划任一步失败都会整体回滚，不留下缺用户或缺年份的半批次。默认区间是 `2009-09-01 00:00:00` 至任务启动日 `23:59:59`；继续或重试原批次不会把截止日推进到新的当天。目标用户按配置顺序串行处理。

任务按成功父节点逐层展开：

```text
fetch_batch
└─ fetch_target（每个目标 UID 一项，按配置 sequence）
   └─ year_probe（与用户范围相交的每年）
      └─ month_probe（年度 total > 0 时创建）
         └─ segment_probe（月度 total > 0 时创建）
            └─ page（日期段 total > 0 时创建）
```

年、月、日期段 probe 均调用日期检索接口取得 `total`。`total = 0` 时当前节点成功并剪枝；否则继续展开。每月使用固定的 `1~7`、`8~14`、`15~21`、`22~28`、`29~月末` 段，并裁剪到用户选择范围，任何日期段都不跨月。页节点为 `1..ceil(total/50)`，页码从 1 开始。子任务展开、父 probe 成功和聚合状态更新在同一个事务中提交；旧版本若遗留从未领取的 pending 子树，重试时会在该事务内按当前 total 重建，任何已经开始的后代都会保留并使修复明确失败。任务 claim 只选择 `pending` 且无父节点或父节点已成功的项，并按目标及任务 sequence 排序。

检索、用户信息、长微博和文章响应都先做运行时 schema 校验。供应商 DTO 随后转换成稳定内部微博模型；页内补全完成后，微博按 ID upsert 到 `total_mblog`，并在同一个 SQLite 事务中把页任务标记成功。长微博或文章补全失败时，所属页任务保留为可重试失败，不能把异常响应当作成功空结果。用户资料写入 `total_user`；鉴权、用户身份、规划或数据库等全局错误使 workflow 失败。

## 后台执行、恢复与进度

GUI 的开始、继续和失败项重试先完成 payload 校验并原子取得跨进程执行租约，再读取或校验任何业务 SQLite 批次快照，随后按持久化抓取状态决定是否校验登录身份，最后持久化批次并用 `setImmediate` 启动后台 workflow；IPC 回执只包含稳定的 `batchId`、本次 `runId` 和 `started | already_running`，不等待抓取或生成完成。新建跳过抓取任务不检查 renderer 登录状态，只在本地解析数字 UID；manager 和 fetch adapter 也不读取 Cookie、解析登录 UID 或创建 API client。普通旧批次仅当全部抓取任务均为 `succeeded`、只需重试生成时走相同离线路径，并沿用冻结的 `loginUid`；存在任一 `pending`、`running` 或 `failed` 抓取任务时仍须用当前会话校验相同登录身份。`CustomerTaskRunManager` 的 preparation/active run 锁处理同一主进程的重复点击，SQLite durable lease 则保证 GUI、CLI 和另一个 manager 同一时刻只有一个备份流程。任务配置写入、清缓存和退出登录也临时取得相同租约，因此不会与外部 CLI 交叉修改。本流程不提供暂停或取消。

renderer 根页面共享一份 dashboard polling：存在活动运行时每 1 秒、空闲时每 5 秒通过 IPC 读取 SQLite 快照，配置页和日志页消费同一状态。快照包含批次阶段、当前用户/日期节点/页、聚合计数、缓存命中和预计剩余秒数；预计值按剩余 `pending + running` 数量乘请求间隔及 `1.5` 渲染余量计算。日志文件不是进度真相源，清空日志不改变任务状态。

workflow 在同一进程内异常返回时会先把本批次遗留的 `running` 任务转成可重试失败，再结束批次；硬退出后，启动恢复通过租约记录的 owner PID 识别死亡进程并立即接管，再写入 `FETCH_TASK_INTERRUPTED`。迁移记录没有 owner PID 且 heartbeat 尚未 stale 时，主进程会托管一次到期重试，不会只在启动时跳过一次。GUI 已经打开时，dashboard 对无本地 active run 的 running 批次最多每 5 秒做一次非阻塞租约探测；健康外部进程继续持有，死亡或 stale owner 被接管后立即恢复为手工可继续的 failed。继续/重试在取得租约后也会先恢复该批次遗留的 running，随后沿用冻结配置和登录身份，保留成功项，把选中的失败项恢复为 pending；即使抓取任务已全部成功但生成阶段失败，批次仍可继续并重新进入生成。单项或全部失败重试使用同一批次和新 runId。重新抓取则创建全新批次，微博数据仍按 ID 幂等写入。

## 缓存与限流

主进程内的登录身份、用户信息、日期检索、长微博、文章和失败重试等实际微博网络请求共享同一个 FIFO 限流器。相邻网络请求开始时间至少间隔配置值，默认且最小为 10 秒；失败请求同样占用时隙，不自动退避。缓存命中不进入网络请求队列。

只有范围结束秒严格早于“批次启动时刻减一个自然月”的检索、长微博或文章成功响应才可写入/读取 HTTP JSON 缓存，因此任务启动日所在日期段必然不读旧缓存。`prefer-cache` 先读缓存，miss 后请求并写回；`refresh` 跳过读取，成功后覆盖符合条件的缓存。缓存无 TTL，内容和 key 均不得包含 Cookie、token 或请求头；损坏、版本或 schema 不匹配按 miss 处理。

## 现有链路与等级

| 链路 | 主要步骤 | 等级 |
| --- | --- | --- |
| 应用启动 | Electron ready → bootstrap 初始化目录/数据库并恢复中断任务 → 建窗 → 注册 IPC → 加载页面 | S0；失败统一为 `INITIALIZATION_FAILED` |
| GUI 备份 | schema 校验 → 创建/恢复批次 → 后台 workflow → SQLite 进度轮询 → 打开输出目录 | S1；配置/持久化损坏按 S0 |
| 抓取 | 日期任务树 → schema/canonical adapter → SQLite；局部失败可人工继续/重试 | S1；全局失败短路，局部失败形成 partial success |
| 生成 | SQLite → HTML → Electron 截图 → PDF → 输出目录 | S1 |
| 数据浏览/导入导出 | IPC → model/command → SQLite/文件 | S2；可能破坏数据的导入失败按 S0 |
| 日志/DevTools/帮助页 | IPC 或远程页面 | S3 |

## 兼容边界

旧 command 仍读取静态 `PathConfig`/`DatabaseConfig`。`legacy_runtime_bridge` 通过进程内队列串行执行旧 adapter，在执行前切换到本次 context，并在 `finally` 恢复；GUI 另用 active run 锁处理重复点击。fetch/generate/run 和带 `--rebase` 的 init 共享独立协调 SQLite 中的 durable lease，跨进程竞争使用条件 UPSERT/CAS，不依赖普通 SELECT 后 INSERT。普通 init/schema 启动不抢租约；rebase 删除业务数据库时会短暂重试 Windows 占用错误并验证删除成功。

旧生成器需要 Electron `BrowserWindow` 渲染 HTML；CLI 可独立执行 init/fetch，但 generate/run 在缺少该能力时明确失败，不会假成功。`pnpm start` 只运行已有的 `dist/index.js`；开发期使用 `pnpm watch` 或显式构建命令更新 dist。
