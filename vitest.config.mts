import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const rootPath = path.dirname(fileURLToPath(import.meta.url))
const offlineSetup = path.resolve(rootPath, 'tests/setup/offline.ts')

export default defineConfig({
  test: {
    reporters: ['default'],
    coverage: {
      provider: 'v8',
      enabled: false,
      reporter: ['text', 'html', 'json-summary'],
      reportsDirectory: path.resolve(rootPath, 'coverage'),
      exclude: ['**/*.d.ts', 'tests/**', 'script/**', 'scripts/**', 'src/public/**'],
    },
    projects: [
      {
        extends: true,
        resolve: {
          alias: {
            '~/src': path.resolve(rootPath, 'src'),
          },
        },
        test: {
          name: 'unit',
          environment: 'node',
          include: ['tests/unit/**/*.test.ts'],
          setupFiles: [offlineSetup],
          isolate: true,
          fileParallelism: false,
        },
      },
      {
        extends: true,
        resolve: {
          alias: {
            '~/src': path.resolve(rootPath, 'src'),
          },
        },
        test: {
          name: 'integration',
          environment: 'node',
          include: ['tests/integration/**/*.test.ts'],
          setupFiles: [offlineSetup],
          isolate: true,
          fileParallelism: false,
        },
      },
    ],
  },
})

