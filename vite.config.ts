import path from 'node:path';
import react from '@vitejs/plugin-react-swc';
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/app/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    host: '::',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
  css: {
    transformer: 'lightningcss',
  },
  build: {
    outDir: 'dist/app',
    emptyOutDir: true,
    cssMinify: 'lightningcss',
    rollupOptions: {
      input: {
        main: path.resolve(import.meta.dirname, 'index.html'),
      },
    },
  },
});
