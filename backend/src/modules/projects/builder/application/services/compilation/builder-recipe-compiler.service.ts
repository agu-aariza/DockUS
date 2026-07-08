import { Injectable } from '@nestjs/common';
import {
  DEFAULT_BASE_C_IMAGE,
  DEFAULT_BASE_PYTHON_IMAGE,
} from '../../../domain/builder.constants';
import { BuilderPlanContractV2 } from '../../../domain/builder.types';
import { adaptPlanToRuntimeRecipe } from './builder-plan-runtime-adapter';

interface CompiledRecipe {
  executable: boolean;
  unsupportedReason?: string;
  image: string;
  systemPackages: string[];
  aptCmd: string;
  installCmd: string;
  fullInstallCmd: string;
  runCmd: string;
  runCmdWithStdin: string;
  stdinFile?: string;
  testCmd: string;
  healthcheckCmd: string;
  orchestratedCmd: string;
  finalCommand: string[];
  servicePort: number | null;
  runtimeFamily: string | null;
  workingDirectory: string | null;
  environment: Record<string, string> | null;
}

@Injectable()
export class BuilderRecipeCompiler {
  compile(
    planAssessment: BuilderPlanContractV2,
    workspaceFiles: Array<{ relativePath: string }>,
  ): CompiledRecipe {
    const recipe = adaptPlanToRuntimeRecipe(planAssessment);

    if (!recipe.executable || !recipe.run) {
      return {
        executable: false,
        unsupportedReason: recipe.unsupportedReason ?? 'RECETA VACIA',
        image: DEFAULT_BASE_PYTHON_IMAGE,
        systemPackages: [],
        aptCmd: '',
        installCmd: '',
        fullInstallCmd: '',
        runCmd: '',
        runCmdWithStdin: '',
        testCmd: '',
        healthcheckCmd: '',
        orchestratedCmd: '',
        finalCommand: [],
        servicePort: null,
        runtimeFamily: null,
        workingDirectory: null,
        environment: null,
      };
    }

    let image: string;
    if (recipe.runtimeFamily === 'c') {
      image = DEFAULT_BASE_C_IMAGE;
    } else if (recipe.runtimeVersion) {
      image = `python:${recipe.runtimeVersion}-slim`;
    } else {
      image = DEFAULT_BASE_PYTHON_IMAGE;
    }

    const builtInPackages =
      recipe.runtimeFamily === 'c'
        ? ['gcc', 'g++', 'make', 'cmake', 'cpp']
        : ['pip', 'pip3', 'python', 'python3', 'node', 'npm', 'yarn'];

    const systemPackages = (recipe.systemPackages || []).filter(
      (pkg) => !builtInPackages.includes(pkg.toLowerCase()),
    );

    const aptCmd =
      systemPackages.length > 0
        ? `apt-get update && apt-get install -y ${systemPackages.join(' ')}`
        : '';

    const installCmd =
      recipe.install && recipe.install.length > 0
        ? recipe.install
            .map((commandParts) => {
              if (
                recipe.runtimeFamily !== 'c' &&
                (commandParts[0] === 'pip' || commandParts[0] === 'pip3')
              ) {
                return ['python', '-m', 'pip', ...commandParts.slice(1)].join(
                  ' ',
                );
              }
              return commandParts.join(' ');
            })
            .join(' && ')
        : '';

    const fullInstallCmd = [aptCmd, installCmd].filter(Boolean).join(' && ');

    const PYTHON_MODULE_EXECUTABLES = new Set(['uvicorn', 'gunicorn', 'flask']);
    const runCmd =
      recipe.runtimeFamily !== 'c' &&
      PYTHON_MODULE_EXECUTABLES.has(recipe.run[0])
        ? ['python', '-m', recipe.run[0], ...recipe.run.slice(1)].join(' ')
        : recipe.run.join(' ');

    // Auto-detect test*.in / input*.in files for stdin redirection
    const STDIN_FILE_PATTERN = /(?:^|\/)(?:test|input)[^/]*\.in$/i;
    const stdinFile = workspaceFiles
      .map((f) => f.relativePath)
      .find((p) => STDIN_FILE_PATTERN.test(p));
    const runCmdWithStdin = stdinFile ? `${runCmd} < ${stdinFile}` : runCmd;

    const testCmd =
      recipe.test && recipe.test.length > 0
        ? recipe.test.map((cmd) => cmd.join(' ')).join(' && ')
        : '';
    const healthcheckCmd =
      recipe.healthcheck && recipe.healthcheck.length > 0
        ? recipe.healthcheck.join(' ')
        : '';

    let orchestratedCmd: string;
    if (recipe.servicePort && recipe.servicePort > 0) {
      const waitTime = 3;
      orchestratedCmd = [
        fullInstallCmd,
        `(${runCmd} &)`,
        `sleep ${waitTime}`,
        healthcheckCmd
          ? `echo "--- HEALTHCHECK EVIDENCE ---" && ${healthcheckCmd} && echo "--- END EVIDENCE ---"`
          : '',
        testCmd,
      ]
        .filter(Boolean)
        .join(' && ');
    } else {
      orchestratedCmd = [fullInstallCmd, runCmdWithStdin, testCmd]
        .filter(Boolean)
        .join(' && ');
    }

    const finalCommand = ['sh', '-c', orchestratedCmd];

    return {
      executable: true,
      image,
      systemPackages,
      aptCmd,
      installCmd,
      fullInstallCmd,
      runCmd,
      runCmdWithStdin,
      stdinFile,
      testCmd,
      healthcheckCmd,
      orchestratedCmd,
      finalCommand,
      servicePort: recipe.servicePort,
      runtimeFamily: recipe.runtimeFamily,
      workingDirectory: recipe.workingDirectory,
      environment: recipe.environment,
    };
  }
}
