/**
 * @fileoverview Componente de monitorización de ejecuciones SSE en vivo (liveRunUtils).
 *
 * @module liveRunUtils
 */

import type { BuildRunEntity } from "../../../features/builder/types";

export type LlmAssessment = NonNullable<BuildRunEntity["llmAssessment"]>;

export const cn = (...classes: (string | boolean | undefined)[]) =>
  classes.filter(Boolean).join(" ");

// Las etiquetas de la taxonomía del builder (estados, tipos, confianza) viven en
// shared/data/builderTaxonomy para que el informe y el visor en vivo digan lo mismo.
export { confidenceLabel } from "../../../shared/data/builderTaxonomy";

const ARTIFACT_LABELS: Record<string, string> = {
  BUILD_LOG: "Build log",
  RUNTIME_EVENTS: "Eventos del runtime",
  CONTAINER_INSPECT: "Estado del contenedor",
  CONTAINER_LOG: "Log del contenedor",
  TEST_LOG: "Log de tests",
  REPORT_TEXT: "Informe legible",
  REPORT_JSON: "Informe JSON",
  REPRODUCIBILITY_JSON: "Reproducibilidad",
  PREFLIGHT: "Preflight",
  CLASSIFICATION: "Clasificación",
  STRATEGY: "Estrategia",
  STATIC_FINDINGS: "Hallazgos estáticos",
  STATIC_REVIEW: "Revisión estática",
  LLM_PLAN_PROMPT: "Prompt del planner",
  LLM_PLAN_RAW_RESPONSE: "Respuesta bruta del planner",
  LLM_PLAN_PARSED: "Planner normalizado",
  LLM_PLAN_ERROR: "Error del planner",
  LLM_EVAL_PROMPT: "Prompt de evaluación",
  LLM_EVAL_RAW_RESPONSE: "Respuesta bruta de evaluación",
  LLM_EVAL_PARSED: "Evaluación normalizada",
  LLM_EVAL_ERROR: "Error de evaluación",
  LLM_QUALITY_PROMPT: "Prompt de calidad",
  LLM_QUALITY_RAW_RESPONSE: "Respuesta bruta de calidad",
  LLM_QUALITY_PARSED: "Calidad normalizada",
  LLM_QUALITY_ERROR: "Error de calidad",
};

const PREVIEWABLE_CONTENT_TYPES = new Set([
  "text/plain",
  "text/plain; charset=utf-8",
  "application/json",
  "application/json; charset=utf-8",
]);

export function isPreviewable(contentType: string): boolean {
  return PREVIEWABLE_CONTENT_TYPES.has(contentType.toLowerCase());
}

export function normalizeItems(values?: string[]): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return values.map((value) => value.trim()).filter(Boolean);
}

export function formatArtifactLabel(type: string): string {
  return ARTIFACT_LABELS[type] ?? type.replace(/_/g, " ");
}

export function formatBytes(sizeBytes: number): string {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }

  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Pretty-prints JSON content, falling back to the raw string when it does not parse. */
export function prettifyJson(content: string, contentType: string): string {
  if (!contentType.includes("json")) {
    return content;
  }

  try {
    return JSON.stringify(JSON.parse(content), null, 2);
  } catch {
    return content;
  }
}

export type GradeTone = "high" | "mid" | "low";

export function gradeTone(grade: number): GradeTone {
  if (grade >= 7) return "high";
  if (grade >= 5) return "mid";
  return "low";
}

export const GRADE_TEXT_CLASS: Record<GradeTone, string> = {
  high: "text-success",
  mid: "text-warning",
  low: "text-danger",
};

const EVALUATIVE_STATE_TEXT_CLASS: Record<string, string> = {
  E1: "text-success-500",
  E2: "text-warning",
  E3: "text-warning-500",
};

export function evaluativeStateTextClass(state?: string): string {
  return (state && EVALUATIVE_STATE_TEXT_CLASS[state]) ?? "text-rose-500";
}
