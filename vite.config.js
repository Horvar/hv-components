import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: './',
  chunkSizeWarningLimit: 2000,
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },

  build: {
    rollupOptions: {
      input: {
        header: resolve(__dirname, 'src/pages/header.html'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name][extname]',
      },
    },
  },
});
