#!/usr/bin/env node
/**
 * Impide que el código de aplicación inyecte repositorios TypeORM directamente
 * cuando ya existe un puerto de dominio para esa entidad.
 *
 * El script recorre solo código de producción y permite las excepciones
 * estructurales que no pueden usar el puerto: los seeders de `shared/` y la
 * herramienta administrativa de reconciliación, que consulta varias tablas
 * sin pertenecer a un único agregado. Los adaptadores y los módulos que los
 * registran también quedan fuera del chequeo.
 *
 * Se analiza el contenido del decorador `@InjectRepository` porque
 * dependency-cruiser solo conoce relaciones de importación y no puede expresar
 * esta regla sobre el argumento de un decorador.
 */
const fs = require('fs');
const path = require('path');

const SRC_ROOT = path.join(__dirname, '..', 'src');

const RULES = [
  {
    entity: 'Project',
    pattern: /@InjectRepository\(Project\)/,
    adapter: 'modules/projects/infrastructure/database/project.repository.ts',
    // Los consumidores normales usan PROJECT_REPOSITORY. El seeder vive en
    // shared/ y no puede importar el puerto de modules/ sin romper la frontera
    // no-shared-to-modules.
    allowed: ['shared/infrastructure/seed/demo-seed.service.ts'],
  },
  {
    entity: 'BuildRun',
    pattern: /@InjectRepository\(BuildRun\)/,
    adapter: 'modules/projects/builder/infrastructure/database/build-run.repository.ts',
    // Los consumidores normales usan BUILD_RUN_REPOSITORY; no hay excepciones.
    allowed: [],
  },
  {
    entity: 'Delivery',
    pattern: /@InjectRepository\(Delivery\)/,
    adapter: 'modules/projects/infrastructure/database/delivery.repository.ts',
    // Los consumidores normales usan DELIVERY_REPOSITORY. Solo quedan dos
    // excepciones estructurales:
    allowed: [
      // Subsistema de seed: vive en shared/ e importa entidades de dominio
      // directo; el puerto vive en
      // modules/, así que inyectarlo violaría no-shared-to-modules.
      'shared/infrastructure/seed/demo-seed.service.ts',
      // Herramienta de diagnóstico/reconciliación admin (huérfanos, tardías,
      // sin calificar): usa createQueryBuilder con nombres de tabla SQL
      // crudos (leftJoin a 'project_assignments'/'projects'/'users') para
      // detectar filas inconsistentes fuera del grafo de relaciones de
      // TypeORM — no son formas de consulta del dominio, envolverlas en el
      // puerto solo para este único consumidor lo infla sin reutilización
      // real.
      'modules/projects/project-operational-issues.service.ts',
    ],
  },
  {
    entity: 'ProjectAssignment',
    pattern: /@InjectRepository\(ProjectAssignment\)/,
    adapter:
      'modules/projects/infrastructure/database/project-assignment.repository.ts',
    // Los consumidores normales usan PROJECT_ASSIGNMENT_REPOSITORY. Mantiene
    // las mismas dos excepciones estructurales que Delivery y Project:
    allowed: [
      'shared/infrastructure/seed/demo-seed.service.ts',
      'modules/projects/project-operational-issues.service.ts',
    ],
  },
  {
    entity: 'User',
    pattern: /@InjectRepository\(User\)/,
    adapter: 'modules/users/infrastructure/database/user.repository.ts',
    // Los consumidores normales usan USER_REPOSITORY. Aquí hay dos seeders en
    // shared/ (admin-seed.service.ts y demo-seed.service.ts)
    // (arranque, crea el primer admin) y demo-seed.service.ts (datos de
    // demo) — ambos viven en shared/ e importan la entidad de dominio
    // directo, y el puerto vive en modules/users/, así que inyectarlo
    // violaría no-shared-to-modules, como ocurre con el resto de entidades.
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
    // Los consumidores normales usan STORAGE_OBJECT_REPOSITORY. La única
    // excepción es la herramienta de
    // diagnóstico admin de siempre (createQueryBuilder con nombres de tabla
    // SQL crudos, fuera del grafo de relaciones de TypeORM) — no el seeder
    // de demo, que no toca StorageObject.
    allowed: ['modules/projects/project-operational-issues.service.ts'],
  },
  {
    entity: 'CodeQualityFindingEntity',
    pattern: /@InjectRepository\(CodeQualityFindingEntity\)/,
    adapter:
      'modules/projects/builder/infrastructure/database/code-quality-finding.repository.ts',
    // Los consumidores usan CODE_QUALITY_FINDING_REPOSITORY. Sin excepciones.
    allowed: [],
  },
  {
    entity: 'BuildRunArtifact',
    pattern: /@InjectRepository\(BuildRunArtifact\)/,
    adapter:
      'modules/projects/builder/infrastructure/database/build-run-artifact.repository.ts',
    // Los consumidores usan BUILD_RUN_ARTIFACT_REPOSITORY. Sin excepciones.
    allowed: [],
  },
  {
    entity: 'BuildRunChatMessage',
    pattern: /@InjectRepository\(BuildRunChatMessage\)/,
    adapter:
      'modules/projects/builder/infrastructure/database/build-run-chat-message.repository.ts',
    // El único consumidor usa BUILD_RUN_CHAT_MESSAGE_REPOSITORY. Sin
    // excepciones.
    allowed: [],
  },
  {
    entity: 'BuildRunEventEntity',
    pattern: /@InjectRepository\(BuildRunEventEntity\)/,
    adapter:
      'modules/projects/builder/infrastructure/database/build-run-event.repository.ts',
    // BuilderRunEventsService usa BUILD_RUN_EVENT_REPOSITORY. Sin excepciones.
    allowed: [],
  },
  {
    entity: 'LlmConfiguration',
    pattern: /@InjectRepository\(LlmConfiguration\)/,
    adapter:
      'modules/projects/builder/infrastructure/database/llm-configuration.repository.ts',
    // El único consumidor usa LLM_CONFIGURATION_REPOSITORY. Sin excepciones.
    allowed: [],
  },
  {
    entity: 'CourseGroup',
    pattern: /@InjectRepository\(CourseGroup\)/,
    adapter: 'modules/academic/infrastructure/database/course-group.repository.ts',
    // GroupsService usa COURSE_GROUP_REPOSITORY. Sin excepciones.
    allowed: [],
  },
  {
    entity: 'GroupEnrollment',
    pattern: /@InjectRepository\(GroupEnrollment\)/,
    adapter:
      'modules/academic/infrastructure/database/group-enrollment.repository.ts',
    // GroupsService usa GROUP_ENROLLMENT_REPOSITORY. Sin excepciones.
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
  console.error('check-repository-ports: bypass de puerto detectado en ficheros no permitidos:\n');
  for (const v of violations) {
    console.error(`  [${v.entity}] ${v.file}`);
  }
  console.error(
    '\nUsa el puerto existente (PROJECT_REPOSITORY / DELIVERY_REPOSITORY / ' +
      'PROJECT_ASSIGNMENT_REPOSITORY / BUILD_RUN_REPOSITORY / USER_REPOSITORY / ' +
      'STORAGE_OBJECT_REPOSITORY / CODE_QUALITY_FINDING_REPOSITORY / ' +
      'BUILD_RUN_ARTIFACT_REPOSITORY / BUILD_RUN_CHAT_MESSAGE_REPOSITORY / ' +
      'BUILD_RUN_EVENT_REPOSITORY / LLM_CONFIGURATION_REPOSITORY / ' +
      'COURSE_GROUP_REPOSITORY / GROUP_ENROLLMENT_REPOSITORY; consulta ' +
      'domain/repositories/*.repository.interface.ts) en vez de @InjectRepository directo. ' +
      'Si el fichero es una excepción estructural, añádelo a `allowed` en este script.',
  );
  process.exit(1);
}

console.log(
  'check-repository-ports: OK (todos los consumidores respetan los puertos).',
);
process.exit(0);
