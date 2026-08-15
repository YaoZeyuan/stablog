import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { UserConfig } from 'vite'
import { describe, expect, it } from 'vitest'
import viteConfig from '../../client/vite.config.mts'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

describe('客户端构建配置', () => {
  it('生产环境使用相对基础路径且开发环境使用固定桌面端地址', () => {
    const config = viteConfig as UserConfig

    expect(config.root).toBe(path.resolve(repositoryRoot, 'client'))
    expect(config.base).toBe('./')
    expect(config.server).toMatchObject({
      host: '127.0.0.1',
      port: 8000,
      strictPort: true,
      fs: {
        strict: true,
        allow: [repositoryRoot],
      },
    })
  })

  it('渲染进程不依赖旧前端框架与运行时全局变量填充', () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.resolve(repositoryRoot, 'client/package.json'), 'utf8'),
    ) as {
      scripts: Record<string, string>
      dependencies: Record<string, string>
      devDependencies: Record<string, string>
    }
    const allDependencies = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    }

    expect(packageJson.scripts.start).toBe('vite')
    expect(packageJson.scripts.build).toBe('vite build')
    expect(Object.keys(allDependencies).some((name) => name.startsWith('@umijs/'))).toBe(false)
    expect(fs.existsSync(path.resolve(repositoryRoot, 'client/.umirc.ts'))).toBe(false)
  })
})
