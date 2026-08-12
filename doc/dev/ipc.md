# IPC 契约

渲染进程启用 `contextIsolation` 并关闭 `nodeIntegration`。`src/preload.cjs` 只暴露 `window.stablog.invoke(channel, payload, metadata)`，且 channel 必须命中白名单；主进程统一用 `ipcMain.handle`，不再使用同步 IPC。

所有响应使用信封：

```ts
type IpcResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: SerializedApplicationError }
```

metadata 可带非空 `traceId`。主要 channel：

| 类别 | channel |
| --- | --- |
| 任务 | `get-task-config`、`save-task-config`、`start-customer-task` |
| 微博会话 | `get-weibo-login-status`、`resolve-weibo-uid`、`get-weibo-user-info` |
| 路径/日志 | `get-path-config`、`get-file-content`、`write-file-content`、`show-item-in-folder` |
| 数据 | `get-user-list`、`get-weibo-distribution`、`get-mblog-list`、`get-fetch-error-distribution` |
| 导入导出 | `show-save-dialog`、`show-open-dialog`、`data-transfer-export`、`data-transfer-import` |
| 系统能力 | `reset-session`、`open-output-dir`、`open-external`、`open-devtools`、`check-upgrade` |

`start-customer-task` 校验完整任务配置，只采集微博域 session cookie，更新请求配置、运行共享 workflow，并返回完整结构化执行结果；并发请求返回当前 `runId`。微博登录、UID 解析、用户信息与升级查询均由主进程受控网络请求完成，renderer 不直接跨域访问远程服务。文件读写只接受两个明确配置文件或缓存、输出、日志目录内目标；导入导出还必须与主进程最近一次文件对话框授权的 `.json` 路径完全相同。外部链接只允许 HTTP(S)。

新增 channel 时必须同时更新 preload 白名单、主进程 handler、renderer 类型与 schema 测试。
