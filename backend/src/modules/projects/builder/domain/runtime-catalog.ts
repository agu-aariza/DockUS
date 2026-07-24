/**
 * @fileoverview Catálogo de runtimes soportados por el builder — fuente única
 * de verdad (audit/04 ARQ-010).
 *
 * Contexto:
 * - Antes de esta consolidación, cada consumidor (parser de planes, prompt
 *   composer, compilador de recetas, `BuilderRuntimeFamily`) mantenía su
 *   propia copia de versiones permitidas, imagen por defecto o el flag
 *   "ejecutable" — el catálogo ya existía pero no era la única fuente. Alta
 *   de un lenguaje nuevo = una entrada aquí, no seis ficheros.
 * - `BuilderRuntimeFamily` se deriva de las claves de `RUNTIME_CATALOG` (más
 *   el centinela `'unknown'`, que nunca es una entrada real del catálogo —
 *   significa "el LLM no supo identificar el runtime"). `builder.types.ts`
 *   reexporta el tipo desde aquí en vez de mantenerlo por separado.
 * - Vive en `domain/`, no en `application/services/compilation/` (su
 *   ubicación original): es dato puro sin efectos. La mudanza también
 *   resuelve un import cruzado documentado como pendiente en el registro de
 *   ARQ-002: `builder-prompt-composer.ts` importaba `runtimeCatalogToText`
 *   desde `application/`, domain→application, la dirección prohibida.
 * - Las referencias a `BuilderPlanContractV2` son `import type`: erasable en
 *   tiempo de compilación, así que el ciclo con `builder.types.ts` (que a su
 *   vez reexporta `BuilderRuntimeFamily` desde aquí) no existe en runtime,
 *   solo en el grafo de tipos — TypeScript lo resuelve sin problema.
 *
 * @module RuntimeCatalog
 */

import type { BuilderPlanContractV2 } from './builder.types';

export interface RuntimeCatalogEntry {
  executable: boolean;
  defaultImage: string;
  allowedVersions: readonly string[];
  /** Versión usada cuando el LLM propone una fuera de `allowedVersions`. */
  defaultVersion: string;
  /**
   * Alias de versión (p.ej. `gcc-13` → `c17`) que se normalizan antes de
   * validar contra `allowedVersions`. La mayoría de familias no los tiene.
   */
  versionAliases: Record<string, string>;
  /**
   * Comandos de `install` cuya ejecución necesita red y un FS escribible, por
   * lo que se materializan en la imagen de entorno en vez de en el
   * contenedor de ejecución (ver `builder-recipe-compiler.service.ts`).
   */
  dependencyManagers: readonly string[];
  defaultInstall: readonly (readonly string[])[];
  /** Nota para el prompt del planner: qué runner usar, convenciones, etc. */
  notes: string;
  /**
   * Tokens de texto libre (ya en minúsculas, sin separadores) que identifican
   * esta familia dentro de `expectedType` — un campo de texto libre que
   * escribe el docente al configurar el proyecto (ver
   * `selectFewShotExample`/ARQ-010 resto). Coincidencia por token exacto, no
   * por substring: evita falsos positivos como que "CLI" (de "PYTHON_CLI")
   * dispare la familia `c` solo por contener la letra "c".
   */
  freeTextAliases: readonly string[];
  /**
   * Tokens que, si aparecen en `expectedType`, indican un patrón de servicio
   * (framework request/response) en vez de un script CLI. Solo lo declaran
   * las familias cuyo `fewShotExamples.service` existe.
   */
  serviceFrameworkTokens?: readonly string[];
  /** Ejemplos few-shot para el prompt del planner (`selectFewShotExample`). */
  fewShotExamples?: {
    cli: string;
    service?: string;
  };
}

export const RUNTIME_CATALOG = {
  python: {
    executable: true,
    defaultImage: 'python:3.11-slim',
    allowedVersions: ['3.8', '3.9', '3.10', '3.11', '3.12'],
    defaultVersion: '3.11',
    versionAliases: {},
    dependencyManagers: ['pip', 'pip3', 'poetry'],
    defaultInstall: [['pip', 'install', '-r', 'requirements.txt']],
    notes:
      'Para servicios, usar uvicorn/gunicorn/flask. Para CLI, usar python o python3.',
    freeTextAliases: ['python', 'py'],
    serviceFrameworkTokens: [
      'fastapi',
      'flask',
      'django',
      'service',
      'api',
      'asgi',
      'wsgi',
    ],
    fewShotExamples: {
      cli: `Python CLI example:\n{\n  "recipe": {\n    "install": [["pip", "install", "-r", "requirements.txt"]],\n    "run": ["python", "main.py"],\n    "test": [],\n    "systemPackages": [],\n    "service": null\n  },\n  "runtime": { "family": "python", "version": "3.11" }\n}`,
      service: `Python service example:\n{\n  "recipe": {\n    "install": [["pip", "install", "-r", "requirements.txt"]],\n    "run": ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"],\n    "test": [],\n    "systemPackages": [],\n    "service": { "port": 8000, "healthcheck": ["curl", "-f", "http://localhost:8000/health"] }\n  },\n  "runtime": { "family": "python", "version": "3.11" }\n}`,
    },
  },
  c: {
    executable: true,
    defaultImage: 'gcc:13-bookworm',
    allowedVersions: ['c99', 'c11', 'c17'],
    defaultVersion: 'c11',
    versionAliases: {
      'gcc-11': 'c11',
      'gcc-13': 'c17',
      'gcc-14': 'c17',
      gnu11: 'c11',
      gnu17: 'c17',
      gnu99: 'c99',
      'std=c11': 'c11',
      'std=c99': 'c99',
      'std=c17': 'c17',
    },
    dependencyManagers: [],
    defaultInstall: [
      ['gcc', '-Wall', '-Wextra', '-std=c11', 'main.c', '-o', 'main'],
    ],
    notes: 'Con Makefile usar make; sin Makefile compilar main.c u otros .c.',
    freeTextAliases: ['c', 'gcc', 'clang'],
    // Sin variante `service`: C no tiene un ejemplo few-shot de servicio en
    // esta iteración. Declarado explícito en `undefined` (igual que en
    // `node`) para que las tres entradas compartan forma.
    serviceFrameworkTokens: undefined,
    fewShotExamples: {
      cli: `C CLI example with Makefile:\n{\n  "recipe": {\n    "install": [["make"]],\n    "run": ["./main"],\n    "test": [],\n    "systemPackages": ["build-essential"],\n    "service": null\n  },\n  "runtime": { "family": "c", "version": "c11" }\n}\n\nC CLI example without Makefile:\n{\n  "recipe": {\n    "install": [["gcc", "-Wall", "-Wextra", "-std=c11", "main.c", "-o", "main"]],\n    "run": ["./main"],\n    "test": [],\n    "systemPackages": ["build-essential"],\n    "service": null\n  },\n  "runtime": { "family": "c", "version": "c11" }\n}`,
      service: undefined,
    },
  },
  node: {
    executable: false,
    defaultImage: 'node:22-alpine',
    allowedVersions: ['16', '18', '20', '21', '22'],
    defaultVersion: '20',
    versionAliases: {},
    dependencyManagers: ['npm', 'yarn', 'pnpm'],
    defaultInstall: [['npm', 'install']],
    notes:
      'Node se detecta pero NO es ejecutable como runtime principal en esta iteración.',
    freeTextAliases: ['node', 'nodejs', 'javascript', 'js', 'typescript', 'ts'],
    // Node no es ejecutable, no hay recipe válida que ejemplificar (ver
    // `notes`) — declarados explícitos en `undefined` (en vez de omitidos)
    // para que las tres entradas del catálogo compartan la misma forma y el
    // acceso uniforme vía `RUNTIME_CATALOG[family]` siga tipando sin cast.
    serviceFrameworkTokens: undefined,
    fewShotExamples: undefined,
  },
} as const satisfies Record<string, RuntimeCatalogEntry>;

export type SupportedRuntimeFamily = keyof typeof RUNTIME_CATALOG;

/** Alta de familia nueva = añadirla aquí y a una entrada en RUNTIME_CATALOG. */
export const BUILDER_RUNTIME_FAMILIES = [
  ...(Object.keys(RUNTIME_CATALOG) as SupportedRuntimeFamily[]),
  'unknown',
] as const;

export type BuilderRuntimeFamily = (typeof BUILDER_RUNTIME_FAMILIES)[number];

export function isSupportedRuntimeFamily(
  family: BuilderRuntimeFamily,
): family is SupportedRuntimeFamily {
  return Object.hasOwn(RUNTIME_CATALOG, family);
}

function tokenizeFreeText(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean),
  );
}

/**
 * Adivina la familia de runtime a partir de `expectedType`, un campo de
 * texto libre configurado por el docente (p.ej. "PYTHON_FASTAPI", "CLI
 * Python", "C_CLI") — no un enum, no hay garantía de formato. Compara por
 * token exacto contra `freeTextAliases` del catálogo, nunca por substring.
 */
export function matchRuntimeFamilyFromFreeText(
  text: string,
): SupportedRuntimeFamily | null {
  const tokens = tokenizeFreeText(text);
  for (const family of Object.keys(
    RUNTIME_CATALOG,
  ) as SupportedRuntimeFamily[]) {
    if (RUNTIME_CATALOG[family].freeTextAliases.some((a) => tokens.has(a))) {
      return family;
    }
  }
  return null;
}

/**
 * Selecciona el ejemplo few-shot del prompt de plan a partir de
 * `expectedType` (audit/04 ARQ-010 resto). Antes de esta consolidación vivía
 * en `builder-prompt-composer.ts` con sus propios `.includes('c')` — un
 * substring que disparaba la familia `c` con cualquier `expectedType` que
 * contuviera la letra "c" en cualquier parte (p.ej. "PYTHON_CLI"). El
 * catálogo tokeniza en su lugar, así que "PYTHON_CLI" solo coincide con el
 * token `cli`, que no es alias de ninguna familia.
 *
 * Los tokens de framework de servicio (`serviceFrameworkTokens`) se
 * comprueban antes que la familia detectada: un `expectedType` como
 * "Flask API" debe resolver al ejemplo de servicio de Python aunque no
 * mencione "python" en absoluto — mismo orden de precedencia que tenía la
 * implementación original.
 */
export function selectFewShotExample(expectedType: string | null): string {
  const tokens = tokenizeFreeText(expectedType ?? '');

  for (const family of Object.keys(
    RUNTIME_CATALOG,
  ) as SupportedRuntimeFamily[]) {
    const entry = RUNTIME_CATALOG[family];
    if (
      entry.fewShotExamples?.service &&
      entry.serviceFrameworkTokens?.some((t) => tokens.has(t))
    ) {
      return entry.fewShotExamples.service;
    }
  }

  const family = matchRuntimeFamilyFromFreeText(expectedType ?? '') ?? 'python';
  return (
    RUNTIME_CATALOG[family].fewShotExamples?.cli ??
    RUNTIME_CATALOG.python.fewShotExamples.cli
  );
}

export function runtimeCatalogToText(): string {
  return Object.entries(RUNTIME_CATALOG)
    .map(
      ([family, rt]) =>
        `- ${family}: ejecutable=${rt.executable}, imagen=${rt.defaultImage}, versiones=${rt.allowedVersions.join(', ')}, notas=${rt.notes}`,
    )
    .join('\n');
}

/**
 * Normaliza la versión que devolvió el LLM contra el catálogo: resuelve
 * alias conocidos y cae al valor por defecto de la familia si, tras el
 * alias, sigue sin ser una versión soportada. Familias no presentes en el
 * catálogo (`unknown`, o cualquier valor futuro no dado de alta) no se
 * validan — se devuelven tal cual.
 */
export function normalizeRuntimeVersion(
  family: BuilderRuntimeFamily,
  version: string,
): string {
  if (!isSupportedRuntimeFamily(family)) {
    return version;
  }

  const entry = RUNTIME_CATALOG[family];
  const aliased = entry.versionAliases[version.toLowerCase()];
  if (aliased) {
    return aliased;
  }
  if (!(entry.allowedVersions as readonly string[]).includes(version)) {
    return entry.defaultVersion;
  }
  return version;
}

interface BuilderRuntimeExecutionRecipe {
  executable: boolean;
  unsupportedReason: string | null;
  runtimeFamily: BuilderRuntimeFamily;
  install: string[][];
  run: string[] | null;
  test: string[][];
  healthcheck: string[] | null;
  servicePort: number | null;
  systemPackages: string[];
  runtimeVersion: string | null;
  workingDirectory: string | null;
  environment: Record<string, string> | null;
}

export function adaptPlanToRuntimeRecipe(
  plan: BuilderPlanContractV2,
): BuilderRuntimeExecutionRecipe {
  const executable =
    plan.runtime.supported &&
    isSupportedRuntimeFamily(plan.runtime.family) &&
    RUNTIME_CATALOG[plan.runtime.family].executable;
  const unsupportedReason = executable
    ? null
    : (plan.runtime.reason ??
      'Solo Python y C son ejecutables en esta iteración.');

  return {
    executable: executable && plan.recipe.run !== null,
    unsupportedReason:
      executable && plan.recipe.run !== null
        ? null
        : (unsupportedReason ??
          'El plan no incluye un comando run ejecutable.'),
    runtimeFamily: plan.runtime.family,
    install: plan.recipe.install,
    run: executable ? plan.recipe.run : null,
    test: plan.recipe.test,
    healthcheck: plan.recipe.service?.healthcheck ?? null,
    servicePort: plan.recipe.service?.port ?? null,
    systemPackages: plan.recipe.systemPackages,
    runtimeVersion: executable ? plan.runtime.version : null,
    workingDirectory: plan.recipe.cwd,
    environment: plan.recipe.environment,
  };
}
