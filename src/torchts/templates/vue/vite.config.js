import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/generate': 'http://localhost:5005'
    },
    hmr: {
      overlay: true
    },
    host: true
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `@use "vuetify" as *;`
      }
    }
  },
  logLevel: 'info',
  clearScreen: false
})