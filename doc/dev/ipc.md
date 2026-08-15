# IPC 契约

渲染进程启用 `contextIsolation` 并关闭 `nodeIntegration`。`src/preload.cjs` 只暴露 `window.stablog.invoke(channel, payload, metadata)`，且 channel 必须命中白名单；主进程统一用 `ipcMain.handle`，不使用同步 IPC。

所有响应使用信封：

```ts
type IpcResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: SerializedApplicationError }
```

metadata 可带非空 `traceId`。主进程对每个 payload 做运行时校验；失败也返回上述信封，不向 renderer 抛出未结构化的远程异常。

## 日期任务 channel

| channel | payload | `value` |
| --- | --- | --- |
| `get-task-config` | 无 | `CustomerTaskConfig` |
| `save-task-config` | `{ taskConfig: CustomerTaskConfig }` | 校验并持久化后的 `CustomerTaskConfig` |
| `reset-task-config` | `{}` | 当前 schema 的默认 `CustomerTaskConfig` |
| `start-customer-task` | `{ config: CustomerTaskConfig }` | `TaskCommandAck` |
| `continue-customer-task` | `{ batchId: string }` | `TaskCommandAck` |
| `retry-customer-task-items` | `{ batchId: string, taskIds?: string[] }` | `TaskCommandAck`；省略 `taskIds` 表示全部失败项，显式数组为 1~100 个唯一任务 ID |
| `get-customer-task-dashboard` | `{ batchId?: string }`，也可省略 payload | `CustomerTaskDashboard`；未指定时优先活动批次，否则最新批次 |
| `get-customer-task-failures` | `{ batchId: string, offset?: number, limit?: number }` | `{ items: CustomerTaskFailureSummary[], total: number }`；默认 offset 0、limit 50，limit 范围 1~100 |
| `clear-weibo-request-cache` | `{ targetUid: string }` | `true`；只清当前登录身份下该数字 UID 的微博 HTTP 缓存 |

命令回执是：

```ts
type TaskCommandAck = {
  outcome: 'started' | 'already_running'
  batchId: string
  runId: string
}
```

`started` 表示前置校验及批次创建/恢复已经完成，后台 workflow 已排队；它不是任务完成结果。主进程存在 preparation 或 active run 时，开始/继续/重试返回当前运行的 `already_running`，不创建第二个流程。活动期间保存/重置配置、清缓存和退出登录会被拒绝。

dashboard 的时间戳均为 Unix 毫秒，核心结构为：

```ts
type TaskProgressCounts = {
  total: number
  pending: number
  running: number
  succeeded: number
  failed: number
  cacheHits: number
}

type CustomerTaskDashboard = {
  activeRun: null | { batchId: string; runId: string }
  batch: null | {
    batchId: string
    status: 'pending' | 'running' | 'succeeded' | 'partial_success' | 'failed'
    resumable: boolean
    phase: 'planning' | 'fetching' | 'generating' | 'done'
    createdAt: number
    startedAt?: number
    finishedAt?: number
    estimatedRemainingSeconds: number | null
    current?: {
      uid: string
      screenName?: string
      year?: number
      month?: number
      segmentStartDate?: string
      segmentEndDate?: string
      page?: number
      pageCount?: number
    }
    counts: TaskProgressCounts
    users: Array<{
      uid: string
      screenName?: string
      status: 'pending' | 'running' | 'succeeded' | 'partial_success' | 'failed'
      counts: TaskProgressCounts
    }>
  }
}
```

失败项摘要包含 `taskId`、`taskType`、UID/昵称、日期段、可选页码、尝试次数、错误码/脱敏消息和更新时间；`taskType` 契约允许 `year_probe | month_probe | segment_probe | page | long_text | article`。renderer 用 task ID 发起单项重试，不提交或修改数据库行。

根页面启动一份共享轮询：`activeRun !== null` 时每 1 秒，否则每 5 秒调用 dashboard；配置页与日志页只消费该快照。失败列表按当前 batch 分页加载。任务进度完全来自主进程读取的 SQLite，renderer 不直接读数据库或推断日志内容。

## 其他 channel 与边界

| 类别 | channel |
| --- | --- |
| 微博会话 | `get-weibo-login-status`、`resolve-weibo-uid`、`get-weibo-user-info` |
| 路径/日志 | `get-path-config`、`get-file-content`、`write-file-content`、`show-item-in-folder` |
| 数据 | `get-user-list`、`get-weibo-distribution`、`get-mblog-list`、`get-fetch-error-distribution` |
| 导入导出 | `show-save-dialog`、`show-open-dialog`、`data-transfer-export`、`data-transfer-import` |
| 系统能力 | `reset-session`、`open-output-dir`、`open-external`、`open-devtools`、`check-upgrade` |

微博登录、UID 解析、用户信息与升级查询均由主进程受控网络请求完成，renderer 不直接跨域访问远程服务。文件读写只接受两个明确配置文件或缓存、输出、日志目录内目标，并在解析既有符号链接后执行路径策略；导入导出还必须与主进程最近一次文件对话框授权的 `.json` 路径完全相同。外部链接只允许 HTTP(S)。

新增 channel 时必须同时更新共享 request/response 类型与解析器、preload 白名单、主进程 handler、renderer 调用类型及 IPC schema 测试。
