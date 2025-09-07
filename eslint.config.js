// eslint.config.js
import { defineConfig } from 'eslint/config';
import js from '@eslint/js';
import globals from 'globals';
import eslintPluginPrettier from 'eslint-plugin-prettier';
import eslintConfigPrettier from 'eslint-config-prettier/flat';

export default defineConfig([
  // 1) Базовый recommended-конфиг из @eslint/js
  js.configs.recommended,

  // 2) Общие настройки для всех файлов
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx,vue}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2021,
      },
    },
    plugins: {
      // плагин prettier интегрирует форматирование в ESLint
      prettier: eslintPluginPrettier,
    },
    rules: {
      // заставляет ESLint ругаться, если предварительно не отформатировали
      'prettier/prettier': ['error', {}, { usePrettierrc: true }],
      'no-undef': 'off',
    },
  },

  // 3) Отключаем все правила, конфликтующие с Prettier
  eslintConfigPrettier,
]);
