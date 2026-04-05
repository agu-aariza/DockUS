import { BuildRunArtifactType } from './entities/build-run-artifact.entity';

export type SignalStrength = 'strong' | 'aux';

export enum ProjectClass {
  SIMPLE_SCRIPT = 'simple_script',
  INSTALLABLE_PACKAGE = 'installable_package',
  WEB_SERVICE_FASTAPI_FLASK = 'web_service_fastapi_flask',
  DJANGO_APP = 'django_app',
  ANALYZABLE_NON_DEPLOYABLE = 'analyzable_non_deployable',
  INCOMPLETE_OR_INVALID = 'incomplete_or_invalid',
}

export enum PackagingState {
  WELL_PACKAGED = 'well_packaged',
  MIXED = 'mixed',
  MISPACKAGED = 'mispackaged',
}

export enum ExecutionProfile {
  BATCH = 'batch',
  SERVICE = 'service',
  ANALYSIS_ONLY = 'analysis_only',
}

export enum Deployability {
  DEPLOYABLE = 'deployable',
  BUILD_ONLY = 'build_only',
  ANALYSIS_ONLY = 'analysis_only',
}

export enum StageStatus {
  PASS = 'PASS',
  FAIL = 'FAIL',
  SKIP = 'SKIP',
}

export enum BuildStage {
  ANALYSIS = 'ANALYSIS',
  BUILD = 'BUILD',
  DEPLOY = 'DEPLOY',
  PROBES = 'PROBES',
  STABILITY = 'STABILITY',
  TESTS = 'TESTS',
  CLEANUP = 'CLEANUP',
}

export enum FindingSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

export interface RuntimeFile {
  relativePath: string;
  absolutePath: string;
  sizeBytes: number;
}

export interface ClassifierSignal {
  id: string;
  strength: SignalStrength;
  evidence: string;
}

export interface CharacterizationFacets {
  tests_present: boolean;
  packaging_state: PackagingState;
  execution_profile: ExecutionProfile;
  deployability: Deployability;
  portability_risks: string[];
}

export interface LlmSupportMetadata {
  status: 'generated' | 'skipped' | 'error';
  model?: string;
  summary?: string;
  error?: string;
}

export interface ProjectCharacterization {
  mainClass: ProjectClass;
  facets: CharacterizationFacets;
  signals: ClassifierSignal[];
  classifierVersion: string;
  llmSupport?: LlmSupportMetadata;
}

export interface StaticFinding {
  id: string;
  severity: FindingSeverity;
  category: 'security' | 'portability' | 'evaluability';
  file: string;
  line: number;
  evidence: string;
}

export interface BuildStrategy {
  mode: 'requirements' | 'pyproject' | 'copy_only' | 'none';
  dockerTemplate: 'batch' | 'fastapi' | 'flask' | 'django' | 'none';
  pythonVersion: string;
}

export interface ExecutionStrategy {
  profile: ExecutionProfile;
  command: string[] | null;
  serviceType: 'fastapi' | 'flask' | 'django' | null;
  appModule: string | null;
  appVariable: string | null;
  namespace: string | null;
}

export interface StrategyResult {
  selectedClass: ProjectClass;
  build: BuildStrategy;
  execution: ExecutionStrategy;
  notes: string[];
  blockingConditions: string[];
  llmSupport?: LlmSupportMetadata;
}

export interface StageResult {
  stage: BuildStage;
  status: StageStatus;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  reasonCode: string;
  evidenceRefs: string[];
}

export interface ValidationCheck {
  id: string;
  status: StageStatus;
  expected: string;
  actual: string;
}

export interface ValidationResult {
  profile: ExecutionProfile;
  overall: StageStatus;
  failedStage: BuildStage | null;
  checks: ValidationCheck[];
  tests: {
    detected: boolean;
    runner: 'pytest' | 'unittest' | 'none';
    status: StageStatus;
    details: string;
  };
  llmSupport?: LlmSupportMetadata;
}

export interface TeacherReport {
  detectedProject: ProjectClass;
  strategyApplied: string;
  stageOutcome: Record<BuildStage, StageStatus>;
  exactCause: string;
  relevantEvidence: string[];
  evaluationImplication: string;
  readableText: string;
  llmAssistedSummary?: {
    status: 'generated' | 'skipped' | 'error';
    model?: string;
    findingsForTeachers?: string;
    evidenceReadableText?: string;
    naturalExplanation?: string;
    humanInterpretation?: string;
    analysisSupport?: {
      classification: string;
      staticFindings: string;
      strategy: string;
      validation: string;
    };
    error?: string;
  };
}

export interface ExecutionContext {
  pythonBaseImage: string;
  dockerVersion: string | null;
  kindVersion: string | null;
  kubectlVersion: string | null;
  clusterName: string;
  limits: {
    batchTimeoutSeconds: number;
    serviceReadyTimeoutSeconds: number;
    stabilityWindowSeconds: number;
  };
}

export interface EvidenceArtifactPublic {
  id: string;
  type: BuildRunArtifactType;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface BuilderPipelineOutcome {
  projectCharacterization: ProjectCharacterization;
  strategyResult: StrategyResult;
  staticFindings: StaticFinding[];
  stageResults: StageResult[];
  validationResult: ValidationResult;
  evidenceArtifacts: EvidenceArtifactPublic[];
  teacherReport: TeacherReport;
  executionContext: ExecutionContext;
  legacy: {
    stackResult: unknown;
    dockerfileContent: string | null;
    buildLogs: unknown;
    qualityResult: unknown;
    timingsMs: unknown;
  };
  failureReason: string | null;
  warnings: string[];
}
