/**
 * @fileoverview Vista y gestión de entregas de código de alumnos (teacherReviewNavigation).
 *
 * @module teacherReviewNavigation
 */

import type { ProjectGradebookRow } from "../features/projects/types";

export type TeacherDeliveryDetailTab = "overview" | "grading" | "report";

interface TeacherDeliveryReviewPathInput {
  projectId: string;
  assignmentId: string;
  deliveryId: string;
  tab?: TeacherDeliveryDetailTab;
}

interface TeacherDeliveryReviewTarget {
  assignmentId: string;
  deliveryId: string;
}

interface LegacyAiEvidenceExtraction {
  manualNotes: string | null;
  legacyBlocks: string[];
  legacyRaw: string | null;
}

const LEGACY_AI_HEADER_REGEX = /^--- \[AI EVIDENCE - .*?\] ---$/gm;

export function buildTeacherDeliveryReviewPath(
  input: TeacherDeliveryReviewPathInput,
): string {
  const params = new URLSearchParams();
  params.set("projectId", input.projectId);
  params.set("assignmentId", input.assignmentId);
  params.set("deliveryId", input.deliveryId);
  params.set("tab", input.tab ?? "overview");
  return `/deliveries?${params.toString()}`;
}

export function normalizeTeacherDeliveryTab(
  value: string | null | undefined,
): TeacherDeliveryDetailTab {
  return value === "grading" || value === "report" ? value : "overview";
}

export function extractLegacyAiEvidence(
  graderNotes?: string | null,
): LegacyAiEvidenceExtraction {
  const normalized = graderNotes?.replace(/\r\n/g, "\n").trim() ?? "";
  if (!normalized) {
    return {
      manualNotes: null,
      legacyBlocks: [],
      legacyRaw: null,
    };
  }

  const matches = [...normalized.matchAll(LEGACY_AI_HEADER_REGEX)];
  if (matches.length === 0) {
    return {
      manualNotes: normalized,
      legacyBlocks: [],
      legacyRaw: null,
    };
  }

  const firstHeaderIndex = matches[0]?.index ?? 0;
  const manualNotes = normalized.slice(0, firstHeaderIndex).trim() || null;
  const legacyRaw = normalized.slice(firstHeaderIndex).trim() || null;

  const legacyBlocks = (legacyRaw ?? "")
    .split(/(?=^--- \[AI EVIDENCE - .*?\] ---$)/gm)
    .map((block) =>
      block.replace(/^--- \[AI EVIDENCE - .*?\] ---\s*/m, "").trim(),
    )
    .filter(Boolean);

  return {
    manualNotes,
    legacyBlocks,
    legacyRaw,
  };
}

export function mergeManualAndLegacyNotes(
  manualNotes?: string | null,
  legacyRaw?: string | null,
): string | undefined {
  const trimmedManual = manualNotes?.trim() ?? "";
  const trimmedLegacy = legacyRaw?.trim() ?? "";

  if (trimmedManual && trimmedLegacy) {
    return `${trimmedManual}\n\n${trimmedLegacy}`;
  }

  return trimmedManual || trimmedLegacy || undefined;
}

export function resolveTeacherReviewTarget(
  rows: ProjectGradebookRow[],
  studentId: string,
): TeacherDeliveryReviewTarget | null {
  const match = rows.find(
    (row) => row.studentId === studentId && row.latestDeliveryId,
  );
  if (!match?.latestDeliveryId) {
    return null;
  }

  return {
    assignmentId: match.assignmentId,
    deliveryId: match.latestDeliveryId,
  };
}
