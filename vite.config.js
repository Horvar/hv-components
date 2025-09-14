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
        huderStatic: resolve(__dirname, 'src/pages/huder-static.html'),
        huderFixed: resolve(__dirname, 'src/pages/huder-fixed.html'),
        huderFixedAfter: resolve(__dirname, 'src/pages/huder-fixed-after.html'),
        huderFixedAfterReveal: resolve(__dirname, 'src/pages/huder-fixed-after-reveal.html'),
        huderFixedAfterShring: resolve(__dirname, 'src/pages/huder-fixed-after-shrink.html'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name][extname]',
      },
    },
  },
});
