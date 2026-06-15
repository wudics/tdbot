import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        external: ['@opencode-ai/sdk/v2']
      }
    }
  },
  preload: {},
  renderer: {
    plugins: [react()]
  }
})
