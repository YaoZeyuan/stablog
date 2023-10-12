import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  experimental: {
    renderBuiltUrl(filename: string, { hostType }: { hostType: 'js' | 'css' | 'html' }) {
      return `https://www.yaozeyuan.online/stablog/${filename}`
    }
  },
  server: {
    host: 'localhost',
  },
})
