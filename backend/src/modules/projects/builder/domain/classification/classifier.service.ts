import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CLASSIFIER_VERSION,
  DEFAULT_PYTHON_VERSION,
} from '../builder.constants';
import {
  Deployability,
  ExecutionProfile,
  PackagingState,
  ProjectCharacterization,
  ProjectClass,
  RuntimeFile,
} from '../builder.types';
import {
  detectEntrypointCandidates,
  detectTestsPresent,
  listPythonFiles,
  pickRootPreferredFile,
  readTextFileSafe,
  toPosixPath,
  toPythonModuleFromFile,
} from '../../infrastructure/utils/builder-analysis.util';

type ServiceFramework = 'fastapi' | 'flask';

export interface ServiceCandidate {
  framework: ServiceFramework;
  file: string;
  module: string;
  appVar: string;
}

export interface ClassificationResult {
  characterization: ProjectCharacterization;
  pythonVersion: string;
  requirementsPath: string | null;
  pyprojectPath: string | null;
  runtimePath: string | null;
  entrypointCandidates: string[];
  resolvedEntrypoint: string | null;
  serviceCandidates: ServiceCandidate[];
  blockingReasons: string[];
}

interface ProjectScores {
  [ProjectClass.SIMPLE_SCRIPT]: number;
  [ProjectClass.INSTALLABLE_PACKAGE]: number;
  [ProjectClass.WEB_SERVICE_FASTAPI_FLASK]: number;
  [ProjectClass.DJANGO_APP]: number;
}

const CLASS_PRIORITY: ProjectClass[] = [
  ProjectClass.INCOMPLETE_OR_INVALID,
  ProjectClass.DJANGO_APP,
  ProjectClass.WEB_SERVICE_FASTAPI_FLASK,
  ProjectClass.INSTALLABLE_PACKAGE,
  ProjectClass.SIMPLE_SCRIPT,
  ProjectClass.ANALYZABLE_NON_DEPLOYABLE,
];

@Injectable()
export class ClassifierService {
  constructor(private readonly configService: ConfigService) {}

  async classify(runtimeFiles: RuntimeFile[]): Promise<ClassificationResult> {
    const signals: ProjectCharacterization['signals'] = [];
    const blockingReasons: string[] = [];
    const pythonFiles = listPythonFiles(runtimeFiles);
    const requirementsTxt = pickRootPreferredFile(
      runtimeFiles,
      'requirements.txt',
    );
    const pyprojectToml = pickRootPreferredFile(runtimeFiles, 'pyproject.toml');
    const runtimeTxt = pickRootPreferredFile(runtimeFiles, 'runtime.txt');
    const managePy = runtimeFiles.find(
      (file) => toPosixPath(file.relativePath).toLowerCase() === 'manage.py',
    );
    const testsPresent = detectTestsPresent(runtimeFiles);

    if (testsPresent) {
      signals.push({
        id: 'TESTS_PRESENT',
        strength: 'aux',
        evidence: 'tests/ or test_*.py detected',
      });
    }

    if (requirementsTxt) {
      signals.push({
        id: 'REQUIREMENTS_TXT',
        strength: 'aux',
        evidence: requirementsTxt.relativePath,
      });
    }

    if (pyprojectToml) {
      signals.push({
        id: 'PYPROJECT_TOML',
        strength: 'aux',
        evidence: pyprojectToml.relativePath,
      });
    }

    if (runtimeTxt) {
      signals.push({
        id: 'RUNTIME_TXT',
        strength: 'aux',
        evidence: runtimeTxt.relativePath,
      });
    }

    const hasPythonSignals =
      pythonFiles.length > 0 ||
      Boolean(requirementsTxt) ||
      Boolean(pyprojectToml);
    if (!hasPythonSignals) {
      blockingReasons.push('NO_PYTHON_SIGNALS');
    }

    const scores: ProjectScores = {
      [ProjectClass.SIMPLE_SCRIPT]: 0,
      [ProjectClass.INSTALLABLE_PACKAGE]: 0,
      [ProjectClass.WEB_SERVICE_FASTAPI_FLASK]: 0,
      [ProjectClass.DJANGO_APP]: 0,
    };

    let djangoStrongSignal = false;
    if (managePy) {
      const manageContent = await readTextFileSafe(managePy.absolutePath);
      if (manageContent.includes('execute_from_command_line')) {
        djangoStrongSignal = true;
        scores[ProjectClass.DJANGO_APP] += 3;
        signals.push({
          id: 'DJANGO_MANAGE',
          strength: 'strong',
          evidence: managePy.relativePath,
        });
      }
    }

    const serviceCandidates: ServiceCandidate[] = [];
    let hasDjangoAux = false;

    for (const file of pythonFiles) {
      const content = await readTextFileSafe(file.absolutePath);
      if (!content) {
        continue;
      }

      if (/from\s+django|import\s+django/.test(content)) {
        hasDjangoAux = true;
      }

      const fastapiMatches = [
        ...content.matchAll(/\b([A-Za-z_][A-Za-z0-9_]*)\s*=\s*FastAPI\s*\(/g),
      ];
      for (const match of fastapiMatches) {
        scores[ProjectClass.WEB_SERVICE_FASTAPI_FLASK] += 3;
        signals.push({
          id: 'FASTAPI_OBJECT',
          strength: 'strong',
          evidence: `${file.relativePath}:${match.index ?? 0}`,
        });
        serviceCandidates.push({
          framework: 'fastapi',
          file: file.relativePath,
          module: toPythonModuleFromFile(file.relativePath),
          appVar: match[1],
        });
      }

      const flaskMatches = [
        ...content.matchAll(/\b([A-Za-z_][A-Za-z0-9_]*)\s*=\s*Flask\s*\(/g),
      ];
      for (const match of flaskMatches) {
        scores[ProjectClass.WEB_SERVICE_FASTAPI_FLASK] += 3;
        signals.push({
          id: 'FLASK_OBJECT',
          strength: 'strong',
          evidence: `${file.relativePath}:${match.index ?? 0}`,
        });
        serviceCandidates.push({
          framework: 'flask',
          file: file.relativePath,
          module: toPythonModuleFromFile(file.relativePath),
          appVar: match[1],
        });
      }

      if (/if\s+__name__\s*==\s*["']__main__["']\s*:/.test(content)) {
        scores[ProjectClass.SIMPLE_SCRIPT] += 3;
        signals.push({
          id: 'MAIN_GUARD',
          strength: 'strong',
          evidence: file.relativePath,
        });
      }
    }

    if (hasDjangoAux && !djangoStrongSignal) {
      scores[ProjectClass.DJANGO_APP] += 1;
      signals.push({
        id: 'DJANGO_IMPORT',
        strength: 'aux',
        evidence: 'django import detected',
      });
    }

    const hasPackageStructure = runtimeFiles.some(
      (file) =>
        file.relativePath.endsWith('/__init__.py') ||
        file.relativePath === '__init__.py',
    );
    if (hasPackageStructure) {
      scores[ProjectClass.INSTALLABLE_PACKAGE] += 1;
      signals.push({
        id: 'PACKAGE_STRUCTURE',
        strength: 'aux',
        evidence: '__init__.py',
      });
    }

    let pyprojectValid = false;
    let pyprojectDependenciesPinned = false;
    let pyprojectContent = '';
    let runtimeContent = '';
    if (pyprojectToml) {
      pyprojectContent = await readTextFileSafe(pyprojectToml.absolutePath);
      pyprojectValid =
        /\[project\]/.test(pyprojectContent) ||
        /\[build-system\]/.test(pyprojectContent);
      if (pyprojectValid) {
        scores[ProjectClass.INSTALLABLE_PACKAGE] += 1;
      }
      pyprojectDependenciesPinned =
        this.arePyprojectDependenciesPinned(pyprojectContent);
    }

    let requirementsPinned = false;
    if (requirementsTxt) {
      scores[ProjectClass.INSTALLABLE_PACKAGE] += 1;
      const requirementsContent = await readTextFileSafe(
        requirementsTxt.absolutePath,
      );
      requirementsPinned = this.areRequirementsPinned(requirementsContent);
    }

    const entrypointCandidates = await detectEntrypointCandidates(pythonFiles);
    const resolvedEntrypoint =
      entrypointCandidates.length === 1 ? entrypointCandidates[0] : null;
    if (entrypointCandidates.length > 1) {
      blockingReasons.push('MULTIPLE_ENTRYPOINT_CANDIDATES');
    }

    const packagingState = this.resolvePackagingState({
      hasRequirements: Boolean(requirementsTxt),
      hasPyproject: Boolean(pyprojectToml),
      requirementsPinned,
      pyprojectPinned: pyprojectDependenciesPinned,
      pyprojectValid,
    });

    if (runtimeTxt) {
      runtimeContent = await readTextFileSafe(runtimeTxt.absolutePath);
    }

    if (!hasPythonSignals) {
      const characterization: ProjectCharacterization = {
        mainClass: ProjectClass.INCOMPLETE_OR_INVALID,
        facets: {
          tests_present: testsPresent,
          packaging_state: packagingState,
          execution_profile: ExecutionProfile.ANALYSIS_ONLY,
          deployability: Deployability.ANALYSIS_ONLY,
          portability_risks: [],
        },
        signals,
        classifierVersion: CLASSIFIER_VERSION,
      };
      return {
        characterization,
        pythonVersion: this.resolvePythonVersion(
          pyprojectContent,
          runtimeContent,
        ),
        requirementsPath: requirementsTxt?.relativePath ?? null,
        pyprojectPath: pyprojectToml?.relativePath ?? null,
        runtimePath: runtimeTxt?.relativePath ?? null,
        entrypointCandidates,
        resolvedEntrypoint: null,
        serviceCandidates,
        blockingReasons,
      };
    }

    const classByScore = this.selectClassByScore(scores);
    let selectedClass = classByScore;
    if (selectedClass === ProjectClass.SIMPLE_SCRIPT && !resolvedEntrypoint) {
      selectedClass = ProjectClass.ANALYZABLE_NON_DEPLOYABLE;
      blockingReasons.push('NO_DETERMINISTIC_ENTRYPOINT');
    }
    if (
      selectedClass === ProjectClass.WEB_SERVICE_FASTAPI_FLASK &&
      serviceCandidates.length !== 1
    ) {
      selectedClass = ProjectClass.ANALYZABLE_NON_DEPLOYABLE;
      blockingReasons.push('NO_DETERMINISTIC_SERVICE_APP');
    }

    const executionProfile =
      selectedClass === ProjectClass.DJANGO_APP ||
      selectedClass === ProjectClass.WEB_SERVICE_FASTAPI_FLASK
        ? ExecutionProfile.SERVICE
        : selectedClass === ProjectClass.SIMPLE_SCRIPT ||
            selectedClass === ProjectClass.INSTALLABLE_PACKAGE
          ? ExecutionProfile.BATCH
          : ExecutionProfile.ANALYSIS_ONLY;

    let deployability =
      executionProfile === ExecutionProfile.ANALYSIS_ONLY
        ? Deployability.ANALYSIS_ONLY
        : Deployability.DEPLOYABLE;

    const buildDeterministic =
      Boolean(requirementsTxt) ||
      Boolean(pyprojectToml) ||
      selectedClass === ProjectClass.SIMPLE_SCRIPT;
    const runDeterministic =
      (executionProfile === ExecutionProfile.BATCH &&
        Boolean(resolvedEntrypoint)) ||
      (executionProfile === ExecutionProfile.SERVICE &&
        (selectedClass === ProjectClass.DJANGO_APP ||
          serviceCandidates.length === 1));

    if (
      !runDeterministic &&
      buildDeterministic &&
      deployability === Deployability.DEPLOYABLE
    ) {
      deployability = Deployability.BUILD_ONLY;
      blockingReasons.push('NO_DETERMINISTIC_START_RECIPE');
    }
    if (!buildDeterministic) {
      deployability = Deployability.ANALYSIS_ONLY;
      blockingReasons.push('NO_DETERMINISTIC_BUILD_RECIPE');
    }

    const characterization: ProjectCharacterization = {
      mainClass: selectedClass,
      facets: {
        tests_present: testsPresent,
        packaging_state: packagingState,
        execution_profile:
          deployability === Deployability.DEPLOYABLE
            ? executionProfile
            : ExecutionProfile.ANALYSIS_ONLY,
        deployability,
        portability_risks: [],
      },
      signals,
      classifierVersion: CLASSIFIER_VERSION,
    };

    return {
      characterization,
      pythonVersion: this.resolvePythonVersion(
        pyprojectContent,
        runtimeContent,
      ),
      requirementsPath: requirementsTxt?.relativePath ?? null,
      pyprojectPath: pyprojectToml?.relativePath ?? null,
      runtimePath: runtimeTxt?.relativePath ?? null,
      entrypointCandidates,
      resolvedEntrypoint,
      serviceCandidates,
      blockingReasons,
    };
  }

  private selectClassByScore(scores: ProjectScores): ProjectClass {
    const candidates: Array<[ProjectClass, number]> = [
      [ProjectClass.DJANGO_APP, scores[ProjectClass.DJANGO_APP]],
      [
        ProjectClass.WEB_SERVICE_FASTAPI_FLASK,
        scores[ProjectClass.WEB_SERVICE_FASTAPI_FLASK],
      ],
      [
        ProjectClass.INSTALLABLE_PACKAGE,
        scores[ProjectClass.INSTALLABLE_PACKAGE],
      ],
      [ProjectClass.SIMPLE_SCRIPT, scores[ProjectClass.SIMPLE_SCRIPT]],
    ];

    candidates.sort((a, b) => b[1] - a[1]);
    const topScore = candidates[0]?.[1] ?? 0;
    if (topScore <= 0) {
      return ProjectClass.ANALYZABLE_NON_DEPLOYABLE;
    }

    const tied = candidates
      .filter((candidate) => candidate[1] === topScore)
      .map((candidate) => candidate[0]);
    if (tied.length === 1) {
      return tied[0];
    }

    for (const priorityClass of CLASS_PRIORITY) {
      if (tied.includes(priorityClass)) {
        return priorityClass;
      }
    }

    return candidates[0][0];
  }

  private resolvePythonVersion(
    pyprojectContent: string,
    runtimeContent: string,
  ): string {
    const fromPyproject =
      pyprojectContent.match(/requires-python\s*=\s*["']([^"']+)["']/i)?.[1] ??
      null;
    if (fromPyproject) {
      const version = fromPyproject.match(/(\d+\.\d+(?:\.\d+)?)/)?.[1] ?? null;
      if (version) {
        return version;
      }
    }

    if (runtimeContent) {
      const firstLine = runtimeContent.split(/\r?\n/)[0]?.trim() ?? '';
      const version = firstLine.match(/(\d+\.\d+(?:\.\d+)?)/)?.[1] ?? null;
      if (version) {
        return version;
      }
    }

    return this.configService.get<string>(
      'BUILDER_DEFAULT_PYTHON_VERSION',
      DEFAULT_PYTHON_VERSION,
    );
  }

  private resolvePackagingState(input: {
    hasRequirements: boolean;
    hasPyproject: boolean;
    requirementsPinned: boolean;
    pyprojectPinned: boolean;
    pyprojectValid: boolean;
  }): PackagingState {
    if (input.hasRequirements && input.hasPyproject) {
      return PackagingState.MIXED;
    }

    if (input.hasRequirements) {
      return input.requirementsPinned
        ? PackagingState.WELL_PACKAGED
        : PackagingState.MISPACKAGED;
    }

    if (input.hasPyproject) {
      return input.pyprojectValid && input.pyprojectPinned
        ? PackagingState.WELL_PACKAGED
        : PackagingState.MISPACKAGED;
    }

    return PackagingState.MISPACKAGED;
  }

  private areRequirementsPinned(content: string): boolean {
    const lines = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith('#'));
    if (lines.length === 0) {
      return false;
    }
    return lines.every((line) => /==/.test(line));
  }

  private arePyprojectDependenciesPinned(content: string): boolean {
    const dependencySectionMatch = content.match(
      /dependencies\s*=\s*\[([\s\S]*?)\]/m,
    );
    if (!dependencySectionMatch?.[1]) {
      return false;
    }
    const deps = dependencySectionMatch[1]
      .split(/\r?\n|,/)
      .map((line) => line.trim().replace(/^['"]|['"]$/g, ''))
      .filter(Boolean);
    if (deps.length === 0) {
      return false;
    }
    return deps.every((dep) => /==/.test(dep));
  }
}
