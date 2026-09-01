// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      // 'error' en código de producción: sí detectan fugas reales de `any`.
      // Se desactivan en *.spec.ts (ver override más abajo) porque ahí el
      // 99% del ruido no es riesgo real sino que `globals.jest` registra
      // jest/describe/it/expect como globals sin tipar para el linter
      // type-aware, y cada jest.fn()/expect(...) se lee como "any".
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-return': 'warn',
      '@typescript-eslint/require-await': 'warn',
      '@typescript-eslint/no-redundant-type-constituents': 'warn',
      '@typescript-eslint/no-base-to-string': 'warn',
      'no-control-regex': 'warn',
      'prettier/prettier': ['error', { endOfLine: 'auto' }],
    },
  },
  {
    files: [
      '**/*.spec.ts',
      '**/*.e2e-spec.ts',
      'test/support/**/*.ts',
    ],
    rules: {
      '@typescript-eslint/unbound-method': 'off',
      // Mismo motivo que arriba: sin tipos de @types/jest resueltos por el
      // linter type-aware, cada llamada a la API de Jest (jest.fn(),
      // expect(...).toHaveBeenCalledWith(...), etc.) dispara estas reglas
      // sin que exista un `any` real que corregir en el test.
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      // Las aserciones de los tests documentan el contrato que se comprueba;
      // al moverlos fuera de `src/`, el type-aware linter las identifica como
      // redundantes aunque sigan siendo útiles para leer la intención del test.
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
    },
  },
  {
    // Las migraciones las genera el CLI de TypeORM: su contenido son cadenas
    // SQL largas y reformatearlas produciría ruido en cada regeneracion sin
    // ganar legibilidad. Se revisan a mano, no se estilan.
    files: ['src/shared/infrastructure/database/migrations/*.ts'],
    rules: {
      'prettier/prettier': 'off',
    },
  },
);
