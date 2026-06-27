import type { TechnicalFeedbackItem, TechnicalFeedbackLevel, TechnicalFeedbackSeverity } from "../../features/builder/types";

const VALID_SEVERITIES = new Set<TechnicalFeedbackSeverity>([
  "low",
  "medium",
  "high",
]);

const VALID_LEVELS = new Set<TechnicalFeedbackLevel>([
  "basico",
  "intermedio",
  "avanzado",
]);

export function normalizeTechnicalFeedbackItem(
  item: Partial<TechnicalFeedbackItem> | null | undefined,
): TechnicalFeedbackItem {
  const severity = VALID_SEVERITIES.has(item?.severity as TechnicalFeedbackSeverity)
    ? (item?.severity as TechnicalFeedbackSeverity)
    : "medium";
  const level = VALID_LEVELS.has(item?.level as TechnicalFeedbackLevel)
    ? (item?.level as TechnicalFeedbackLevel)
    : "basico";

  return {
    title:
      typeof item?.title === "string" && item.title.trim()
        ? item.title
        : "Observacion tecnica",
    detail: typeof item?.detail === "string" ? item.detail : "",
    severity,
    file:
      typeof item?.file === "string" && item.file.trim() ? item.file : null,
    line: typeof item?.line === "number" ? item.line : null,
    codeSnippet:
      typeof item?.codeSnippet === "string" ? item.codeSnippet : "",
    level,
    conceptExplanation:
      typeof item?.conceptExplanation === "string"
        ? item.conceptExplanation
        : "",
  };
}
