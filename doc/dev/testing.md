# 测试

## 验收命令

仓库固定 Node 24 和 pnpm 11。任务 3 的完整验收顺序为：

```powershell
corepack pnpm tsc
corepack pnpm test:unit
corepack pnpm test:integration
corepack pnpm test
corepack pnpm build-dist
corepack pnpm debug-build
```

`pnpm tsc` 同时检查主进程/CLI 和 `client/tsconfig.json`。`test:unit`、`test:integration` 可用于快速定位，`pnpm test` 是带 V8 coverage 的全量复跑。`build-dist` 清理并重建主进程、CLI 和 client，再把 `client/dist` 复制到 `dist/client/dist`；Electron/IPC/GUI 改动还要用 `debug-build` 验证 Windows unpacked 应用可打包。不要用 `pnpm start` 代替构建，`start` 只运行已有 `dist/index.js`。只改 renderer 时可先运行 `corepack pnpm --dir client build`，最终仍以根命令为准。

## 离线与数据隔离

Vitest 4 分为 unit 和 integration 两个 Node project，均加载 `tests/setup/offline.ts`、启用 isolate 并关闭文件并行。离线守卫会阻止 `fetch`、Node HTTP(S) request/get 和 TCP connect/createConnection；自动化测试出现真实网络访问即失败，不得临时关闭全局守卫。

所有外部依赖使用显式注入：微博 API 使用记录请求并按队列返回脱敏 fixture 的 fake transport；限流器注入 fake `now/sleep` clock；日期 planner 注入固定 `startedAtMs`；文章动态参数注入固定 `now`。单元测试不得依赖真实 `setTimeout` 等 10 秒请求间隔，也不得读取 Electron session。

`createTestSandbox()` 在 `os.tmpdir()` 下为每个用例创建唯一根目录，并分别提供：

```text
config.json
customer_task_config.json
database/test.sqlite
cache/
log/
output/
```

测试只能把这些显式路径传给 RunContext、repository、cache 和 logger，不得读取或覆盖生产 `config.json`、`customer_task_config.json`、`mblog_v1.1.0.sqlite`、`缓存文件`、`log` 或输出目录。正常 teardown 递归删除 sandbox；仅诊断时设置 `KEEP_TEST_ARTIFACTS=1`，测试会打印保留路径供人工检查。

`tests/fixtures/weibo/*.redacted.json` 是脱敏的接口形状样本。fixture 不得包含真实 Cookie/token/用户隐私；更新接口样本时必须同时更新 zod schema 与 canonical adapter 断言。成功响应测试覆盖 `ok: 1`、列表最多 50 项、total 数字归一化和合法空结果；HTTP、业务码或 schema 异常必须断言为失败，不能伪装为 `list: []`。

## 任务 3 覆盖与验收点

- 日期规划：北京时间闭区间、`2009-09-01`/启动日边界、跨年/月裁剪、闰年、五个固定月内日期段、`ceil(total/50)` 和从 1 开始页码。
- API 与模型：profile/search/longtext/新旧文章参数、所有响应先过 schema、原帖/转发/媒体/普通及 Markdown 长文/文章转换成稳定内部模型；HTML 语义回归覆盖作者、正文、日期、媒体、转发、Markdown/文章，以及顶层删除记录缺少 `user` 时的占位渲染。
- 缓存：登录 UID/目标 UID/接口版本/参数隔离、敏感 key 拒绝、严格“早于一个自然月”、prefer-cache 命中不调用 transport/limiter、refresh 覆盖、损坏缓存回源、定向清理不越界。
- 限流：FIFO 串行、相邻请求开始时间不小于配置、10 秒下限、失败请求占时隙但队列继续；全部使用 fake clock，无真实等待。
- SQLite：增量建表不破坏既有微博、batch/target/year root 规划原子回滚、probe 子任务与父成功的故障注入原子回滚、历史 pristine 子树重建及已开始后代保护、稳定 batch/run/task ID、父任务成功后才可 claim、条件 claim 防重复、严格状态转换、过期快照不得 reopen succeeded 批次、缓存命中/进度/partial success 聚合、失败分页、单项/全部重试、同进程失败与重启时 running → failed、生成失败仍可继续，以及继续时 attempt 累加。离线用例另覆盖 skip-fetch 新批次使用保留身份、全部抓取成功后的生成重试沿用原身份，且二者均不读取 Cookie、不解析登录 UID、不创建 API client；仍有 pending/running/failed 抓取任务时空会话必须失败。独立协调 SQLite 还覆盖不同 runId 原子互斥、同 runId 重入、fresh lease 拒绝、无 PID 的 stale 接管、死亡 owner PID 立即接管、错误 runId 不得 heartbeat/release，以及持有租约时业务数据库仍可被 rebase 删除；manager 用例覆盖 GUI 已打开后外部 CLI 才崩溃时的节流探测与恢复，以及 rebase 窗口中 continue 在访问业务 DB 前先被租约拒绝。
- 后台与 IPC：start/continue/retry 立即返回 `TaskCommandAck`，并发命令返回 `already_running`；dashboard/failure 请求校验、毫秒时间戳、活动/空闲轮询及配置/清缓存/退出登录冲突保护。GUI 纯策略测试覆盖跳过抓取时不检查登录，并仅本地接受已保存 UID、数字 UID 和直接微博 UID 地址。
- workflow：GUI/CLI 共用阶段顺序，局部抓取失败返回 partial success 并继续生成，全局失败短路；生成结束正确写入 `done` 和最终批次状态。
- 安全：缓存、SQLite 任务错误、IPC 错误和日志中都不出现 Cookie、token、完整响应正文；清目标缓存不影响图片/HTML 缓存、微博数据或任务历史。

现有基础覆盖还包括 bootstrap 成功/失败短路、ApplicationError 与执行结果契约、结构化日志及脱敏、旧 command 错误传播、RunContext 路径隔离、旧运行时桥串行，以及 Vite 相对 `base`、`127.0.0.1:8000` 严格端口和 Umi 禁用边界。修改 workflow、schema、错误码、日志字段、持久化路径、IPC DTO 或 fixture 规则时必须同步更新测试和本说明。
