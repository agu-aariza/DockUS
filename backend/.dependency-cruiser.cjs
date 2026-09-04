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
        'Same intent as no-domain-infra, split out for the /infrastructure/ half specifically. ' +
        'llm.types.ts is exempt for the same reason as in no-presentation-infra: zero imports, zero classes, ' +
        'pure type/const module — "import type" from it erases at compile time and is the only tolerated case. ' +
        'The parser layer must not import infrastructure; shared path helpers are the permitted abstraction. ' +
        'docker.types.ts is exempt for the same reason as llm.types.ts (Fase 1, P1-1): zero imports, zero ' +
        'classes, pure type/const module — builder/domain/ports/container-runtime.port.ts imports ' +
        '`DockerRunOptions` from it as `import type` only.',
      severity: 'error',
      from: {
        path: '/domain/(?!entities/)',
      },
      to: {
        path: '/infrastructure/',
        pathNot:
          '^src/shared/infrastructure/ai/llm\\.types\\.ts$|^src/shared/infrastructure/docker/docker\\.types\\.ts$',
      },
    },
    {
      name: 'no-presentation-infra',
      comment:
        'Controllers must not talk to Docker/MinIO/Redis/Bedrock directly — that orchestration belongs ' +
        'in application/ services. Covers both shared/infrastructure/ and a module\'s own local ' +
        'infrastructure/ so controllers cannot bypass application use cases. Pure constant/type modules ' +
        'with zero side effects (no class, no ' +
        'Injectable, no client) are exempt: importing a shared enum of provider ids to build a DTO ' +
        'validator is not the coupling this rule exists to catch.',
      severity: 'error',
      from: {
        path: '/presentation/',
      },
      to: {
        path: '/infrastructure/',
        pathNot: '^src/shared/infrastructure/ai/llm\\.types\\.ts$',
      },
    },
    {
      name: 'no-cross-module-repository-adapter',
      comment:
        'Un adaptador de repositorio concreto (infrastructure/database/*.repository.ts) solo lo importa ' +
        'un *.module.ts, para su registro `useClass`. El resto del código (application/, domain/, ' +
        'presentation/, otro *.module.ts) consume el puerto — interfaz + token — que exporta el módulo ' +
        'dueño, nunca la clase directamente. dependency-cruiser no soporta backreferences entre ' +
        '`from`/`to`, así que esto no compara "módulo A" contra "módulo B": es más estricto y más simple — ' +
        'ningún fichero que no sea un *.module.ts puede importar una clase adaptadora, ni siquiera la de su ' +
        'propio módulo. Tras P1-1, `grep -rn "provide: [A-Z_]*REPOSITORY" src --include="*.module.ts" | wc -l` ' +
        'da 13 (antes 23): cada puerto se registra una vez, en su módulo dueño o en un ' +
        '`<Entidad>PersistenceModule` hoja cuando dos módulos que ya se importan entre sí lo necesitan (mismo ' +
        'patrón que `DeliveryStatusModule`, `ProjectPersistenceModule`, `ProjectAssignmentPersistenceModule`).',
      severity: 'error',
      from: {
        pathNot: '\\.module\\.ts$',
      },
      to: {
        path: '/infrastructure/database/.*\\.repository\\.ts$',
      },
    },
  ],
  options: {
    tsConfig: {
      fileName: 'tsconfig.json',
    },
    // Without this, dependency-cruiser resolves imports post-type-erasure: a file whose
    // only imports are used in type position (e.g. an interface importing TypeORM types)
    // shows zero dependencies, hiding exactly the type-surface coupling 
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
