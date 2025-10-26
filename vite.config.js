// vite.config.js
import { defineConfig } from 'vite';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import chokidar from 'chokidar';

const __dirname = dirname(fileURLToPath(import.meta.url));

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
        { src: 'src/scripts/_hv-modal.js', destDir: 'components/hv-modal', rename: '_hv-modal.js' },
        { src: 'src/styles/_hv-modal.scss', destDir: 'components/hv-modal', rename: '_hv-modal.scss' },
        { src: 'src/scripts/_hv-accordion.js', destDir: 'components/hv-accordion', rename: '_hv-accordion.js' },
        { src: 'src/scripts/_hv-form-file.js', destDir: 'components/hv-form', rename: '_hv-form-file.js' },
        { src: 'src/scripts/_hv-form-masks.js', destDir: 'components/hv-form', rename: '_hv-form-masks.js' },
        { src: 'src/scripts/_hv-form-password.js', destDir: 'components/hv-form', rename: '_hv-form-password.js' },
        { src: 'src/styles/_hv-form.scss', destDir: 'components/hv-form', rename: '_hv-form.scss' },
        { src: 'src/scripts/_hv-tabs.js', destDir: 'components/hv-tabs', rename: '_hv-tabs.js' },
        { src: 'src/styles/_hv-tabs.scss', destDir: 'components/hv-tabs', rename: '_hv-tabs.scss' },
      ],
    }),
  ],
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        header: resolve(__dirname, 'src/pages/header.html'),
        modal: resolve(__dirname, 'src/pages/modal.html'),
        accordion: resolve(__dirname, 'src/pages/accordion.html'),
        form: resolve(__dirname, 'src/pages/form.html'),
        tabs: resolve(__dirname, 'src/pages/tabs.html'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name][extname]',
      },
    },
  },
});
