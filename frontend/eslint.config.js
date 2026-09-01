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
                '../../landing/**',
                '../../runtime/**',
                '../../student-profile/**',
                '../../summary/**',
                '../../test/**',
              ],
              message:
                'shared/api is transport-only; domain APIs and types must live in their domain folder.',
            },
          ],
        },
      ],
    },
  },
  {
    // Ningún módulo transversal puede depender de features ni de un dominio.
    // Las piezas con conocimiento de negocio viven en reporting/ o en su
    // dominio propietario; shared/ solo expone infraestructura agnóstica.
    files: ['src/shared/**/*.{ts,tsx}'],
    ignores: ['src/shared/api/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'axios',
              message:
                'shared is domain-agnostic; HTTP calls must use a domain API facade.',
            },
          ],
          patterns: [
            {
              group: [
                '**/features/**',
                '**/auth/**',
                '**/users/**',
                '**/projects/**',
                '**/groups/**',
                '**/deliveries/**',
                '**/storage/**',
                '**/builder/**',
                '**/llm/**',
                '**/student/**',
                '**/health/**',
                '**/reporting/**',
                '**/landing/**',
                '**/runtime/**',
                '**/student-profile/**',
                '**/summary/**',
                '**/test/**',
                '**/app/**',
              ],
              message:
                'shared is domain-agnostic; domain APIs and types must live in their owning folder.',
            },
          ],
        },
      ],
    },
  },
  {
    // features/ es una capa de tipos puros: no debe convertirse en una segunda
    // implementación de UI, hooks ni clientes HTTP de los dominios.
    files: ['src/features/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'axios',
              message: 'features is type-only; HTTP clients belong to the owning domain API.',
            },
            {
              name: 'react',
              message: 'features is type-only; React components belong to the owning domain.',
            },
            {
              name: 'react-dom',
              message: 'features is type-only; React components belong to the owning domain.',
            },
          ],
          patterns: [
            {
              group: ['react/**', 'react-dom/**'],
              message: 'features is type-only; React components belong to the owning domain.',
            },
            {
              group: ['**/api/**'],
              message: 'features is type-only; HTTP clients belong to the owning domain API.',
            },
            {
              group: ['**/hooks/**'],
              message: 'features is type-only; hooks belong to the owning domain.',
            },
          ],
        },
      ],
    },
  },
];
