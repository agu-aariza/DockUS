/**
 * @fileoverview Motor Builder de evaluación asíncrona (builder.types).
 *
 * @module builder.types
 */

import { BuildRunArtifactType } from './entities/build-run-artifact.entity';
import type {
  BuilderLlmPromptStage,
  LlmModelProfile,
  LlmProviderId,
  LlmUsage,
} from '../../../../shared/infrastructure/ai/llm.types';
import type { PromptSectionTrace } from './ai/prompt-composer.types';
import type { RubricCriterion } from '../../entities/project.entity';
import type { BuilderRuntimeFamily } from './runtime-catalog';

export type { RubricCriterion };
// BuilderRuntimeFamily se deriva de las claves de
// RUNTIME_CATALOG (más 'unknown') en runtime-catalog.ts — no se duplica aquí.
export type { BuilderRuntimeFamily };

export const BUILDER_LLM_SCHEMA_VERSION = 'builder-llm/v2' as const;
export type BuilderLlmSchemaVersion = typeof BUILDER_LLM_SCHEMA_VERSION;
export const BUILDER_EVALUATION_SCHEMA_VERSION =
  'builder-evaluation/v3' as const;
export const BUILDER_REPORT_COPY_SCHEMA_VERSION =
  'builder-report-copy/v1' as const;
export const BUILDER_REPORT_SCHEMA_VERSION = 'builder-report/v3' as const;

export const BUILDER_LLM_STAGES = ['plan', 'facts', 'evaluation'] as const;
export type BuilderLlmStage = (typeof BUILDER_LLM_STAGES)[number];

type StructuralType = string;

export const CAPABILITY_IDS = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6'] as const;
export type CapabilityId = (typeof CAPABILITY_IDS)[number];

export const EVALUATIVE_STATES = ['E1', 'E2', 'E3', 'E4'] as const;
export type EvaluativeState = (typeof EVALUATIVE_STATES)[number];

/**
 * Frase de informe para cada estado evaluativo. El código (`E2`) sigue viajando
 * en el contrato y en los artefactos, pero nunca aparece en la prosa que leen
 * alumno y profesor: fuera del equipo nadie sabe interpretarlo.
 *
 * Este es el registro *frase*; el frontend tiene el registro *etiqueta* (2–4
 * palabras para el pill y las tablas) en `shared/data/builderTaxonomy.ts`. Son
 * textos distintos del mismo concepto a propósito, no una copia que sincronizar:
 * lo que sí debe mantenerse es el eje — qué hizo el programa al ejecutarse, no
 * si la entrega aprueba (de eso ya habla `overallOutcome` y la nota).
 */
export const EVALUATIVE_STATE_SENTENCES: Record<EvaluativeState, string> = {
  E1: 'El programa se ejecutó y su salida coincide con lo esperado.',
  E2: 'El programa se ejecutó, pero su salida solo coincide en parte con lo esperado.',
  E3: 'El programa no llegó a producir una salida que se pudiera evaluar.',
  E4: 'La evaluación automática no pudo completarse, así que este resultado es provisional.',
};

export const ASSESSMENTS = ['yes', 'no', 'unknown'] as const;
type Assessment = (typeof ASSESSMENTS)[number];

export const CONFIDENCE_LEVELS = ['low', 'medium', 'high'] as const;
export type Confidence = (typeof CONFIDENCE_LEVELS)[number];

export const BUILD_RUN_EVENT_TYPES = [
  'RUN_ENQUEUED',
  'RUN_STARTED',
  'RUN_STATUS_CHANGED',
  'LOG_CHUNK',
  'WARNING_ADDED',
  'ARTIFACT_ADDED',
  'REPORT_READY',
  'RUN_COMPLETED',
  'RUN_FAILED',
  'RUN_CANCELLED',
] as const;
export type BuildRunEventType = (typeof BUILD_RUN_EVENT_TYPES)[number];

// fase de cara al alumno, antes repetida como literal suelto
// en cada emitEvent (y replicada a mano en el frontend). Un `payload.studentStage`
// que no está en esta lista es un typo, no una fase nueva legítima.
export const BUILDER_STUDENT_STAGES = [
  'building',
  'executing',
  'evaluating',
  'analyzing',
  'completed',
  'failed',
] as const;
export type BuilderStudentStage = (typeof BUILDER_STUDENT_STAGES)[number];

/**
 * Resultado de la etapa de ejecución, tipado en vez de
 * viajar como el blob `STDOUT:\n...\nSTDERR:\n...\nEXIT CODE: n` que cada
 * consumidor aguas abajo (guard de alucinaciones, fallback del evaluador)
 * tenía que re-parsear con regex. `ran: false` cubre el caso "el planner no
 * produjo un comando ejecutable" — no es un fallo de infraestructura (eso
 * sigue propagándose como excepción), es un resultado legítimo sin proceso
 * que ejecutar.
 */
export interface BuilderExecutionResult {
  ran: boolean;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  /** Solo tiene sentido cuando `ran` es `false`. */
  skippedReason?: string;
  /** Resultado verificable de la suite docente, si Builder la ejecutó. */
  teacherSuite?: {
    runner: 'c' | 'python';
    passed: boolean;
  };
}

export interface CapabilityAssessment {
  status: Assessment;
  rationale: string;
}

export type BuilderCapabilityMap = Record<CapabilityId, CapabilityAssessment>;

export interface BuilderRuntimeDescriptorV2 {
  family: BuilderRuntimeFamily;
  version: string | null;
  supported: boolean;
  reason: string | null;
}

export interface BuilderServiceRecipeV2 {
  port: number;
  healthcheck: string[] | null;
}

export interface BuilderRecipeV2 {
  install: string[][];
  run: string[] | null;
  test: string[][];
  systemPackages: string[];
  cwd: string | null;
  environment: Record<string, string> | null;
  service: BuilderServiceRecipeV2 | null;
}

interface BuilderLlmContractV2Base {
  schemaVersion: BuilderLlmSchemaVersion;
  stage: BuilderLlmStage;
  thought: string;
  structuralType: StructuralType;
  capabilities: BuilderCapabilityMap;
  evaluativeState: EvaluativeState;
  confidence: Confidence;
  rationale: string;
  externalRequirements: string[];
  runtime: BuilderRuntimeDescriptorV2;
  recipe: BuilderRecipeV2;
  evidenceSummary: string;
  observedEvidence: string[];
  evaluationLimits: string[];
  recommendedGrade?: number;
}

export interface RubricGradeItem {
  criterion: string;
  maxPoints: number;
  awarded: number;
  justification: string;
  /**
   * Peso (%) del criterio en la rúbrica configurada del proyecto, si existe.
   * Se rellena tras la evaluación emparejando por nombre con `rubricCriteria`.
   */
  weight?: number;
  /** Descripción del criterio tomada de la rúbrica configurada, si existe. */
  description?: string | null;
}

export interface BuilderPlanContractV2 extends BuilderLlmContractV2Base {
  stage: 'plan';
  recommendedGrade?: undefined;
}

export interface BuilderEvaluationContractV2 extends BuilderLlmContractV2Base {
  stage: 'evaluation';
  recommendedGrade?: number;
  gradeBreakdown: RubricGradeItem[];
  studentSummary: string;
  teacherSummary: string;
}

export type BuilderCriterionStatus =
  'ACHIEVED' | 'PARTIAL' | 'NOT_ACHIEVED' | 'NOT_ASSESSED';

export interface BuilderCriterionAssessmentV3 extends RubricGradeItem {
  /** Identificador determinista asignado por backend; el modelo nunca lo emite. */
  id: string;
  status: BuilderCriterionStatus;
  evidenceIds: string[];
}

export interface BuilderEvaluationEvidenceV3 {
  /** Identificador determinista asignado por backend. */
  id: string;
  kind: 'execution' | 'source' | 'rubric';
  summary: string;
  detail: string;
  /** La visibilidad es política del backend, no una decisión de la IA. */
  visibility: 'student' | 'teacher';
}

export interface BuilderEvaluationFindingV3 {
  /** Identificador determinista asignado por backend. */
  id: string;
  severity: FindingSeverity;
  title: string;
  explanation: string;
  recommendation: string;
  blocking: boolean;
  evidenceIds: string[];
  file?: string;
  line?: number;
}

/**
 * Evaluación canónica v3. Mantiene la taxonomía operativa de v2 para no
 * romper compilación/quality, pero elimina por completo la redacción por
 * audiencia: esa responsabilidad pertenece a `reporting`.
 */
export type BuilderEvaluationContractV3 = Omit<
  BuilderEvaluationContractV2,
  'schemaVersion' | 'studentSummary' | 'teacherSummary' | 'gradeBreakdown'
> & {
  schemaVersion: typeof BUILDER_EVALUATION_SCHEMA_VERSION;
  criteria: BuilderCriterionAssessmentV3[];
  evidence: BuilderEvaluationEvidenceV3[];
  findings: BuilderEvaluationFindingV3[];
  limitations: string[];
  reviewFlags: string[];
  /** Alias estructurado temporal para los consumidores de quality/grading. */
  gradeBreakdown: BuilderCriterionAssessmentV3[];
};

export interface BuilderFactsContractV2 {
  schemaVersion: BuilderLlmSchemaVersion;
  stage: 'facts';
  thought: string;
  observedStdout: string[];
  observedStderr: string[];
  exitCode: number | null;
  compilationStatus: 'success' | 'failure' | 'not_applicable';
  matchesOracle: boolean;
  discrepancies: string[];
  filesPresent: string[];
  executionSummary: string;
  evidenceLimits: string[];
}

export type BuilderLlmContractV2 =
  BuilderPlanContractV2 | BuilderFactsContractV2 | BuilderEvaluationContractV2;

export interface BuilderStudentNarrativeV1 {
  headline: string;
  achievements: string[];
  gaps: string[];
  conceptBridges: string[];
  nextSteps: string[];
}

export interface BuilderTeacherNarrativeV1 {
  executiveSummary: string;
  strengths: string[];
  concerns: string[];
  followUp: string[];
  reviewQuestions: string[];
}

/** Contrato de copy: deliberadamente no contiene estados ni puntuaciones. */
export interface BuilderReportCopyContractV1 {
  schemaVersion: typeof BUILDER_REPORT_COPY_SCHEMA_VERSION;
  stage: 'reporting';
  studentNarrative: BuilderStudentNarrativeV1;
  teacherNarrative: BuilderTeacherNarrativeV1;
}

export interface BuilderLlmStagePromptSnapshot {
  stage: BuilderLlmPromptStage;
  promptId: string;
  model: string;
  systemPrompt: string | null;
  prompt: string;
  sections: PromptSectionTrace[];
  modelProfile: LlmModelProfile;
  createdAt: string;
}

export interface BuilderLlmStageErrorInfo {
  name: string;
  code?: string;
  message: string;
  httpStatus?: number | null;
  stack: string | null;
  timestamp: string;
}

export interface BuilderLlmStageAttempt {
  attempt: number;
  rawResponse: string | null;
  error: BuilderLlmStageErrorInfo | null;
  usage?: LlmUsage;
  modelProfile?: LlmModelProfile;
}

export interface BuilderLlmStageTrace<
  TContract = BuilderLlmContractV2,
> extends BuilderLlmStagePromptSnapshot {
  schemaVersion: BuilderLlmSchemaVersion;
  rawResponse: string | null;
  parsedContract: TContract | null;
  error: BuilderLlmStageErrorInfo | null;
  usage?: LlmUsage;
  attempts?: BuilderLlmStageAttempt[];
}

/**
 * Consumo de una llamada al LLM junto al proveedor y modelo que la sirvieron.
 * El coste solo es calculable con los tres datos: cada etapa puede correr en un
 * proveedor distinto y a una tarifa distinta.
 */
export interface BuilderStageTokenUsage {
  stage: BuilderLlmPromptStage;
  providerId: LlmProviderId;
  modelId: string;
  inputTokens: number;
  outputTokens: number;
}

export type BuilderCodeQualityPromptSnapshot = BuilderLlmStagePromptSnapshot;

export type BuilderCodeQualityTrace =
  BuilderLlmStageTrace<BuilderCodeQualityContractV2>;

export interface AssignmentContext {
  expectedType: string | null;
  rubricInstructions: string | null;
  expectedOutput: string | null;
  rubricCriteria: RubricCriterion[] | null;
}

export interface RuntimeFile {
  relativePath: string;
  absolutePath: string;
  sizeBytes: number;
}

export interface BuilderRunEvent {
  id: string;
  buildRunId: string;
  sequence: number;
  eventType: BuildRunEventType;
  runStatus: string | null;
  message: string;
  payload: Record<string, unknown> | null;
  createdAt: string;
}

export interface EvidenceArtifactPublic {
  id: string;
  type: BuildRunArtifactType;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface BuilderRunEventsPage {
  events: BuilderRunEvent[];
  latestSequence: number;
  hasMore: boolean;
}

export const CODE_QUALITY_CATEGORIES = [
  'security',
  'architecture',
  'quality',
  'rubricCompliance',
] as const;
export type CodeQualityCategory = (typeof CODE_QUALITY_CATEGORIES)[number];

export type FindingSeverity = 'low' | 'medium' | 'high';

export type FindingLevel = 'basico' | 'intermedio' | 'avanzado';

export interface CodeQualityFinding {
  title: string;
  detail: string;
  severity: FindingSeverity;
  file?: string;
  line?: number;
  codeSnippet: string;
  level: FindingLevel;
  conceptExplanation: string;
}

export const BUILDER_OUTCOMES = ['PASS', 'FAIL', 'PARTIAL', 'UNKNOWN'] as const;
export type BuilderOutcome = (typeof BUILDER_OUTCOMES)[number];

export const BUILDER_COACHING_PASS_READINESS = [
  'BLOCKED',
  'READY_WITH_SUGGESTIONS',
] as const;
export type BuilderCoachingPassReadiness =
  (typeof BUILDER_COACHING_PASS_READINESS)[number];

export interface BuilderCodeQualityContractV2 {
  thought: string;
  security: CodeQualityFinding[];
  architecture: CodeQualityFinding[];
  quality: CodeQualityFinding[];
  rubricCompliance: CodeQualityFinding[];
}

export interface BuilderTechnicalFeedbackReport {
  security: CodeQualityFinding[];
  architecture: CodeQualityFinding[];
  quality: CodeQualityFinding[];
  rubricCompliance: CodeQualityFinding[];
}

export interface BuilderReportCoaching {
  passReadiness: BuilderCoachingPassReadiness;
  mustFix: CodeQualityFinding[];
  shouldImprove: CodeQualityFinding[];
  strengths: CodeQualityFinding[];
  nextAttemptChecklist: string[];
}

export interface BuilderReportEntity {
  schemaVersion?: typeof BUILDER_REPORT_SCHEMA_VERSION;
  evaluation?: BuilderEvaluationContractV3;
  copy?: BuilderReportCopyContractV1;
  reporting?: {
    usedFallback: boolean;
    errorCode: string | null;
    generatedAt: string;
  };
  readableText?: string;
  llmRecommendations?: string[];
  overallOutcome?: BuilderOutcome;
  technicalFeedback?: BuilderTechnicalFeedbackReport;
  coaching?: BuilderReportCoaching;
  learningObjective?: string;
  professionalVerdict?: string;
  pedagogicalNarrative?: BuilderPedagogicalNarrativeItem[];
  teacherHighlights?: BuilderTeacherHighlights;
  printableMarkdown?: string;
}

export type PedagogicalNarrativeKind = 'success' | 'gap' | 'bridge' | 'action';

export interface BuilderPedagogicalNarrativeItem {
  kind: PedagogicalNarrativeKind;
  content: string;
}

export interface BuilderTeacherHighlights {
  strengths: string[];
  concerns: string[];
  followUp: string[];
}
