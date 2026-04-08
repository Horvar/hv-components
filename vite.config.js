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
        { src: 'src/components/hv-header/script.js', destDir: 'components/hv-header', rename: 'script.js' },
        { src: 'src/components/hv-header/style.scss', destDir: 'components/hv-header', rename: 'style.scss' },
        { src: 'src/components/hv-modal/script.js', destDir: 'components/hv-modal', rename: 'script.js' },
        { src: 'src/components/hv-modal/style.scss', destDir: 'components/hv-modal', rename: 'style.scss' },
        {
          src: 'src/components/hv-modal/header-compat.scss',
          destDir: 'components/hv-modal',
          rename: 'header-compat.scss',
        },
        { src: 'src/components/hv-accordion/script.js', destDir: 'components/hv-accordion', rename: 'script.js' },
        { src: 'src/components/hv-form/scripts/file.js', destDir: 'components/hv-form/scripts', rename: 'file.js' },
        { src: 'src/components/hv-form/scripts/masks.js', destDir: 'components/hv-form/scripts', rename: 'masks.js' },
        {
          src: 'src/components/hv-form/scripts/password.js',
          destDir: 'components/hv-form/scripts',
          rename: 'password.js',
        },
        { src: 'src/components/hv-form/style.scss', destDir: 'components/hv-form', rename: 'style.scss' },
        { src: 'src/components/hv-tabs/script.js', destDir: 'components/hv-tabs', rename: 'script.js' },
        { src: 'src/components/hv-tabs/style.scss', destDir: 'components/hv-tabs', rename: 'style.scss' },
        {
          src: 'src/components/hv-datepicker/scripts/datepicker.js',
          destDir: 'components/hv-datepicker/scripts',
          rename: 'datepicker.js',
        },
        {
          src: 'src/components/hv-datepicker/scripts/masks.js',
          destDir: 'components/hv-datepicker/scripts',
          rename: 'masks.js',
        },
        { src: 'src/components/hv-datepicker/style.scss', destDir: 'components/hv-datepicker', rename: 'style.scss' },
        {
          src: 'src/components/hv-scroll-animate/script.js',
          destDir: 'components/hv-scroll-animate',
          rename: 'script.js',
        },
        { src: 'src/components/hv-select/script.js', destDir: 'components/hv-select', rename: 'script.js' },
        { src: 'src/components/hv-select/style.scss', destDir: 'components/hv-select', rename: 'style.scss' },
        { src: 'src/components/hv-select/README.md', destDir: 'components/hv-select', rename: 'README.md' },
      ],
    }),
  ],
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        header: resolve(__dirname, 'src/components/hv-header/index.html'),
        modal: resolve(__dirname, 'src/components/hv-modal/index.html'),
        accordion: resolve(__dirname, 'src/components/hv-accordion/index.html'),
        form: resolve(__dirname, 'src/components/hv-form/index.html'),
        tabs: resolve(__dirname, 'src/components/hv-tabs/index.html'),
        datepicker: resolve(__dirname, 'src/components/hv-datepicker/index.html'),
        scrollAnimate: resolve(__dirname, 'src/components/hv-scroll-animate/index.html'),
        select: resolve(__dirname, 'src/components/hv-select/index.html'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name][extname]',
      },
    },
  },
});
