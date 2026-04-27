import { createHash } from 'crypto';
import { readFile } from 'fs/promises';
import * as path from 'path';
import {
  ABSOLUTE_PATH_PATTERNS,
  HARDCODED_PORT_PATTERNS,
  TEST_DISCOVERY_PATTERNS,
  TEXT_SCAN_EXTENSIONS,
} from '../../domain/builder.constants';
import type {
  BuilderLlmAssessment,
  BuilderPreflightFinding,
  BuilderPreflightSummary,
  DependencyManager,
  ManifestSource,
  PythonExecutionProfile,
  PythonProjectLayout,
  PythonProjectModel,
  ResolvedExecutionPlan,
  RuntimeFile,
} from '../../domain/builder.types';
import { loadDockusManifest } from './builder-dockus-manifest.util';

export interface AbsolutePathFinding {
  file: string;
  line: number;
  match: string;
}

interface FrameworkSignals {
  detectedFramework: string | null;
  executionProfile: PythonExecutionProfile;
  supportedProjectType: BuilderPreflightSummary['supportedProjectType'];
  entrypoint: string | null;
  servicePort: number | null;
}

const SUPPORTED_AUTO_COMPATIBILITIES = new Set<
  BuilderPreflightSummary['compatibility']
>(['SUPPORTED_AUTO', 'SUPPORTED_WITH_MANIFEST']);

export function toPosixPath(input: string): string {
  return input.replace(/\\/g, '/');
}

export function isUnsafeRelativePath(relativePath: string): boolean {
  const normalized = toPosixPath(relativePath).trim();
  if (!normalized) return true;

  const isWindowsAbsolute = /^[A-Za-z]:\//.test(normalized);
  const isUnixAbsolute = normalized.startsWith('/');
  const segments = normalized.split('/');
  const hasTraversal = segments.includes('..');

  return isWindowsAbsolute || isUnixAbsolute || hasTraversal;
}

export function buildSafeDestination(
  rootDir: string,
  relativePath: string,
): string {
  const normalized = toPosixPath(relativePath).trim();
  if (isUnsafeRelativePath(normalized)) {
    throw new Error(
      `Ruta invalida detectada durante preparacion de artefactos: "${relativePath}".`,
    );
  }

  const destination = path.resolve(rootDir, normalized);
  const rootResolved = path.resolve(rootDir);
  const rootWithSep = `${rootResolved}${path.sep}`;

  if (destination !== rootResolved && !destination.startsWith(rootWithSep)) {
    throw new Error(
      `Ruta fuera de workspace detectada durante preparacion de artefactos: "${relativePath}".`,
    );
  }

  return destination;
}

export function pickRootPreferredFile(
  files: RuntimeFile[],
  expectedName: string,
): RuntimeFile | null {
  const normalizedName = expectedName.toLowerCase();
  const matches = files.filter(
    (file) =>
      path.posix.basename(file.relativePath).toLowerCase() === normalizedName,
  );
  if (!matches.length) {
    return null;
  }

  matches.sort((a, b) => {
    const depthA = a.relativePath.split('/').length;
    const depthB = b.relativePath.split('/').length;
    if (depthA === depthB) {
      return a.relativePath.localeCompare(b.relativePath);
    }
    return depthA - depthB;
  });

  return matches[0];
}

export function listPythonFiles(files: RuntimeFile[]): RuntimeFile[] {
  return files
    .filter((file) => file.relativePath.toLowerCase().endsWith('.py'))
    .sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

export async function readTextFileSafe(absolutePath: string): Promise<string> {
  const fileBuffer = await readFile(absolutePath);
  if (fileBuffer.includes(0)) {
    return '';
  }
  return fileBuffer.toString('utf8');
}

export async function detectEntrypointCandidates(
  pythonFiles: RuntimeFile[],
): Promise<string[]> {
  const preferredCandidates = new Set([
    'main.py',
    'app.py',
    'src/main.py',
    'src/app.py',
    'manage.py',
  ]);
  const candidates = new Set<string>();

  for (const file of pythonFiles) {
    if (preferredCandidates.has(file.relativePath.toLowerCase())) {
      candidates.add(file.relativePath);
    }
    if (
      /(^|\/)(__main__|main|app|server|cli|worker|tasks)\.py$/iu.test(
        file.relativePath,
      )
    ) {
      candidates.add(file.relativePath);
    }
  }

  for (const file of pythonFiles) {
    const content = await readTextFileSafe(file.absolutePath);
    if (/if\s+__name__\s*==\s*["']__main__["']\s*:/.test(content)) {
      candidates.add(file.relativePath);
    }
  }

  if (candidates.size === 0 && pythonFiles.length === 1) {
    const candidate = pythonFiles[0].relativePath;
    if (!candidate.endsWith('__init__.py')) {
      candidates.add(candidate);
    }
  }

  return [...candidates].sort((a, b) => a.localeCompare(b));
}

export function isDirectlyRunnablePreflight(
  summary: BuilderPreflightSummary,
): boolean {
  return SUPPORTED_AUTO_COMPATIBILITIES.has(summary.compatibility);
}

export function buildAssessmentFromPreflightSummary(
  preflightSummary: BuilderPreflightSummary,
): BuilderLlmAssessment {
  const isService =
    preflightSummary.executionProfile === 'web-asgi' ||
    preflightSummary.executionProfile === 'web-wsgi' ||
    preflightSummary.executionProfile === 'django-service' ||
    preflightSummary.detectedProjectModel.healthStrategy.servicePort !== null;

  const manifestDriven =
    preflightSummary.manifestSource === 'DOCKUS_MANIFEST' ||
    preflightSummary.compatibility === 'SUPPORTED_WITH_MANIFEST';

  return {
    structuralType: toStructuralType(preflightSummary.executionProfile),
    capabilities: {
      C1: {
        status:
          preflightSummary.resolvedCommands.install.length > 0
            ? 'yes'
            : 'unknown',
        rationale: manifestDriven
          ? 'La instalación se resolvió usando dockus.yml.'
          : 'La instalación se resolvió automáticamente desde manifests Python detectados.',
      },
      C2: {
        status: preflightSummary.resolvedCommands.run ? 'yes' : 'no',
        rationale: manifestDriven
          ? 'La receta principal se resolvió mediante dockus.yml.'
          : 'La receta principal se resolvió automáticamente en preflight.',
      },
      C3: {
        status: isService ? 'yes' : 'no',
        rationale: isService
          ? 'El proyecto se detectó como servicio persistente.'
          : 'El proyecto se detectó como ejecución efímera.',
      },
      C4: {
        status:
          preflightSummary.resolvedCommands.test.length > 0 ||
          preflightSummary.testsPresent
            ? 'yes'
            : 'unknown',
        rationale:
          'Hay estrategia de test resoluble, complementable con suite docente.',
      },
      C5: {
        status: preflightSummary.resolvedCommands.healthcheck
          ? 'yes'
          : 'unknown',
        rationale: preflightSummary.resolvedCommands.healthcheck
          ? 'El preflight resolvió un healthcheck ejecutable.'
          : 'No se resolvió un healthcheck explícito.',
      },
      C6: {
        status: isDirectlyRunnablePreflight(preflightSummary)
          ? 'yes'
          : 'unknown',
        rationale: isDirectlyRunnablePreflight(preflightSummary)
          ? 'El proyecto encaja en el builder Python capability-first sin depender del planner.'
          : 'El proyecto necesita apoyo adicional del planner LLM.',
      },
    },
    evaluativeState: isService ? 'E3' : 'E4',
    confidence:
      preflightSummary.compatibility === 'SUPPORTED_WITH_MANIFEST'
        ? 'high'
        : preflightSummary.compatibility === 'SUPPORTED_AUTO'
          ? 'high'
          : 'medium',
    rationale: manifestDriven
      ? 'Receta resuelta a partir de dockus.yml con validaciones de preflight.'
      : 'Receta resuelta automáticamente por el preflight capability-first.',
    externalRequirements: [],
    recipe: {
      install: preflightSummary.resolvedCommands.install,
      run: preflightSummary.resolvedCommands.run,
      test: preflightSummary.resolvedCommands.test,
      healthcheck: preflightSummary.resolvedCommands.healthcheck,
      servicePort: preflightSummary.resolvedServicePort,
      systemPackages: preflightSummary.systemDependencies,
      workingDirectory: preflightSummary.workingDirectory,
      dependencyManager: preflightSummary.dependencyManager,
      executionProfile: preflightSummary.executionProfile,
      manifestSource: preflightSummary.manifestSource,
      environment: preflightSummary.resolvedEnvironment,
    },
    evidenceSummary: buildPreflightEvidenceSummary(preflightSummary),
    observedEvidence: [
      `executionProfile=${preflightSummary.executionProfile}`,
      `dependencyManager=${preflightSummary.dependencyManager}`,
      `workingDirectory=${preflightSummary.workingDirectory}`,
      `manifestSource=${preflightSummary.manifestSource}`,
    ],
    evaluationLimits:
      preflightSummary.compatibility === 'SUPPORTED_WITH_MANIFEST'
        ? [
            'La compatibilidad depende del contrato explícito definido en dockus.yml.',
          ]
        : [],
  };
}

export async function detectBuilderPreflightSummary(
  runtimeFiles: RuntimeFile[],
): Promise<BuilderPreflightSummary> {
  const pythonFiles = listPythonFiles(runtimeFiles);
  const entrypointCandidates = await detectEntrypointCandidates(pythonFiles);
  const testsPresent = detectTestsPresent(runtimeFiles);
  const absolutePathFindings = await scanAbsolutePathsInFiles(runtimeFiles);
  const findings: BuilderPreflightFinding[] = [];

  for (const finding of absolutePathFindings.slice(0, 10)) {
    findings.push({
      level: 'warning',
      code: 'PREFLIGHT_ABSOLUTE_PATH_REFERENCE',
      message: `Se detectó una ruta absoluta host en ${finding.file}:${finding.line}.`,
      file: finding.file,
      line: finding.line,
    });
  }

  if (pythonFiles.length === 0) {
    const emptyModel = buildEmptyProjectModel(testsPresent);
    findings.unshift({
      level: 'error',
      code: 'PREFLIGHT_NO_PYTHON_FILES',
      message:
        'No se detectaron ficheros Python dentro de la entrega, así que el builder Python-first no puede evaluarla.',
      file: null,
      line: null,
    });
    return {
      supportedProjectType: 'UNKNOWN',
      compatibility: 'UNSUPPORTED',
      entrypointCandidates: [],
      testsPresent,
      detectedFramework: null,
      detectedProjectModel: emptyModel,
      dependencyManager: emptyModel.dependencyManager,
      pythonVersionConstraint: emptyModel.pythonVersionConstraint,
      executionProfile: emptyModel.executionProfile,
      workingDirectory: emptyModel.workingDirectory,
      manifestSource: 'AUTO',
      manifestPath: null,
      resolvedCommands: {
        install: [],
        run: null,
        test: [],
        healthcheck: null,
      },
      resolvedEnvironment: {},
      resolvedServicePort: null,
      systemDependencies: [],
      findings,
      failureCode: 'PREFLIGHT_UNSUPPORTED_NON_PYTHON',
    };
  }

  const manifestData = await loadDockusManifest(runtimeFiles);
  const textContentMap = await readTextContentMap(runtimeFiles);
  const workingDirectory = detectWorkingDirectory({
    runtimeFiles,
    entrypointCandidates,
    manifestWorkingDirectory: manifestData?.manifest.workingDirectory ?? null,
  });
  const dependencyManager = detectDependencyManager({
    runtimeFiles,
    textContentMap,
    manifestDependencyManager: manifestData?.manifest.dependencyManager ?? null,
    workingDirectory,
  });
  const pythonVersionConstraint = detectPythonVersionConstraint({
    runtimeFiles,
    textContentMap,
    manifestPythonVersion: manifestData?.manifest.pythonVersion ?? null,
    workingDirectory,
  });
  const frameworkSignals = detectFrameworkSignals({
    runtimeFiles,
    textContentMap,
    entrypointCandidates,
    manifestEntryPoint: manifestData?.manifest.entrypoint ?? null,
    manifestExecutionProfile: manifestData?.manifest.executionProfile ?? null,
    workingDirectory,
  });
  const projectLayout = detectProjectLayout({
    runtimeFiles,
    workingDirectory,
    dependencyManager,
  });
  const systemDependencies = detectSystemDependencies({
    runtimeFiles,
    textContentMap,
    workingDirectory,
    manifestSystemPackages: manifestData?.manifest.systemPackages ?? [],
  });
  const projectModel: PythonProjectModel = {
    pythonVersionConstraint,
    dependencyManager,
    projectLayout,
    executionProfile: frameworkSignals.executionProfile,
    entrypoints: entrypointCandidates,
    testStrategy: {
      studentTestsPresent: testsPresent,
      teacherTestsSupported: true,
      suggestedCommand: testsPresent ? ['pytest', '-q'] : null,
    },
    healthStrategy: {
      kind: frameworkSignals.servicePort ? 'command' : 'none',
      command: frameworkSignals.servicePort
        ? buildDefaultHealthcheck(frameworkSignals.servicePort)
        : null,
      servicePort: frameworkSignals.servicePort,
      path: frameworkSignals.servicePort ? '/' : null,
    },
    systemDependencies,
    workingDirectory,
    detectedFramework: frameworkSignals.detectedFramework,
    packageRoot: detectPackageRoot(runtimeFiles, workingDirectory),
  };

  const resolvedPlan = buildResolvedExecutionPlan({
    runtimeFiles,
    textContentMap,
    manifestData,
    projectModel,
    frameworkSignals,
    testsPresent,
  });
  const compatibility = determineCompatibility({
    manifestData,
    dependencyManager,
    frameworkSignals,
    resolvedPlan,
  });
  const finalizedProjectModel: PythonProjectModel = {
    ...projectModel,
    healthStrategy: {
      kind: resolvedPlan.servicePort ? 'command' : 'none',
      command: resolvedPlan.healthcheck,
      servicePort: resolvedPlan.servicePort,
      path: resolvedPlan.servicePort ? '/' : null,
    },
  };
  const failureCode = determineFailureCode({
    compatibility,
    manifestData,
    frameworkSignals,
    resolvedPlan,
    dependencyManager,
  });

  enrichFindings({
    findings,
    manifestData,
    frameworkSignals,
    compatibility,
    testsPresent,
    dependencyManager,
    resolvedPlan,
    workingDirectory,
  });

  return {
    supportedProjectType: frameworkSignals.supportedProjectType,
    compatibility,
    entrypointCandidates,
    testsPresent,
    detectedFramework: frameworkSignals.detectedFramework,
    detectedProjectModel: finalizedProjectModel,
    dependencyManager,
    pythonVersionConstraint,
    executionProfile: projectModel.executionProfile,
    workingDirectory,
    manifestSource: manifestData?.manifestSource ?? 'AUTO',
    manifestPath: manifestData?.manifestPath ?? null,
    resolvedCommands: {
      install: resolvedPlan.install,
      run: resolvedPlan.run,
      test: resolvedPlan.test,
      healthcheck: resolvedPlan.healthcheck,
    },
    resolvedEnvironment: resolvedPlan.env,
    resolvedServicePort: resolvedPlan.servicePort,
    systemDependencies: resolvedPlan.systemPackages,
    findings,
    failureCode,
  };
}

export function detectTestsPresent(files: RuntimeFile[]): boolean {
  return files.some((file) =>
    TEST_DISCOVERY_PATTERNS.some((pattern) => pattern.test(file.relativePath)),
  );
}

export async function scanAbsolutePathsInFiles(
  runtimeFiles: RuntimeFile[],
): Promise<AbsolutePathFinding[]> {
  const findings: AbsolutePathFinding[] = [];

  for (const file of runtimeFiles) {
    if (!shouldScanAsText(file.relativePath)) {
      continue;
    }

    const content = await readFile(file.absolutePath);
    if (content.includes(0)) {
      continue;
    }

    const lines = content.toString('utf8').split(/\r?\n/);
    lines.forEach((line, index) => {
      for (const pattern of ABSOLUTE_PATH_PATTERNS) {
        pattern.lastIndex = 0;
        let match = pattern.exec(line);
        while (match) {
          findings.push({
            file: file.relativePath,
            line: index + 1,
            match: match[0],
          });
          match = pattern.exec(line);
        }
      }
    });
  }

  return findings;
}

export function toPythonModuleFromFile(relativePath: string): string {
  const normalized = toPosixPath(relativePath)
    .replace(/\.py$/i, '')
    .replace(/^\.\//, '');
  return normalized.split('/').join('.');
}

export function toSha256Hex(value: Buffer | string): string {
  return createHash('sha256').update(value).digest('hex');
}

async function readTextContentMap(
  runtimeFiles: RuntimeFile[],
): Promise<Map<string, string>> {
  const contentMap = new Map<string, string>();
  for (const file of runtimeFiles) {
    if (
      !shouldScanAsText(file.relativePath) &&
      !file.relativePath.endsWith('.py')
    ) {
      continue;
    }
    const content = await readTextFileSafe(file.absolutePath);
    if (content) {
      contentMap.set(toPosixPath(file.relativePath), content);
    }
  }
  return contentMap;
}

function detectWorkingDirectory(input: {
  runtimeFiles: RuntimeFile[];
  entrypointCandidates: string[];
  manifestWorkingDirectory: string | null;
}): string {
  if (input.manifestWorkingDirectory) {
    return input.manifestWorkingDirectory;
  }

  const normalizedPaths = input.runtimeFiles.map((file) =>
    toPosixPath(file.relativePath),
  );

  const rootManifests = normalizedPaths.filter((file) =>
    /^(requirements[^/]*\.txt|pyproject\.toml|setup\.py|setup\.cfg|Pipfile|poetry\.lock|pdm\.lock|uv\.lock|manage\.py)$/u.test(
      path.posix.basename(file),
    ),
  );
  if (rootManifests.some((file) => !file.includes('/'))) {
    return '.';
  }

  const topLevelDirs = new Map<string, number>();
  for (const file of normalizedPaths) {
    const root = file.includes('/') ? file.split('/')[0] : '.';
    topLevelDirs.set(root, (topLevelDirs.get(root) ?? 0) + 1);
  }

  if (
    topLevelDirs.size === 1 &&
    !topLevelDirs.has('.') &&
    [...topLevelDirs.values()][0] > 1
  ) {
    return [...topLevelDirs.keys()][0];
  }

  const signalDirectories = [
    ...input.entrypointCandidates,
    ...normalizedPaths.filter((file) =>
      /(pyproject\.toml|setup\.py|setup\.cfg|Pipfile|poetry\.lock|pdm\.lock|uv\.lock|requirements[^/]*\.txt|manage\.py)$/u.test(
        path.posix.basename(file),
      ),
    ),
  ]
    .map((file) => path.posix.dirname(file))
    .filter((dir) => dir !== '.');

  if (signalDirectories.length === 0) {
    return '.';
  }

  const counts = new Map<string, number>();
  for (const dir of signalDirectories) {
    counts.set(dir, (counts.get(dir) ?? 0) + 1);
  }

  return (
    [...counts.entries()].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
    )[0]?.[0] ?? '.'
  );
}

function detectDependencyManager(input: {
  runtimeFiles: RuntimeFile[];
  textContentMap: Map<string, string>;
  manifestDependencyManager: DependencyManager | null;
  workingDirectory: string;
}): DependencyManager {
  if (input.manifestDependencyManager) {
    return input.manifestDependencyManager;
  }

  const files = input.runtimeFiles
    .map((file) => toPosixPath(file.relativePath))
    .filter((file) => isWithinWorkingDirectory(file, input.workingDirectory));
  const pyproject = findFirstMatching(files, /(^|\/)pyproject\.toml$/u);
  const pyprojectContent = pyproject
    ? (input.textContentMap.get(pyproject) ?? '')
    : '';

  if (files.some((file) => /(^|\/)poetry\.lock$/u.test(file))) {
    return 'poetry';
  }
  if (pyprojectContent.includes('[tool.poetry')) {
    return 'poetry';
  }
  if (files.some((file) => /(^|\/)pdm\.lock$/u.test(file))) {
    return 'pdm';
  }
  if (pyprojectContent.includes('[tool.pdm')) {
    return 'pdm';
  }
  if (files.some((file) => /(^|\/)uv\.lock$/u.test(file))) {
    return 'uv';
  }
  if (pyprojectContent.includes('[tool.uv')) {
    return 'uv';
  }
  if (files.some((file) => /(^|\/)Pipfile$/u.test(file))) {
    return 'pipenv';
  }
  if (files.some((file) => /(^|\/)requirements[^/]*\.txt$/u.test(file))) {
    return 'pip-requirements';
  }
  if (pyproject) {
    return 'pyproject';
  }
  if (
    files.some(
      (file) =>
        /(^|\/)setup\.py$/u.test(file) || /(^|\/)setup\.cfg$/u.test(file),
    )
  ) {
    return 'setuptools';
  }

  return 'unknown';
}

function detectPythonVersionConstraint(input: {
  runtimeFiles: RuntimeFile[];
  textContentMap: Map<string, string>;
  manifestPythonVersion: string | null;
  workingDirectory: string;
}): string | null {
  if (input.manifestPythonVersion) {
    return input.manifestPythonVersion;
  }

  const files = input.runtimeFiles
    .map((file) => toPosixPath(file.relativePath))
    .filter((file) => isWithinWorkingDirectory(file, input.workingDirectory));
  const runtimeTxt = files.find((file) => /(^|\/)runtime\.txt$/u.test(file));
  if (runtimeTxt) {
    const content = input.textContentMap.get(runtimeTxt)?.trim() ?? '';
    const match = content.match(/python-?([0-9][^\s]*)/iu);
    if (match?.[1]) {
      return match[1];
    }
  }

  const pyproject = files.find((file) => /(^|\/)pyproject\.toml$/u.test(file));
  if (pyproject) {
    const content = input.textContentMap.get(pyproject) ?? '';
    const match = content.match(/requires-python\s*=\s*["']([^"']+)["']/iu);
    if (match?.[1]) {
      return match[1];
    }
  }

  const pythonVersionFile = files.find((file) =>
    /(^|\/)\.python-version$/u.test(file),
  );
  if (pythonVersionFile) {
    const content = input.textContentMap.get(pythonVersionFile)?.trim() ?? '';
    if (content) {
      return content;
    }
  }

  return null;
}

function detectFrameworkSignals(input: {
  runtimeFiles: RuntimeFile[];
  textContentMap: Map<string, string>;
  entrypointCandidates: string[];
  manifestEntryPoint: string | null;
  manifestExecutionProfile: PythonExecutionProfile | null;
  workingDirectory: string;
}): FrameworkSignals {
  const pythonFiles = input.runtimeFiles.filter((file) =>
    isWithinWorkingDirectory(
      toPosixPath(file.relativePath),
      input.workingDirectory,
    ),
  );
  const relativePaths = pythonFiles.map((file) =>
    toPosixPath(file.relativePath),
  );
  const packageRoot = detectPackageRoot(
    input.runtimeFiles,
    input.workingDirectory,
  );

  let hasDjango = relativePaths.some((file) => file.endsWith('manage.py'));
  let hasFastApi = false;
  let hasFlask = false;
  let hasAsgi = false;
  let hasWsgi = false;
  let hasCliHints = false;
  const workerLikeFile =
    relativePaths.find((file) =>
      /(worker|job|tasks|celery|queue)\.py$/u.test(path.posix.basename(file)),
    ) ?? null;

  for (const file of relativePaths) {
    const content = input.textContentMap.get(file) ?? '';
    if (!content) {
      continue;
    }

    if (
      /\bfrom\s+fastapi\s+import\b/u.test(content) ||
      /\bFastAPI\s*\(/u.test(content)
    ) {
      hasFastApi = true;
      hasAsgi = true;
    }

    if (
      /\bfrom\s+flask\s+import\b/u.test(content) ||
      /\bFlask\s*\(/u.test(content)
    ) {
      hasFlask = true;
      hasWsgi = true;
    }

    if (
      /\bimport\s+django\b/u.test(content) ||
      /\bfrom\s+django\b/u.test(content) ||
      /DJANGO_SETTINGS_MODULE/u.test(content)
    ) {
      hasDjango = true;
    }

    if (
      /\bget_asgi_application\b/u.test(content) ||
      /\basgi\s*=/u.test(content)
    ) {
      hasAsgi = true;
    }
    if (
      /\bget_wsgi_application\b/u.test(content) ||
      /\bwsgi\s*=/u.test(content)
    ) {
      hasWsgi = true;
    }

    if (
      /if\s+__name__\s*==\s*["']__main__["']\s*:/u.test(content) ||
      /\bargparse\b/u.test(content) ||
      /\bclick\b/u.test(content) ||
      /\btyper\b/u.test(content)
    ) {
      hasCliHints = true;
    }
  }

  if (
    input.manifestExecutionProfile &&
    input.manifestExecutionProfile !== 'unknown'
  ) {
    return {
      detectedFramework:
        input.manifestExecutionProfile === 'custom-manifest'
          ? 'dockus-manifest'
          : null,
      executionProfile: input.manifestExecutionProfile,
      supportedProjectType: toSupportedProjectType(
        input.manifestExecutionProfile,
      ),
      entrypoint:
        input.manifestEntryPoint ?? input.entrypointCandidates[0] ?? null,
      servicePort: defaultServicePortForProfile(input.manifestExecutionProfile),
    };
  }

  if (hasDjango) {
    return {
      detectedFramework: 'django',
      executionProfile: 'django-service',
      supportedProjectType: 'DJANGO_SERVICE',
      entrypoint:
        relativePaths.find((file) => file.endsWith('manage.py')) ?? 'manage.py',
      servicePort: 8000,
    };
  }

  if (hasFastApi || hasAsgi) {
    return {
      detectedFramework: hasFastApi ? 'fastapi' : 'asgi',
      executionProfile: 'web-asgi',
      supportedProjectType: 'WEB_ASGI',
      entrypoint:
        input.manifestEntryPoint ??
        findEntrypointByBasename(relativePaths, [
          'main.py',
          'app.py',
          'api.py',
          'asgi.py',
        ]) ??
        input.entrypointCandidates[0] ??
        null,
      servicePort: 8000,
    };
  }

  if (hasFlask || hasWsgi) {
    return {
      detectedFramework: hasFlask ? 'flask' : 'wsgi',
      executionProfile: 'web-wsgi',
      supportedProjectType: 'WEB_WSGI',
      entrypoint:
        input.manifestEntryPoint ??
        findEntrypointByBasename(relativePaths, [
          'app.py',
          'main.py',
          'wsgi.py',
        ]) ??
        input.entrypointCandidates[0] ??
        null,
      servicePort: 5000,
    };
  }

  if (workerLikeFile) {
    return {
      detectedFramework: 'worker',
      executionProfile: 'batch-worker',
      supportedProjectType: 'BATCH_WORKER',
      entrypoint: workerLikeFile,
      servicePort: null,
    };
  }

  if (
    packageRoot &&
    relativePaths.some((file) => file.endsWith('__main__.py'))
  ) {
    const entrypoint =
      relativePaths.find((file) => file.endsWith('__main__.py')) ??
      input.entrypointCandidates[0] ??
      null;
    return {
      detectedFramework: 'module-cli',
      executionProfile: 'module-cli',
      supportedProjectType: 'MODULE_CLI',
      entrypoint,
      servicePort: null,
    };
  }

  if (hasCliHints) {
    return {
      detectedFramework: 'cli',
      executionProfile: 'cli-script',
      supportedProjectType: 'CLI',
      entrypoint: input.entrypointCandidates[0] ?? null,
      servicePort: null,
    };
  }

  if (input.manifestEntryPoint) {
    return {
      detectedFramework: 'manifest-entrypoint',
      executionProfile: 'custom-manifest',
      supportedProjectType: 'CUSTOM_MANIFEST',
      entrypoint: input.manifestEntryPoint,
      servicePort: null,
    };
  }

  const hasPyproject = relativePaths.some((file) =>
    file.endsWith('pyproject.toml'),
  );
  if (hasPyproject) {
    return {
      detectedFramework: 'pyproject',
      executionProfile: 'unknown',
      supportedProjectType: 'PYPROJECT_GENERIC',
      entrypoint: input.entrypointCandidates[0] ?? null,
      servicePort: detectPortFromContent(input.textContentMap, relativePaths),
    };
  }

  return {
    detectedFramework: null,
    executionProfile: 'unknown',
    supportedProjectType: 'UNKNOWN',
    entrypoint: input.entrypointCandidates[0] ?? null,
    servicePort: detectPortFromContent(input.textContentMap, relativePaths),
  };
}

function detectProjectLayout(input: {
  runtimeFiles: RuntimeFile[];
  workingDirectory: string;
  dependencyManager: DependencyManager;
}): PythonProjectLayout {
  const files = input.runtimeFiles
    .map((file) => toPosixPath(file.relativePath))
    .filter((file) => isWithinWorkingDirectory(file, input.workingDirectory));

  if (input.workingDirectory !== '.') {
    return 'monorepo-subdir';
  }

  if (files.some((file) => file.startsWith('src/'))) {
    return 'src-layout';
  }

  if (
    input.dependencyManager === 'pyproject' ||
    input.dependencyManager === 'poetry' ||
    input.dependencyManager === 'pdm' ||
    input.dependencyManager === 'uv' ||
    input.dependencyManager === 'setuptools'
  ) {
    return 'package-installable';
  }

  return 'flat-root';
}

function detectSystemDependencies(input: {
  runtimeFiles: RuntimeFile[];
  textContentMap: Map<string, string>;
  workingDirectory: string;
  manifestSystemPackages: string[];
}): string[] {
  const combined = new Set<string>(input.manifestSystemPackages);
  const files = input.runtimeFiles
    .map((file) => toPosixPath(file.relativePath))
    .filter((file) => isWithinWorkingDirectory(file, input.workingDirectory));
  const dependencyText = files
    .filter((file) =>
      /(^|\/)(requirements[^/]*\.txt|pyproject\.toml|setup\.py|setup\.cfg|Pipfile)$/u.test(
        file,
      ),
    )
    .map((file) => input.textContentMap.get(file) ?? '')
    .join('\n');

  const nativeHints: Array<{ pattern: RegExp; packages: string[] }> = [
    {
      pattern: /\bpsycopg2\b|\bpsycopg2-binary\b/iu,
      packages: ['gcc', 'libpq-dev'],
    },
    {
      pattern: /\bmysqlclient\b/iu,
      packages: ['build-essential', 'default-libmysqlclient-dev'],
    },
    {
      pattern: /\blxml\b/iu,
      packages: ['libxml2-dev', 'libxslt-dev'],
    },
    {
      pattern: /\bpillow\b/iu,
      packages: ['libjpeg62-turbo-dev', 'zlib1g-dev'],
    },
    {
      pattern: /\bcryptography\b/iu,
      packages: ['build-essential', 'libffi-dev'],
    },
  ];

  for (const hint of nativeHints) {
    if (hint.pattern.test(dependencyText)) {
      for (const pkg of hint.packages) {
        combined.add(pkg);
      }
    }
  }

  return [...combined].sort((a, b) => a.localeCompare(b));
}

function buildResolvedExecutionPlan(input: {
  runtimeFiles: RuntimeFile[];
  textContentMap: Map<string, string>;
  manifestData: Awaited<ReturnType<typeof loadDockusManifest>>;
  projectModel: PythonProjectModel;
  frameworkSignals: FrameworkSignals;
  testsPresent: boolean;
}): ResolvedExecutionPlan {
  const manifest = input.manifestData?.manifest ?? null;
  const workingDirectory = input.projectModel.workingDirectory;
  const dependencyManager = input.projectModel.dependencyManager;
  const executionProfile =
    manifest?.executionProfile ??
    (input.frameworkSignals.executionProfile !== 'unknown'
      ? input.frameworkSignals.executionProfile
      : manifest
        ? 'custom-manifest'
        : 'unknown');
  const entrypoint =
    manifest?.entrypoint ??
    input.frameworkSignals.entrypoint ??
    input.projectModel.entrypoints[0] ??
    null;
  const pythonPathEnv: Record<string, string> =
    input.projectModel.projectLayout === 'src-layout'
      ? { PYTHONPATH: '/app/src' }
      : {};
  const install =
    manifest && manifest.install.length > 0
      ? manifest.install
      : resolveInstallCommands({
          runtimeFiles: input.runtimeFiles,
          dependencyManager,
          workingDirectory,
          textContentMap: input.textContentMap,
        });
  const run =
    manifest?.run ??
    resolveRunCommand({
      executionProfile,
      entrypoint,
      workingDirectory,
      runtimeFiles: input.runtimeFiles,
      projectLayout: input.projectModel.projectLayout,
    });
  const tests =
    manifest && manifest.test.length > 0
      ? manifest.test
      : input.testsPresent
        ? [['pytest', '-q']]
        : [];
  const servicePort =
    manifest?.servicePort ??
    input.frameworkSignals.servicePort ??
    detectPortFromContent(
      input.textContentMap,
      input.runtimeFiles.map((file) => toPosixPath(file.relativePath)),
    );
  const healthcheck =
    manifest?.healthcheck ??
    (servicePort ? buildDefaultHealthcheck(servicePort) : null);

  return {
    dependencyManager,
    executionProfile,
    workingDirectory,
    manifestSource: input.manifestData?.manifestSource ?? 'AUTO',
    pythonVersionConstraint: input.projectModel.pythonVersionConstraint,
    entrypoint,
    install,
    run,
    test: tests,
    healthcheck,
    servicePort,
    systemPackages: input.projectModel.systemDependencies,
    env: {
      ...pythonPathEnv,
      ...(manifest?.env ?? {}),
    },
  };
}

function resolveInstallCommands(input: {
  runtimeFiles: RuntimeFile[];
  dependencyManager: DependencyManager;
  workingDirectory: string;
  textContentMap: Map<string, string>;
}): string[][] {
  const normalizedFiles = input.runtimeFiles.map((file) =>
    toPosixPath(file.relativePath),
  );
  const requirementsFile =
    findFirstMatchingWithinDirectory(
      normalizedFiles,
      input.workingDirectory,
      /(^|\/)requirements[^/]*\.txt$/u,
    ) ?? findFirstMatching(normalizedFiles, /(^|\/)requirements[^/]*\.txt$/u);
  const pyprojectFile =
    findFirstMatchingWithinDirectory(
      normalizedFiles,
      input.workingDirectory,
      /(^|\/)pyproject\.toml$/u,
    ) ?? findFirstMatching(normalizedFiles, /(^|\/)pyproject\.toml$/u);
  const setupFile =
    findFirstMatchingWithinDirectory(
      normalizedFiles,
      input.workingDirectory,
      /(^|\/)setup\.py$/u,
    ) ?? findFirstMatching(normalizedFiles, /(^|\/)setup\.py$/u);

  switch (input.dependencyManager) {
    case 'pip-requirements':
      if (requirementsFile) {
        return [
          [
            'python',
            '-m',
            'pip',
            'install',
            '-r',
            toWorkingDirectoryPath(requirementsFile, input.workingDirectory),
          ],
        ];
      }
      return [];
    case 'poetry':
      return [['poetry', 'install', '--no-interaction', '--no-ansi']];
    case 'pdm':
      return [['pdm', 'install']];
    case 'uv':
      return [['uv', 'sync']];
    case 'pipenv':
      return [['pipenv', 'install', '--deploy']];
    case 'pyproject':
    case 'setuptools':
      if (pyprojectFile || setupFile) {
        const manifestFile = pyprojectFile ?? setupFile!;
        const targetDir = path.posix.dirname(
          toWorkingDirectoryPath(manifestFile, input.workingDirectory),
        );
        return [
          [
            'python',
            '-m',
            'pip',
            'install',
            targetDir === '.' ? '.' : targetDir,
          ],
        ];
      }
      return [];
    case 'unknown':
    default:
      return [];
  }
}

function resolveRunCommand(input: {
  executionProfile: PythonExecutionProfile;
  entrypoint: string | null;
  workingDirectory: string;
  runtimeFiles: RuntimeFile[];
  projectLayout: PythonProjectLayout;
}): string[] | null {
  const commandEntryPoint = input.entrypoint
    ? toWorkingDirectoryPath(input.entrypoint, input.workingDirectory)
    : null;
  switch (input.executionProfile) {
    case 'django-service':
      return [
        'python',
        commandEntryPoint ?? 'manage.py',
        'runserver',
        '0.0.0.0:8000',
      ];
    case 'web-asgi': {
      const appModule = input.entrypoint
        ? resolveImportTarget(
            input.entrypoint,
            input.projectLayout,
            input.workingDirectory,
          )
        : null;
      return appModule
        ? ['uvicorn', `${appModule}:app`, '--host', '0.0.0.0', '--port', '8000']
        : commandEntryPoint
          ? ['python', commandEntryPoint]
          : null;
    }
    case 'web-wsgi': {
      const appModule = input.entrypoint
        ? resolveImportTarget(
            input.entrypoint,
            input.projectLayout,
            input.workingDirectory,
          )
        : null;
      return appModule
        ? ['gunicorn', `${appModule}:app`, '--bind', '0.0.0.0:5000']
        : commandEntryPoint
          ? ['python', commandEntryPoint]
          : null;
    }
    case 'module-cli': {
      const moduleName = input.entrypoint
        ? resolveModuleCliName(
            input.entrypoint,
            input.runtimeFiles,
            input.workingDirectory,
          )
        : null;
      return moduleName ? ['python', '-m', moduleName] : null;
    }
    case 'batch-worker':
    case 'cli-script':
      return commandEntryPoint ? ['python', commandEntryPoint] : null;
    case 'custom-manifest':
    case 'unknown':
    default:
      return commandEntryPoint ? ['python', commandEntryPoint] : null;
  }
}

function determineCompatibility(input: {
  manifestData: Awaited<ReturnType<typeof loadDockusManifest>>;
  dependencyManager: DependencyManager;
  frameworkSignals: FrameworkSignals;
  resolvedPlan: ResolvedExecutionPlan;
}): BuilderPreflightSummary['compatibility'] {
  if (input.manifestData) {
    if (
      input.resolvedPlan.run &&
      input.resolvedPlan.executionProfile !== 'unknown'
    ) {
      return 'SUPPORTED_WITH_MANIFEST';
    }
    return 'UNSUPPORTED';
  }

  if (
    input.resolvedPlan.run &&
    input.dependencyManager !== 'unknown' &&
    input.frameworkSignals.supportedProjectType !== 'UNKNOWN'
  ) {
    return 'SUPPORTED_AUTO';
  }

  if (
    input.frameworkSignals.supportedProjectType === 'PYPROJECT_GENERIC' ||
    input.resolvedPlan.run ||
    input.dependencyManager !== 'unknown'
  ) {
    return 'PARTIAL';
  }

  return 'UNSUPPORTED';
}

function determineFailureCode(input: {
  compatibility: BuilderPreflightSummary['compatibility'];
  manifestData: Awaited<ReturnType<typeof loadDockusManifest>>;
  frameworkSignals: FrameworkSignals;
  resolvedPlan: ResolvedExecutionPlan;
  dependencyManager: DependencyManager;
}): string | null {
  if (input.compatibility !== 'UNSUPPORTED') {
    return input.compatibility === 'PARTIAL'
      ? 'PREFLIGHT_REQUIRES_ADDITIONAL_PLANNING'
      : null;
  }

  if (input.manifestData && !input.resolvedPlan.run) {
    return 'PREFLIGHT_MANIFEST_INCOMPLETE';
  }

  if (input.frameworkSignals.supportedProjectType === 'UNKNOWN') {
    return input.dependencyManager === 'unknown'
      ? 'PREFLIGHT_UNSUPPORTED_NO_EXECUTION_CONTRACT'
      : 'PREFLIGHT_UNSUPPORTED_PROJECT_TYPE';
  }

  return 'PREFLIGHT_UNSUPPORTED_PROJECT_TYPE';
}

function enrichFindings(input: {
  findings: BuilderPreflightFinding[];
  manifestData: Awaited<ReturnType<typeof loadDockusManifest>>;
  frameworkSignals: FrameworkSignals;
  compatibility: BuilderPreflightSummary['compatibility'];
  testsPresent: boolean;
  dependencyManager: DependencyManager;
  resolvedPlan: ResolvedExecutionPlan;
  workingDirectory: string;
}): void {
  if (input.manifestData) {
    input.findings.push({
      level: 'info',
      code: 'PREFLIGHT_MANIFEST_APPLIED',
      message: `Se aplicó dockus.yml desde ${input.manifestData.manifestPath}.`,
      file: input.manifestData.manifestPath,
      line: null,
    });
  }

  if (!input.testsPresent) {
    input.findings.push({
      level: 'info',
      code: 'PREFLIGHT_NO_TESTS_DETECTED',
      message:
        'No se detectaron tests del alumno dentro del proyecto. La evaluación dependerá de la suite docente y del runtime.',
      file: null,
      line: null,
    });
  }

  if (input.dependencyManager === 'unknown') {
    input.findings.push({
      level: 'warning',
      code: 'PREFLIGHT_UNKNOWN_DEPENDENCY_MANAGER',
      message:
        'No se detectó un gestor de dependencias claro; el builder puede necesitar dockus.yml o apoyo del planner.',
      file: null,
      line: null,
    });
  }

  if (input.workingDirectory !== '.') {
    input.findings.push({
      level: 'info',
      code: 'PREFLIGHT_SUBDIRECTORY_WORKSPACE',
      message: `El proyecto evaluable se resolvió en el subdirectorio ${input.workingDirectory}.`,
      file: null,
      line: null,
    });
  }

  if (input.resolvedPlan.run === null) {
    input.findings.push({
      level: input.manifestData ? 'error' : 'warning',
      code: 'PREFLIGHT_NO_RUN_COMMAND',
      message: input.manifestData
        ? 'dockus.yml no resolvió un comando de arranque ejecutable.'
        : 'No se resolvió un comando de arranque claro; el planner intentará completarlo si la compatibilidad no es unsupported.',
      file: input.manifestData?.manifestPath ?? null,
      line: null,
    });
  }

  if (input.compatibility === 'PARTIAL') {
    input.findings.unshift({
      level: 'warning',
      code: 'PREFLIGHT_PARTIAL_COMPATIBILITY',
      message:
        'El proyecto encaja parcialmente en la matriz soportada; el builder continuará con garantías limitadas o requerirá planner.',
      file: null,
      line: null,
    });
  }

  if (input.compatibility === 'UNSUPPORTED') {
    input.findings.unshift({
      level: 'error',
      code: 'PREFLIGHT_UNSUPPORTED_PROJECT_TYPE',
      message: input.manifestData
        ? 'El proyecto sigue sin contrato de ejecución resoluble incluso usando dockus.yml.'
        : 'El proyecto no encaja en la matriz Python-first capability-first y requiere un dockus.yml o una estructura más explícita.',
      file: input.manifestData?.manifestPath ?? null,
      line: null,
    });
  }

  if (
    input.frameworkSignals.executionProfile === 'custom-manifest' &&
    input.manifestData
  ) {
    input.findings.push({
      level: 'info',
      code: 'PREFLIGHT_CUSTOM_MANIFEST_PROFILE',
      message:
        'La ejecución se apoyará en un perfil custom-manifest definido por el contrato dockus.yml.',
      file: input.manifestData.manifestPath,
      line: null,
    });
  }
}

function detectPackageRoot(
  runtimeFiles: RuntimeFile[],
  workingDirectory: string,
): string | null {
  const normalized = runtimeFiles
    .map((file) => toPosixPath(file.relativePath))
    .filter((file) => isWithinWorkingDirectory(file, workingDirectory));

  const mainPackage = normalized.find((file) =>
    /(^|\/)__main__\.py$/u.test(file),
  );
  if (!mainPackage) {
    return null;
  }

  const packageDir = path.posix.dirname(mainPackage);
  if (packageDir === '.' || packageDir === 'src') {
    return null;
  }

  return packageDir.startsWith('src/')
    ? packageDir.slice(4).split('/')[0]
    : packageDir.split('/')[0];
}

function buildEmptyProjectModel(testsPresent: boolean): PythonProjectModel {
  return {
    pythonVersionConstraint: null,
    dependencyManager: 'unknown',
    projectLayout: 'unknown',
    executionProfile: 'unknown',
    entrypoints: [],
    testStrategy: {
      studentTestsPresent: testsPresent,
      teacherTestsSupported: true,
      suggestedCommand: null,
    },
    healthStrategy: {
      kind: 'none',
      command: null,
      servicePort: null,
      path: null,
    },
    systemDependencies: [],
    workingDirectory: '.',
    detectedFramework: null,
    packageRoot: null,
  };
}

function buildPreflightEvidenceSummary(
  preflightSummary: BuilderPreflightSummary,
): string {
  const manifestLabel =
    preflightSummary.manifestSource === 'DOCKUS_MANIFEST'
      ? ` con manifiesto ${preflightSummary.manifestPath ?? 'dockus.yml'}`
      : ' sin manifiesto explícito';
  return `Preflight ${preflightSummary.compatibility} para ${preflightSummary.supportedProjectType} (${preflightSummary.executionProfile}) usando ${preflightSummary.dependencyManager} en ${preflightSummary.workingDirectory}${manifestLabel}.`;
}

function toStructuralType(profile: PythonExecutionProfile): string {
  switch (profile) {
    case 'web-asgi':
    case 'web-wsgi':
    case 'django-service':
      return 'T4';
    case 'batch-worker':
      return 'T5';
    case 'module-cli':
    case 'cli-script':
    case 'custom-manifest':
    case 'unknown':
    default:
      return 'T6';
  }
}

function toSupportedProjectType(
  profile: PythonExecutionProfile,
): BuilderPreflightSummary['supportedProjectType'] {
  switch (profile) {
    case 'cli-script':
      return 'CLI';
    case 'module-cli':
      return 'MODULE_CLI';
    case 'web-asgi':
      return 'WEB_ASGI';
    case 'web-wsgi':
      return 'WEB_WSGI';
    case 'django-service':
      return 'DJANGO_SERVICE';
    case 'batch-worker':
      return 'BATCH_WORKER';
    case 'custom-manifest':
      return 'CUSTOM_MANIFEST';
    default:
      return 'UNKNOWN';
  }
}

function defaultServicePortForProfile(
  profile: PythonExecutionProfile,
): number | null {
  switch (profile) {
    case 'web-asgi':
    case 'django-service':
      return 8000;
    case 'web-wsgi':
      return 5000;
    default:
      return null;
  }
}

function buildDefaultHealthcheck(port: number): string[] {
  return [
    'python',
    '-c',
    `import urllib.request; urllib.request.urlopen("http://127.0.0.1:${port}/", timeout=5)`,
  ];
}

function resolveImportTarget(
  entrypoint: string,
  projectLayout: PythonProjectLayout,
  workingDirectory: string,
): string | null {
  const rootRelative = toPosixPath(entrypoint)
    .replace(/\.py$/iu, '')
    .replace(/^\.\//u, '');
  const normalized = stripWorkingDirectoryPrefix(
    rootRelative,
    workingDirectory,
  );
  if (!normalized) {
    return null;
  }

  if (projectLayout === 'src-layout' && normalized.startsWith('src/')) {
    return normalized.slice(4).split('/').join('.');
  }

  return normalized.split('/').join('.');
}

function resolveModuleCliName(
  entrypoint: string,
  runtimeFiles: RuntimeFile[],
  workingDirectory: string,
): string | null {
  const rootRelative = toPosixPath(entrypoint);
  const normalized = stripWorkingDirectoryPrefix(
    rootRelative,
    workingDirectory,
  );
  if (!normalized.endsWith('__main__.py')) {
    return null;
  }

  const packageDir = path.posix.dirname(normalized);
  if (packageDir === '.') {
    return null;
  }

  const fileSet = new Set(
    runtimeFiles.map((file) => toPosixPath(file.relativePath)),
  );
  const initCandidates = new Set<string>([
    `${packageDir}/__init__.py`,
    normalized.startsWith('src/')
      ? `src/${packageDir.replace(/^src\//u, '')}/__init__.py`
      : `${packageDir}/__init__.py`,
    workingDirectory === '.'
      ? `${packageDir}/__init__.py`
      : `${workingDirectory}/${packageDir}/__init__.py`,
    workingDirectory === '.'
      ? rootRelative.replace(/__main__\.py$/u, '__init__.py')
      : rootRelative.replace(/__main__\.py$/u, '__init__.py'),
  ]);
  if (![...initCandidates].some((candidate) => fileSet.has(candidate))) {
    return null;
  }

  return packageDir
    .replace(/^src\//u, '')
    .split('/')
    .join('.');
}

function detectPortFromContent(
  textContentMap: Map<string, string>,
  relativePaths: string[],
): number | null {
  for (const file of relativePaths) {
    const content = textContentMap.get(file) ?? '';
    for (const pattern of HARDCODED_PORT_PATTERNS) {
      const match = content.match(pattern);
      if (!match?.[1]) {
        continue;
      }
      const port = Number(match[1]);
      if (port > 0 && port < 65536) {
        return port;
      }
    }
  }

  return null;
}

function toWorkingDirectoryPath(
  targetPath: string,
  workingDirectory: string,
): string {
  if (workingDirectory === '.') {
    return targetPath;
  }

  const relative = path.posix.relative(workingDirectory, targetPath);
  return relative || '.';
}

function stripWorkingDirectoryPrefix(
  relativePath: string,
  workingDirectory: string,
): string {
  if (workingDirectory === '.') {
    return relativePath;
  }

  if (
    relativePath === workingDirectory ||
    relativePath.startsWith(`${workingDirectory}/`)
  ) {
    return relativePath.slice(workingDirectory.length).replace(/^\/+/u, '');
  }

  return relativePath;
}

function isWithinWorkingDirectory(
  relativePath: string,
  workingDirectory: string,
): boolean {
  if (workingDirectory === '.') {
    return true;
  }

  return (
    relativePath === workingDirectory ||
    relativePath.startsWith(`${workingDirectory}/`)
  );
}

function findFirstMatching(files: string[], pattern: RegExp): string | null {
  return files.find((file) => pattern.test(file)) ?? null;
}

function findFirstMatchingWithinDirectory(
  files: string[],
  workingDirectory: string,
  pattern: RegExp,
): string | null {
  return (
    files.find(
      (file) =>
        isWithinWorkingDirectory(file, workingDirectory) && pattern.test(file),
    ) ?? null
  );
}

function findEntrypointByBasename(
  files: string[],
  baseNames: string[],
): string | null {
  return (
    files.find((file) =>
      baseNames.includes(path.posix.basename(file).toLowerCase()),
    ) ?? null
  );
}

function shouldScanAsText(relativePath: string): boolean {
  const extension = path.extname(relativePath).toLowerCase();
  return TEXT_SCAN_EXTENSIONS.has(extension);
}
