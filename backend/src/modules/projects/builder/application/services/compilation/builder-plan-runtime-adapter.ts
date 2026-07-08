import {
  BuilderPlanContractV2,
  BuilderRuntimeFamily,
} from '../../../domain/builder.types';

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

const EXECUTABLE_FAMILIES: ReadonlySet<BuilderRuntimeFamily> = new Set([
  'python',
  'c',
]);

export const RUNTIME_CATALOG = {
  python: {
    family: 'python',
    executable: true,
    defaultImage: 'python:3.11-slim',
    allowedVersions: ['3.8', '3.9', '3.10', '3.11', '3.12'],
    defaultInstall: [['pip', 'install', '-r', 'requirements.txt']],
    notes:
      'Para servicios, usar uvicorn/gunicorn/flask. Para CLI, usar python o python3.',
  },
  c: {
    family: 'c',
    executable: true,
    defaultImage: 'gcc:13-bookworm',
    allowedVersions: ['c99', 'c11', 'c17'],
    defaultInstall: [
      ['gcc', '-Wall', '-Wextra', '-std=c11', 'main.c', '-o', 'main'],
    ],
    notes: 'Con Makefile usar make; sin Makefile compilar main.c u otros .c.',
  },
  node: {
    family: 'node',
    executable: false,
    defaultImage: 'node:22-alpine',
    allowedVersions: ['16', '18', '20', '21', '22'],
    defaultInstall: [['npm', 'install']],
    notes:
      'Node se detecta pero NO es ejecutable como runtime principal en esta iteración.',
  },
} as const;

export function runtimeCatalogToText(): string {
  return Object.values(RUNTIME_CATALOG)
    .map(
      (rt) =>
        `- ${rt.family}: ejecutable=${rt.executable}, imagen=${rt.defaultImage}, versiones=${rt.allowedVersions.join(', ')}, notas=${rt.notes}`,
    )
    .join('\n');
}

export function adaptPlanToRuntimeRecipe(
  plan: BuilderPlanContractV2,
): BuilderRuntimeExecutionRecipe {
  const executable =
    plan.runtime.supported && EXECUTABLE_FAMILIES.has(plan.runtime.family);
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
