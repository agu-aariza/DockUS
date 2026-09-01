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
      ...jsxA11y.configs.recommended.rules,
      // The base rule does not understand TypeScript type-only function signatures.
      // Keep unused-export detection in knip/ts-pruner until the TS ESLint plugin is installed.
      'no-unused-vars': 'off',
      'no-undef': 'off', // TypeScript handles undefined variables natively
      'no-extra-boolean-cast': 'off',
      'no-useless-escape': 'off',
      // React controla los campos mediante onChange; no sustituirlo por onBlur.
      'jsx-a11y/no-onchange': 'off',
    },
  },
  {
    // Las llamadas HTTP deben pasar por las fachadas de frontend/src/shared/api/*;
    // los componentes y hooks React no pueden importar axios directamente. Esta
    // regla evita que la frontera arquitectónica se degrade con nuevos cambios.
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
  {
    // El transporte compartido no puede volver a conocer tipos o APIs de dominio.
    // La guarda equivalente para todo shared/ se ampliará cuando PR4 extraiga
    // los componentes de dominio que aún viven allí.
    files: ['src/shared/api/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '../features/**',
                '../../features/**',
                '../../auth/**',
                '../../users/**',
                '../../projects/**',
                '../../groups/**',
                '../../deliveries/**',
                '../../storage/**',
                '../../builder/**',
                '../../llm/**',
                '../../student/**',
                '../../health/**',
                '../../reporting/**',
              ],
              message:
                'shared/api is transport-only; domain APIs and types must live in their domain folder.',
            },
          ],
        },
      ],
    },
  },
];
