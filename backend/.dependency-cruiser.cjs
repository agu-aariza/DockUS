/**
 * @fileoverview Reglas de validación y enforzamiento de fronteras arquitectónicas (dependency-cruiser).
 *
 * @description
 * Automatiza la verificación de las fronteras de capas declaradas en la arquitectura.
 * Ejecución: `npm run boundaries`
 *
 * @type {import('dependency-cruiser').IConfiguration}
 */
module.exports = {
  forbidden: [
    {
      name: 'no-shared-to-modules',
      comment:
        'shared/ es una dependencia unidireccional: los módulos de dominio dependen de shared, nunca al revés. ' +
        'La única excepción documentada es el subsistema de seeding para poblar datos iniciales.',
      severity: 'error',
      from: {
        path: '^src/shared',
        pathNot:
          '^src/shared/infrastructure/(seed/(admin|demo)-seed\\.service\\.ts|infrastructure\\.module\\.ts)$',
      },
      to: {
        path: '^src/modules',
      },
    },
    {
      name: 'no-domain-infra',
      comment:
        'domain/ no puede depender de TypeORM o ioredis directamente. Las entidades son la única excepción.',
      severity: 'error',
      from: {
        path: '/domain/(?!entities/)',
      },
      to: {
        path: 'node_modules/(typeorm|ioredis)/',
      },
    },
    {
      name: 'no-domain-infra-module',
      comment:
        'Same intent as no-domain-infra, split out for the /infrastructure/ half specifically so it can ' +
        'carry narrow, named exceptions (see no-domain-plan-parser-infra-util) instead of silently letting ' +
        'the whole file off the hook for TypeORM/ioredis too. llm.types.ts is exempt for the same reason as ' +
        'in no-presentation-infra: zero imports, zero classes, pure type/const module — "import type" from it ' +
        'erases at compile time and is the tolerated case the audit itself carved out for builder.types.ts / ' +
        'builder-config.provider.ts.',
      severity: 'error',
      from: {
        path: '/domain/(?!entities/)',
        pathNot: '/domain/ai/parsers/plan-contract\\.parser\\.ts$',
      },
      to: {
        path: '/infrastructure/',
        pathNot: '^src/shared/infrastructure/ai/llm\\.types\\.ts$',
      },
    },
    {
      name: 'no-domain-plan-parser-infra-util',
      comment:
        'domain/ai/parsers/plan-contract.parser.ts imports toPosixPath from the builder module\'s own ' +
        'infrastructure/utils/ — a documented residual gap from audit/04 ARQ-002 ("No corregido a propósito ' +
        '(fuera de alcance)... corregirlas es territorio de ARQ-010"). Kept at "warn": fixing it means either ' +
        'moving toPosixPath to a dependency-free domain util or accepting the parser is not pure, which is ' +
        'exactly the decision ARQ-010 is scoped to make — not a call to make silently while wiring a linter.',
      severity: 'warn',
      from: {
        path: '/domain/ai/parsers/plan-contract\\.parser\\.ts$',
      },
      to: {
        path: '/infrastructure/',
      },
    },
    {
      name: 'no-presentation-infra',
      comment:
        'Controllers must not talk to Docker/MinIO/Redis/Bedrock directly — that orchestration belongs ' +
        'in application/ services (CLAUDE.md: "NestJS controllers never contain business logic or ' +
        'orchestrate Docker/MinIO/LLM calls directly"). Pure constant/type modules with zero side effects ' +
        '(no class, no Injectable, no client) are exempt: importing a shared enum of provider ids to build ' +
        'a DTO validator is not the coupling this rule exists to catch.',
      severity: 'error',
      from: {
        path: '/presentation/',
      },
      to: {
        path: '^src/shared/infrastructure/',
        pathNot: '^src/shared/infrastructure/ai/llm\\.types\\.ts$',
      },
    },
  ],
  options: {
    tsConfig: {
      fileName: 'tsconfig.json',
    },
    // Without this, dependency-cruiser resolves imports post-type-erasure: a file whose
    // only imports are used in type position (e.g. an interface importing TypeORM types)
    // shows zero dependencies, hiding exactly the type-surface coupling audit/04 ARQ-007
    // is about. Pre-compilation analysis keeps those edges visible.
    tsPreCompilationDeps: true,
    doNotFollow: {
      path: 'node_modules',
    },
    exclude: {
      path: '\\.spec\\.ts$',
    },
  },
};
