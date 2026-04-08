import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import os from 'os';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  cacheDir: path.join(os.tmpdir(), 'vite-tiny-traders'),
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    include: ['lightweight-charts', 'fancy-canvas'],
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': 'http://localhost:4100',
      '/socket.io': {
        target: 'http://localhost:4100',
        ws: true,
      },
    },
  },
});
