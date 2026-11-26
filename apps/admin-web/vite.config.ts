import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import cesiumPlugin from 'vite-plugin-cesium';

const cesium = (cesiumPlugin as any).default || cesiumPlugin;

// https://vitejs.dev/config/
const proxyConfig = {
  '/api': {
    target: 'http://127.0.0.1:4000',
    changeOrigin: true,
    secure: false,
  },
  '/ws/admin': {
    target: 'ws://127.0.0.1:4000',
    ws: true,
  },
};

export default defineConfig({
  plugins: [react(), cesium()],
  server: {
    port: 5174,
    host: true,
    proxy: proxyConfig,
  },
  preview: {
    port: 5174,
    host: true,
    proxy: proxyConfig,
  },
});
