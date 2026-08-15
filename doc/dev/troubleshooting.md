# 故障排查

## 启动即报模块错误

先运行 `pnpm tsc && pnpm build-server`。检查内部 import 是否带 `.js`、CJS 文件是否为 `.cjs`、`dist/package.json` 是否为旧构建残留。清理脚本会移除这类 stale 文件；不要手工复制旧 dist。

## CLI

`pnpm build-server` 后运行 `pnpm cli --help`。若 CLI generate/run 返回 `GENERATE_FAILED` 且提示缺少 Electron 渲染窗口，这是第一阶段已接受边界；改用 GUI 完整备份，CLI 仅执行 init/fetch。

## GUI 任务失败

在 `log/runtime.YYYY-MM-DD.jsonl` 按 `runId` 聚合，再看最后一个 failure 的 stage、errorCode、serviceLevel、cause。`CONFIG_SCHEMA_INVALID` 先检查任务配置；`INITIALIZATION_FAILED` 检查目录写权限/SQLite；`FETCH_FAILED` 检查登录状态、频率和网络；`GENERATE_FAILED` 检查缓存、图片、渲染窗口和磁盘空间。

GUI、CLI 通过业务数据库同目录的 `.stablog-execution-lock.sqlite` 同时只运行一个备份 workflow。冲突时会提示已有备份流程；同一 GUI 内重复点击返回当前活动 run。若持有进程异常退出，新进程会根据 owner PID 立即接管；无法识别 PID 的旧记录在 heartbeat 超过 5 分钟后可接管，不要手工删除协调库。

## 前端白屏或资源加载失败

前端使用 Vite，开发服务器固定监听 `127.0.0.1:8000`。先确认 `pnpm start-client` 启动成功，再运行 `pnpm start`；端口被占用时 Vite 会立即报错，不会静默切换端口。安全渲染进程不提供 Node `global`，不要通过开启 `nodeIntegration` 或在 preload 中暴露整个全局对象规避第三方包错误。生产构建后检查 `client/dist/index.html` 中的 JS/CSS 地址应以 `./` 开头。

## 测试误触业务数据

立即停止测试并检查是否绕过 `createTestSandbox`。所有测试路径必须位于系统临时目录；网络访问会由 offline guard 抛错。日志中不得出现 cookie/token，若出现应先补脱敏测试再修实现。

## 构建

- Vite 启动报 8000 端口被占用：停止旧前端进程后重启，不要修改为随机端口。
- Electron Builder 报网络 EACCES/超时：确认代理/防火墙后重试；`pnpm build-dist` 可先独立验证源码和前端。
- native module ABI 错误：重新执行根目录 `pnpm install --frozen-lockfile`，必要时运行 `pnpm rebuild-sqlite3`；不要在 client 单独安装。
