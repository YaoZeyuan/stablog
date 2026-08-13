import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { UserConfig } from 'vite'
import { describe, expect, it } from 'vitest'
import viteConfig from '../../client/vite.config.mts'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

describe('client build configuration', () => {
  it('uses a relative production base and the fixed Electron development address', () => {
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

  it('keeps the renderer independent from Umi and Node global polyfills', () => {
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
