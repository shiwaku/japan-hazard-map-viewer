import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist', 'public', 'node_modules'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        window: 'readonly',
        document: 'readonly',
        fetch: 'readonly',
        console: 'readonly',
        Image: 'readonly',
        performance: 'readonly',
        requestAnimationFrame: 'readonly',
        setTimeout: 'readonly',
        alert: 'readonly',
        HTMLElement: 'readonly',
        HTMLInputElement: 'readonly',
        clearInterval: 'readonly',
        setInterval: 'readonly',
        navigator: 'readonly',
        location: 'readonly',
        localStorage: 'readonly',
        AbortController: 'readonly',
        DOMException: 'readonly',
        URLSearchParams: 'readonly',
        structuredClone: 'readonly',
        caches: 'readonly',
        self: 'readonly',
      },
    },
  },
  {
    // e2e は Node 側で動く（Playwright のテストランナー）
    files: ['e2e/**/*.ts', 'playwright.config.ts'],
    languageOptions: {
      globals: { process: 'readonly', Buffer: 'readonly' },
    },
  },
  prettier,
);
