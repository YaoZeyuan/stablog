# 测试

```powershell
pnpm tsc
pnpm test:unit
pnpm test:integration
pnpm test
```

Vitest 4 分为 unit 和 integration 两个 project，均使用 Node 环境、关闭文件并行，并加载 `tests/setup/offline.ts`。离线守卫会阻止 fetch、HTTP(S) 和 TCP 连接；需要网络的逻辑必须注入 fake adapter，不得放开全局网络。

当前覆盖：应用 bootstrap 初始化/建窗成功及 `INITIALIZATION_FAILED/S0` 失败短路、任务配置/IPC schema 的成功与失败、ApplicationError 序列化及 S0–S3 基础设施分类、执行结果成功/部分成功/失败、结构化日志与 ApplicationError cause 脱敏、旧 command 对象日志回归、日志写入 `LOG_WRITE_FAILED/S3` 降级、RunContext 路径隔离、旧运行时桥并发串行、网络守卫、旧抓取首屏网络/异常响应与 SQLite 写入错误传播，以及 workflow 顺序、单阶段运行和失败短路。前端构建契约测试固定 Vite 的相对 `base`、`127.0.0.1:8000` 严格端口和 Umi 禁用边界，防止 Electron 再次加载 Webpack JSONP/MFSU 产物。bootstrap 测试注入初始化器、建窗函数和事件 sink，不加载 Electron，也不打开业务数据库。

测试目录由 `createTestSandbox()` 在系统临时目录创建。失败排查可临时设置 `KEEP_TEST_ARTIFACTS=1`，记录输出路径后手工检查；正常 CI 不设置该变量。

修改 workflow、schema、错误码、日志字段、持久化路径或 fixture 规则时必须同步更新测试和本说明。
