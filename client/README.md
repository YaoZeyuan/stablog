# 稳部落前端

前端使用 React 19、Ant Design 6 和 Vite 8。桌面能力统一通过 preload 暴露的
`window.stablog` 调用，不在渲染进程中使用 Node.js 全局变量或 Electron 模块。

依赖由仓库根工作区统一安装：

```bash
corepack pnpm install
```

启动 Vite 开发服务：

```bash
corepack pnpm start-client
```

开发服务固定监听 `http://127.0.0.1:8000`。另开终端运行 `corepack pnpm start`
启动已经编译到 `dist` 的 Electron 主进程；主进程代码变更仍由仓库根目录的
`corepack pnpm watch` 独立编译。

构建生产前端：

```bash
corepack pnpm --dir client build
```

Vite 的 `base` 固定为 `./`，确保构建结果可由 Electron 通过 `file://` 加载。
