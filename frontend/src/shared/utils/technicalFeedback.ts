/**
 * @fileoverview Utilidad de apoyo de interfaz (technicalFeedback).
 *
 * @module technicalFeedback
 */

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

/** Partes del `detail` que el contrato pide al evaluador, ya separadas. */
export interface FindingDetailParts {
  observation: string;
  impact: string;
  recommendation: string;
}

/**
 * El contrato pide el detalle como "Observación: … Impacto: … Recomendación: …"
 * y la UI lo pintaba como un párrafo corrido, dejando lo accionable —la
 * recomendación— enterrado al final. Si el modelo no respeta el formato, todo
 * el texto se devuelve como observación y no se pierde nada.
 */
export function splitFindingDetail(detail: string): FindingDetailParts {
  const pattern =
    /Observaci[oó]n:\s*(.*?)\s*(?:Impacto:\s*(.*?)\s*)?(?:Recomendaci[oó]n:\s*(.*))?$/isu;
  const match = pattern.exec(detail.trim());

  if (!match) {
    return { observation: detail.trim(), impact: "", recommendation: "" };
  }

  return {
    observation: (match[1] ?? "").trim(),
    impact: (match[2] ?? "").trim(),
    recommendation: (match[3] ?? "").trim(),
  };
}

/**
 * Agrupa los hallazgos que apuntan al mismo `archivo:línea`. El evaluador suele
 * partir un mismo defecto en dos o tres tarjetas (p. ej. dos observaciones
 * sobre `contar_palabras` en `cadenas.c:50`), y al alumno le llegan como
 * problemas independientes. Los que no tienen ubicación no se agrupan: sin
 * archivo ni línea no hay forma de saber si hablan de lo mismo.
 */
export function groupFindingsByLocation(
  items: TechnicalFeedbackItem[],
): Array<{ item: TechnicalFeedbackItem; related: TechnicalFeedbackItem[] }> {
  const groups: Array<{
    item: TechnicalFeedbackItem;
    related: TechnicalFeedbackItem[];
  }> = [];
  const indexByLocation = new Map<string, number>();

  for (const item of items) {
    const location =
      item.file && item.line ? `${item.file}:${item.line}` : null;

    if (!location) {
      groups.push({ item, related: [] });
      continue;
    }

    const existing = indexByLocation.get(location);
    if (existing === undefined) {
      indexByLocation.set(location, groups.length);
      groups.push({ item, related: [] });
      continue;
    }

    groups[existing].related.push(item);
  }

  return groups;
}

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
        : "Observación técnica",
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
