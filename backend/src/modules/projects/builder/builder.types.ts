export type BuilderPipelineStatus = 'SUCCESS' | 'BUILD_FAILED';

export type ConstructorKind = 'parametrized' | 'non-parametrized' | 'implicit';

export interface AbsolutePathFinding {
  file: string;
  line: number;
  match: string;
}

export interface BuilderClassQuality {
  name: string;
  constructor: ConstructorKind;
  issues: string[];
}

export interface BuilderQualityResult {
  classes: BuilderClassQuality[];
  summary: string;
}

export interface BuilderStackResult {
  language: 'python';
  pythonVersion: string;
  defaultedPythonVersion: boolean;
  manifests: {
    requirementsTxt: string | null;
    pyprojectToml: string | null;
    runtimeTxt: string | null;
    chosen: 'requirements.txt' | 'pyproject.toml' | null;
  };
  entrypoint: string;
  pythonFiles: number;
}

export interface BuilderRunResponse {
  deliveryId: string;
  pipelineStatus: BuilderPipelineStatus;
  stack: BuilderStackResult;
  absolutePathScan: {
    blocked: false;
    findings: AbsolutePathFinding[];
  };
  dockerfile: {
    model: string;
    content: string;
  };
  build: {
    tag: string;
    exitCode: number;
    durationMs: number;
    logsTail: string[];
  };
  quality: BuilderQualityResult;
  timingsMs: {
    collect: number;
    detect: number;
    scan: number;
    dockerfile: number;
    quality: number;
    build: number;
    total: number;
  };
  warnings: string[];
}

export interface RuntimeFile {
  relativePath: string;
  absolutePath: string;
  sizeBytes: number;
}

export interface DockerBuildResult {
  exitCode: number;
  durationMs: number;
  logsTail: string[];
}
