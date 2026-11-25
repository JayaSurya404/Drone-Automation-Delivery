import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
const proxyConfig = {
  '/api': {
    target: 'http://127.0.0.1:4000',
    changeOrigin: true,
    secure: false,
  },
  '/ws': {
    target: 'ws://127.0.0.1:4000',
    ws: true,
  },
};

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: proxyConfig,
  },
  preview: {
    port: 5173,
    host: true,
    proxy: proxyConfig,
  },
})
