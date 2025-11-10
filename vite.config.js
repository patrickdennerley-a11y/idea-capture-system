import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'react-window': 'react-window/dist/index.esm.js'
    }
  },
  optimizeDeps: {
    include: ['react-window'],
    esbuildOptions: {
      target: 'esnext'
    }
  },
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
