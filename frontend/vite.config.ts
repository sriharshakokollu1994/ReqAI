import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@':           path.resolve(__dirname, './src'),
      '@app':        path.resolve(__dirname, './src/app'),
      '@features':   path.resolve(__dirname, './src/features'),
      '@pages':      path.resolve(__dirname, './src/pages'),
      '@components': path.resolve(__dirname, './src/components'),
      '@services':   path.resolve(__dirname, './src/services'),
      '@hooks':      path.resolve(__dirname, './src/hooks'),
      '@types':      path.resolve(__dirname, './src/types'),
      '@utils':      path.resolve(__dirname, './src/utils'),
      '@config':     path.resolve(__dirname, './src/config'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target:       'http://localhost:3000',
        changeOrigin: true,
        secure:       false,
      },
    },
  },
  build: {
    outDir:        'dist',
    sourcemap:     true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor:      ['react', 'react-dom', 'react-router-dom'],
          mui:         ['@mui/material', '@mui/icons-material'],
          redux:       ['@reduxjs/toolkit', 'react-redux'],
        },
      },
    },
  },
});
