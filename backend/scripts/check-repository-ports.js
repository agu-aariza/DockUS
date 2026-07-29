#!/usr/bin/env node
/**
 * Impide nuevas inyecciones directas de Repository<T> para las entidades que
 * ya tienen puerto real, fuera de sus adaptadores (ARQ-017,
 * audit/areas/arquitectura/reports/findings.md y plan_accion.md Fase 2).
 *
 * Trece agregados tienen puerto real hoy: los seis de la Fase 2 principal
 * (`Project`/`Delivery`/`ProjectAssignment`/`BuildRun`/`User`/`StorageObject`,
 * P2-1 a P2-6) más los siete de la "cola larga" (P2-7):
 * `CodeQualityFindingEntity`/`BuildRunArtifact`/`BuildRunChatMessage`/
 * `BuildRunEventEntity`/`LlmConfiguration`/`CourseGroup`/`GroupEnrollment`.
 * Todos cerrados — cero bypasses reales fuera de la deuda documentada:
 * `Project`/`Delivery`/`ProjectAssignment`/`StorageObject` conservan la
 * excepción de `project-operational-issues.service.ts` (más `demo-seed` para
 * los tres primeros), `User` conserva sus dos seeders, el resto (`BuildRun` y
 * los siete de P2-7) ninguna. Este script no falla sobre deuda conocida:
 * falla solo ante un fichero NUEVO que añada el mismo patrón sin pasar por el
 * plan de migración.
 *
 * No usa dependency-cruiser porque esa herramienta razona sobre el grafo de
 * imports (qué fichero importa a qué fichero), no sobre el argumento de un
 * decorador — "importa Project" es legítimo en decenas de sitios (tipado,
 * DTOs); el problema es específicamente `@InjectRepository(Project)`. Un
 * script de contenido es la herramienta correcta para esta pregunta concreta.
 */
const fs = require('fs');
const path = require('path');

const SRC_ROOT = path.join(__dirname, '..', 'src');

const RULES = [
  {
    entity: 'Project',
    pattern: /@InjectRepository\(Project\)/,
    adapter: 'modules/projects/infrastructure/database/project.repository.ts',
    // P2-2 (plan_accion.md) migró los 7 consumidores reales de ARQ-017 a
    // PROJECT_REPOSITORY. Solo queda la excepción de seed, ya documentada
    // (subsistema en shared/, no ARQ-017): ver CLAUDE.md y
    // no-shared-to-modules en .dependency-cruiser.cjs.
    allowed: ['shared/infrastructure/seed/demo-seed.service.ts'],
  },
  {
    entity: 'BuildRun',
    pattern: /@InjectRepository\(BuildRun\)/,
    adapter: 'modules/projects/infrastructure/database/build-run.repository.ts',
    // P2-4 (plan_accion.md) migró los 6 consumidores reales a
    // BUILD_RUN_REPOSITORY. Sin excepciones: ni demo-seed ni el diagnóstico
    // admin tocan BuildRun.
    allowed: [],
  },
  {
    entity: 'Delivery',
    pattern: /@InjectRepository\(Delivery\)/,
    adapter: 'modules/projects/infrastructure/database/delivery.repository.ts',
    // P2-1 (plan_accion.md) ya migró los 12 consumidores reales a
    // DELIVERY_REPOSITORY. Solo quedan dos excepciones documentadas, no deuda:
    allowed: [
      // Subsistema de seed: vive en shared/ e importa entidades de dominio
      // directo (excepción ya documentada en CLAUDE.md); el puerto vive en
      // modules/, así que inyectarlo violaría no-shared-to-modules.
      'shared/infrastructure/seed/demo-seed.service.ts',
      // Herramienta de diagnóstico/reconciliación admin (huérfanos, tardías,
      // sin calificar): usa createQueryBuilder con nombres de tabla SQL
      // crudos (leftJoin a 'project_assignments'/'projects'/'users') para
      // detectar filas inconsistentes fuera del grafo de relaciones de
      // TypeORM — no son formas de consulta del dominio, envolverlas en el
      // puerto solo para este único consumidor lo infla sin reutilización
      // real (mismo criterio que excluyó IEventBus en la Fase 1 P1-4).
      'modules/projects/project-operational-issues.service.ts',
    ],
  },
  {
    entity: 'ProjectAssignment',
    pattern: /@InjectRepository\(ProjectAssignment\)/,
    adapter:
      'modules/projects/infrastructure/database/project-assignment.repository.ts',
    // P2-3 (plan_accion.md) migró los 6 consumidores reales a
    // PROJECT_ASSIGNMENT_REPOSITORY. Mismas dos excepciones documentadas que
    // Delivery/Project, mismo motivo cada una:
    allowed: [
      'shared/infrastructure/seed/demo-seed.service.ts',
      'modules/projects/project-operational-issues.service.ts',
    ],
  },
  {
    entity: 'User',
    pattern: /@InjectRepository\(User\)/,
    adapter: 'modules/users/infrastructure/database/user.repository.ts',
    // P2-5 (plan_accion.md) migró los 4 consumidores reales a
    // USER_REPOSITORY. A diferencia de Project/Delivery/ProjectAssignment,
    // aquí hay dos seeders en shared/ (no solo uno): admin-seed.service.ts
    // (arranque, crea el primer admin) y demo-seed.service.ts (datos de
    // demo) — ambos viven en shared/ e importan la entidad de dominio
    // directo, y el puerto vive en modules/users/, así que inyectarlo
    // violaría no-shared-to-modules (mismo motivo documentado en CLAUDE.md
    // para el resto de entidades).
    allowed: [
      'shared/infrastructure/seed/admin-seed.service.ts',
      'shared/infrastructure/seed/demo-seed.service.ts',
    ],
  },
  {
    entity: 'StorageObject',
    pattern: /@InjectRepository\(StorageObject\)/,
    adapter:
      'modules/projects/infrastructure/database/storage-object.repository.ts',
    // P2-6 (plan_accion.md) migró los 5 consumidores reales a
    // STORAGE_OBJECT_REPOSITORY. Única excepción: la misma herramienta de
    // diagnóstico admin de siempre (createQueryBuilder con nombres de tabla
    // SQL crudos, fuera del grafo de relaciones de TypeORM) — no el seeder
    // de demo, que no toca StorageObject.
    allowed: ['modules/projects/project-operational-issues.service.ts'],
  },
  {
    entity: 'CodeQualityFindingEntity',
    pattern: /@InjectRepository\(CodeQualityFindingEntity\)/,
    adapter:
      'modules/projects/infrastructure/database/code-quality-finding.repository.ts',
    // P2-7 (plan_accion.md) migró los 2 consumidores reales a
    // CODE_QUALITY_FINDING_REPOSITORY. Sin excepciones.
    allowed: [],
  },
  {
    entity: 'BuildRunArtifact',
    pattern: /@InjectRepository\(BuildRunArtifact\)/,
    adapter:
      'modules/projects/infrastructure/database/build-run-artifact.repository.ts',
    // P2-7 migró los 2 consumidores reales a BUILD_RUN_ARTIFACT_REPOSITORY.
    // Sin excepciones.
    allowed: [],
  },
  {
    entity: 'BuildRunChatMessage',
    pattern: /@InjectRepository\(BuildRunChatMessage\)/,
    adapter:
      'modules/projects/infrastructure/database/build-run-chat-message.repository.ts',
    // P2-7 migró el único consumidor real a
    // BUILD_RUN_CHAT_MESSAGE_REPOSITORY. Sin excepciones.
    allowed: [],
  },
  {
    entity: 'BuildRunEventEntity',
    pattern: /@InjectRepository\(BuildRunEventEntity\)/,
    adapter:
      'modules/projects/infrastructure/database/build-run-event.repository.ts',
    // P2-7 migró el único consumidor real (BuilderRunEventsService, vive en
    // infrastructure/events/ pero es agregado de dominio, mismo criterio que
    // BuildRun en P2-4) a BUILD_RUN_EVENT_REPOSITORY. Sin excepciones.
    allowed: [],
  },
  {
    entity: 'LlmConfiguration',
    pattern: /@InjectRepository\(LlmConfiguration\)/,
    adapter:
      'modules/projects/infrastructure/database/llm-configuration.repository.ts',
    // P2-7 migró el único consumidor real a LLM_CONFIGURATION_REPOSITORY.
    // Sin excepciones.
    allowed: [],
  },
  {
    entity: 'CourseGroup',
    pattern: /@InjectRepository\(CourseGroup\)/,
    adapter: 'modules/academic/infrastructure/database/course-group.repository.ts',
    // P2-7 migró el único consumidor real (GroupsService) a
    // COURSE_GROUP_REPOSITORY. Sin excepciones.
    allowed: [],
  },
  {
    entity: 'GroupEnrollment',
    pattern: /@InjectRepository\(GroupEnrollment\)/,
    adapter:
      'modules/academic/infrastructure/database/group-enrollment.repository.ts',
    // P2-7 migró el único consumidor real (GroupsService) a
    // GROUP_ENROLLMENT_REPOSITORY. Sin excepciones.
    allowed: [],
  },
];

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, files);
    } else if (
      entry.isFile() &&
      entry.name.endsWith('.ts') &&
      !entry.name.endsWith('.spec.ts')
    ) {
      files.push(full);
    }
  }
  return files;
}

const allFiles = walk(SRC_ROOT);
const violations = [];

for (const rule of RULES) {
  const allowedAbs = new Set(
    [rule.adapter, ...rule.allowed].map((relPath) => path.join(SRC_ROOT, relPath)),
  );
  for (const file of allFiles) {
    if (allowedAbs.has(file)) continue;
    const content = fs.readFileSync(file, 'utf8');
    if (rule.pattern.test(content)) {
      violations.push({ entity: rule.entity, file: path.relative(SRC_ROOT, file) });
    }
  }
}

if (violations.length > 0) {
  console.error('check-repository-ports: bypass de puerto detectado (ARQ-017) en ficheros no permitidos:\n');
  for (const v of violations) {
    console.error(`  [${v.entity}] ${v.file}`);
  }
  console.error(
    '\nUsa el puerto existente (PROJECT_REPOSITORY / DELIVERY_REPOSITORY / ' +
      'PROJECT_ASSIGNMENT_REPOSITORY / BUILD_RUN_REPOSITORY / USER_REPOSITORY / ' +
      'STORAGE_OBJECT_REPOSITORY / CODE_QUALITY_FINDING_REPOSITORY / ' +
      'BUILD_RUN_ARTIFACT_REPOSITORY / BUILD_RUN_CHAT_MESSAGE_REPOSITORY / ' +
      'BUILD_RUN_EVENT_REPOSITORY / LLM_CONFIGURATION_REPOSITORY / ' +
      'COURSE_GROUP_REPOSITORY / GROUP_ENROLLMENT_REPOSITORY, ver ' +
      'domain/repositories/*.repository.interface.ts) en vez de @InjectRepository directo. ' +
      'Si el fichero ya está cubierto por el plan de migración (Fase 2 de ' +
      'audit/areas/arquitectura/plan_accion.md), añádelo a `allowed` en este script con su ID.',
  );
  process.exit(1);
}

console.log(
  'check-repository-ports: OK (sin bypasses nuevos fuera de la deuda conocida).',
);
process.exit(0);
