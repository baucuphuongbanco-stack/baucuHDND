import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [],
      workbox: {
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024, // 3MB
      },
      manifest: {
        name: 'Bầu cử Bàn Cờ 2026',
        short_name: 'BC Bàn Cờ',
        description: 'Hệ thống Quản lý Bầu cử Phường Bàn Cờ 2026',
        theme_color: '#ef4444',
        icons: []
      }
    })
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 3000,
    open: true,
  },
});
