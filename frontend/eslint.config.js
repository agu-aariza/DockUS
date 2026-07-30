import eslint from '@eslint/js';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import tsParser from '@typescript-eslint/parser';
import globals from 'globals';
import queryPlugin from '@tanstack/eslint-plugin-query';

export default [
  {
    ignores: ['.tmp-test-dist', 'dist', 'node_modules', 'eslint.config.js'],
  },
  eslint.configs.recommended,
  ...queryPlugin.configs['flat/recommended'],
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: {
        ...globals.browser,
        ...globals.es2022,
        React: 'readonly',
        JSX: 'readonly',
      },
    },
    plugins: {
      'jsx-a11y': jsxA11y,
    },
    rules: {
      ...jsxA11y.flatConfigs.recommended.rules,
      // The base rule does not understand TypeScript type-only function signatures.
      // Keep unused-export detection in knip/ts-pruner until the TS ESLint plugin is installed.
      'no-unused-vars': 'off',
      'no-undef': 'off', // TypeScript handles undefined variables natively
      'no-extra-boolean-cast': 'off',
      'no-useless-escape': 'off',
    },
  },
  {
    // CLAUDE.md: "all HTTP calls must be encapsulated in frontend/src/shared/api/* facades —
    // React components/hooks must never import axios directly." Installed as part of audit/04
    // (ARQ-009): the architecture audit verified this boundary held by grep, but nothing kept
    // it from drifting since — this makes it a lint error instead of a re-grep next audit.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/shared/api/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'axios',
              message:
                'HTTP calls must go through a frontend/src/shared/api/*Api.ts facade, not axios directly.',
            },
          ],
        },
      ],
    },
  },
];
