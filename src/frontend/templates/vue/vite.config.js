import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const backendUrl = process.env.DOCKER_ENV 
  ? 'http://backend:5005'
  : 'http://localhost:5005'

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/generate': backendUrl,
      '/profiles': backendUrl
    },
    hmr: {
      overlay: true
    },
    host: true,
    allowedHosts: [
      'localhost',
      '*.orb.local',
      'frontend.torchts.orb.local'
    ]
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