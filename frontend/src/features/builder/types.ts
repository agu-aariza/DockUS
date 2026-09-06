/**
 * @fileoverview Vista y componentes del motor Builder de evaluación (types).
 *
 * @module types
 */

/**
 * Shapes compartidas con el backend: fuente única en `@educodeai/contracts`
 * `BuildRunChatMessage` es el nombre local de
 * `ChatMessageResponse` del contrato.
 */
export type {
  BuildRunEvent,
  BuildRunEventsPage,
  ChatMessageResponse as BuildRunChatMessage,
  BuildRunReportSummary,
  StudentReportView,
} from "@educodeai/contracts";
import type { BuildRunReportSummary } from "@educodeai/contracts";

export type BuilderOutcome = "PASS" | "FAIL" | "PARTIAL" | "UNKNOWN";
export type QualityInsightCategory =
  "security" | "architecture" | "quality" | "rubricCompliance";
export type BuildRunStatus =
  "QUEUED" | "RUNNING" | "SUCCESS" | "FAILED" | "CANCELLED";

export type EvidenceArtifactType =
  | "REPORT_JSON"
  | "LLM_PLAN_PROMPT"
  | "LLM_PLAN_RAW_RESPONSE"
  | "LLM_FACTS_PROMPT"
  | "LLM_FACTS_RAW_RESPONSE"
  | "LLM_FACTS_PARSED"
  | "LLM_FACTS_ERROR"
  | "LLM_PLAN_PARSED"
  | "LLM_PLAN_ERROR"
  | "LLM_EVAL_PROMPT"
  | "LLM_EVAL_RAW_RESPONSE"
  | "LLM_EVAL_PARSED"
  | "LLM_EVAL_ERROR"
  | "LLM_QUALITY_PROMPT"
  | "LLM_QUALITY_RAW_RESPONSE"
  | "LLM_QUALITY_PARSED"
  | "LLM_QUALITY_ERROR"
  | "LLM_REPORT_PROMPT"
  | "LLM_REPORT_RAW_RESPONSE"
  | "LLM_REPORT_PARSED"
  | "LLM_REPORT_ERROR";

export interface EvidenceArtifactDto {
  id: string;
  type: EvidenceArtifactType;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
}

export type TechnicalFeedbackSeverity = "low" | "medium" | "high";
export type TechnicalFeedbackLevel = "basico" | "intermedio" | "avanzado";
export type BuilderRuntimeFamily = "python" | "node" | "c" | "unknown";

export interface RubricGradeItem {
  criterion: string;
  maxPoints: number;
  awarded: number;
  justification: string;
  /** Peso (%) del criterio en la rúbrica configurada del proyecto, si existe. */
  weight?: number;
  /** Descripción del criterio tomada de la rúbrica configurada, si existe. */
  description?: string | null;
}

export interface TechnicalFeedbackItem {
  title: string;
  detail: string;
  severity: TechnicalFeedbackSeverity;
  file: string | null;
  line: number | null;
  codeSnippet: string;
  level: TechnicalFeedbackLevel;
  conceptExplanation: string;
}

export interface TechnicalFeedbackReport {
  security: TechnicalFeedbackItem[];
  architecture: TechnicalFeedbackItem[];
  quality: TechnicalFeedbackItem[];
  rubricCompliance: TechnicalFeedbackItem[];
}

export type BuilderCoachingPassReadiness = "BLOCKED" | "READY_WITH_SUGGESTIONS";

export interface BuilderReportCoaching {
  passReadiness: BuilderCoachingPassReadiness;
  mustFix: TechnicalFeedbackItem[];
  shouldImprove: TechnicalFeedbackItem[];
  strengths: TechnicalFeedbackItem[];
  nextAttemptChecklist: string[];
}

export type PedagogicalNarrativeKind = "success" | "gap" | "bridge" | "action";

export interface BuilderPedagogicalNarrativeItem {
  kind: PedagogicalNarrativeKind;
  content: string;
}

export interface BuilderTeacherHighlights {
  strengths: string[];
  concerns: string[];
  followUp: string[];
}

export interface BuilderReportEntity {
  readableText?: string;
  llmRecommendations?: string[];
  overallOutcome?: "PASS" | "FAIL" | "PARTIAL" | "UNKNOWN";
  technicalFeedback?: TechnicalFeedbackReport;
  coaching?: BuilderReportCoaching;
  learningObjective?: string;
  professionalVerdict?: string;
  pedagogicalNarrative?: BuilderPedagogicalNarrativeItem[];
  teacherHighlights?: BuilderTeacherHighlights;
  printableMarkdown?: string;
}

export interface BuildRunEntity {
  id: string;
  deliveryId: string;
  triggeredById: string;
  status: BuildRunStatus;
  latestEventSequence?: number | null;
  isTerminal: boolean;
  llmAssessment?: {
    structuralType?: string;
    evaluativeState?: string;
    confidence?: string;
    rationale?: string;
    recommendedGrade?: number;
    gradeBreakdown?: RubricGradeItem[];
    studentSummary?: string;
    teacherSummary?: string;
    evidenceSummary?: string;
    observedEvidence?: string[];
    evaluationLimits?: string[];
    runtime?: {
      family: BuilderRuntimeFamily;
      version?: string | null;
      supported?: boolean;
      reason?: string | null;
    };
    capabilities?: Record<
      string,
      {
        status: string;
        rationale: string;
      }
    >;
    recipe?: unknown;
  } | null;
  report?: BuilderReportEntity | null;
  reportSummary: BuildRunReportSummary;
  failureReason?: string | null;
  warnings: string[];
  inputTokens?: number;
  outputTokens?: number;
  executionCostUsd?: number;
  startedAt?: string | null;
  finishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EnqueueBuildRunResponse {
  buildRunId: string;
  status: BuildRunStatus;
  deliveryId: string;
}
