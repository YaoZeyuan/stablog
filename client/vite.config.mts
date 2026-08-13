import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const configDir = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  root: configDir,
  // Electron production loads index.html through file://, so every generated asset must be relative.
  base: './',
  server: {
    host: '127.0.0.1',
    port: 8000,
    strictPort: true,
    fs: {
      strict: true,
      allow: [path.resolve(configDir, '..')],
    },
  },
  css: {
    preprocessorOptions: {
      less: {
        javascriptEnabled: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(configDir, 'src'),
    },
  },
})
