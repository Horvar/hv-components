// vite.config.js
import { defineConfig } from 'vite';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import chokidar from 'chokidar';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Копирует указанные файлы в public/… и смотрит за изменениями в dev.
 * targets: [{ src: 'src/scripts/_hv-header.js', destDir: 'components/hv-header', rename?: '_hv-header.js' }, ...]
 */
function copyToPublicPlugin({ targets }) {
  // нормализуем пути
  const T = targets.map((t) => ({
    src: resolve(__dirname, t.src),
    destDir: resolve(__dirname, 'public', t.destDir),
    rename: t.rename || basename(t.src),
  }));

  const copyOne = async (t) => {
    const destPath = resolve(t.destDir, t.rename);
    await fs.mkdir(t.destDir, { recursive: true });
    await fs.copyFile(t.src, destPath);
  };
  const copyAll = async () => Promise.all(T.map(copyOne));

  return {
    name: 'copy-to-public-hv-header',
    // dev: копируем и включаем watcher
    configureServer(server) {
      copyAll()
        .then(() => server.ws.send({ type: 'full-reload' }))
        .catch(() => {});

      const watcher = chokidar.watch(
        T.map((t) => t.src),
        { ignoreInitial: true }
      );
      const onChange = async () => {
        await copyAll();
        server.ws.send({ type: 'full-reload' });
      };
      watcher.on('add', onChange).on('change', onChange).on('unlink', onChange);
    },
    // build: до сборки складываем файлы в public, чтобы Vite перенёс их в dist как есть
    async buildStart() {
      await copyAll();
    },
  };
}

export default defineConfig({
  base: './',
  chunkSizeWarningLimit: 2000,
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  plugins: [
    copyToPublicPlugin({
      targets: [
        { src: 'src/scripts/_hv-header.js', destDir: 'components/hv-header', rename: '_hv-header.js' },
        { src: 'src/styles/_hv-header.scss', destDir: 'components/hv-header', rename: '_hv-header.scss' },
      ],
    }),
  ],
  build: {
    rollupOptions: {
      input: {
        header: resolve(__dirname, 'src/pages/header.html'),
        modal: resolve(__dirname, 'src/pages/modal.html'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name][extname]',
      },
    },
  },
});
