/**
 * Enforcement for the layer boundaries declared in CLAUDE.md / ARCHITECTURE.md.
 * Installed as part of audit/04 (ARQ-009): those boundaries were previously
 * "enforced by convention" only — a paragraph of markdown nobody's compiler
 * checked. This turns the four boundaries the architecture audit could
 * actually verify by grep into a script that fails on drift.
 *
 * Run: npm run boundaries
 *
 * @type {import('dependency-cruiser').IConfiguration}
 */
module.exports = {
  forbidden: [
    {
      name: 'no-shared-to-modules',
      comment:
        'shared/ is a one-way dependency: domain modules depend on it, never the reverse. ' +
        'The only documented exception is the seeding subsystem, which inherently needs the ' +
        'User/Project/ProjectAssignment/Delivery entities to populate demo/admin data ' +
        '(CLAUDE.md, "known standing exception, do not extend").',
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
        'domain/ must stay free of TypeORM/ioredis imports. Entities are the one pragmatic, documented ' +
        'exception (they need TypeORM decorators to exist at all). repositories/ used to be a second, ' +
        'undocumented exception (audit/04 ARQ-007: the two repository interfaces imported ' +
        'SelectQueryBuilder/FindOneOptions directly) — both were rewritten as real ports with zero TypeORM ' +
        'types, so this rule now covers them too; do not let a third repository interface reopen that gap. ' +
        'The module-local-infrastructure/ half of this same boundary is enforced separately by ' +
        'no-domain-infra-module, so it can carry its own narrow exception.',
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
