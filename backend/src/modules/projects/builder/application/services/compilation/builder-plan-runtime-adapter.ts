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
