const { contextBridge, ipcRenderer } = require('electron')

const allowedChannels = new Set([
  'open-output-dir',
  'reset-session',
  'start-customer-task',
  'get-weibo-login-status',
  'resolve-weibo-uid',
  'get-weibo-user-info',
  'check-upgrade',
  'get-file-content',
  'write-file-content',
  'get-path-config',
  'get-task-config',
  'save-task-config',
  'show-save-dialog',
  'show-open-dialog',
  'get-weibo-distribution',
  'get-mblog-list',
  'get-user-list',
  'get-fetch-error-distribution',
  'data-transfer-export',
  'data-transfer-import',
  'open-devtools',
  'open-external',
  'show-item-in-folder',
])

contextBridge.exposeInMainWorld('stablog', {
  invoke(channel, payload, metadata) {
    if (allowedChannels.has(channel) === false) {
      return Promise.reject(new Error(`IPC channel is not allowed: ${channel}`))
    }
    return ipcRenderer.invoke(channel, payload, metadata)
  },
})
