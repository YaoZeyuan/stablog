# 发布

## 本地 Windows 验收

```powershell
pnpm install --frozen-lockfile
pnpm tsc
pnpm test
pnpm build-dist
pnpm debug-build
```

`build-dist` 清空并重建 `dist`，Babel 保留原生 ESM，再构建 `client` 并复制到 `dist/client/dist`。`debug-build` 进一步生成 `release/win-unpacked`；验收应确认：

- `稳部落.exe` 存在；
- 包内 `package.json` 有 `type: module`、`main: dist/index.js`；
- `dist/index.js`、`dist/preload.cjs`、`dist/client/dist/index.html` 存在。

`pnpm start` 永远只启动当前 `dist/index.js`；发布脚本不得把编译挂到 start/prestart。

## CI

Windows/macOS workflow 使用 Node 24、pnpm 11.5、Actions v4、根 workspace 冻结锁安装；随后依次运行类型检查、离线测试和平台构建。tag 或手工触发后创建 draft/prerelease 并上传安装包。macOS 本机产物不要求在 Windows 生成，由 macOS CI 验证。

macOS runner 固定为 `macos-15-intel`，与当前 x64 DMG 文件名和原生依赖架构一致；切换 ARM64 时必须同时调整 electron-builder target、原生依赖验证与上传文件名。

当前 `asar: false` 是沿用资源/旧生成器的兼容边界；Electron Builder 会提示风险，后续确认可写资源边界后再迁移到 asar + asarUnpack。
