import assert from "node:assert/strict";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { ReportView } from "../../../src/shared/components/ReportView";
import type { BuildRunEntity } from "../../../src/shared/types";

function createRun(): BuildRunEntity {
  return {
    id: "run-1",
    deliveryId: "delivery-1",
    triggeredById: "teacher-1",
    runKind: "STANDARD",
    status: "SUCCESS",
    isTerminal: true,
    warnings: [],
    createdAt: "2026-05-08T18:00:00.000Z",
    updatedAt: "2026-05-08T18:00:00.000Z",
    startedAt: "2026-05-08T18:00:00.000Z",
    finishedAt: "2026-05-08T18:05:00.000Z",
    llmAssessment: {
      structuralType: "CLI",
      evaluativeState: "E1",
      confidence: "high",
      rationale: "El sistema pudo ejecutar el binario y comprobar la salida.",
      recommendedGrade: 8.5,
      evidenceSummary: "Se observo una ejecucion completa con salida consistente.",
      observedEvidence: ["El binario genera la salida esperada."],
      evaluationLimits: ["No se validaron condiciones de carga extrema."],
      capabilities: {},
    },
    evidenceArtifacts: [
      {
        id: "artifact-raw",
        type: "LLM_PLAN_PROMPT",
        contentType: "text/plain",
        sizeBytes: 256,
        createdAt: "2026-05-08T18:02:00.000Z",
      },
    ],
    report: {
      overallOutcome: "PASS",
      llmRecommendations: ["Documenta el comando de ejecucion final."],
      technicalFeedback: {
        security: [],
        architecture: [],
        quality: [],
        rubricCompliance: [],
      },
    },
  };
}

test("ReportView en modo student muestra evidencia curada sin exponer artefactos LLM", () => {
  const html = renderToStaticMarkup(
    <ReportView run={createRun()} mode="student" />,
  );

  assert.match(html, /Evidencia curada del analisis/);
  assert.match(html, /Que observo el sistema/);
  assert.match(html, /El binario genera la salida esperada\./);
  assert.match(html, /Lo que no pudo validar/);
  assert.match(html, /No se validaron condiciones de carga extrema\./);
  assert.doesNotMatch(html, /LLM_PLAN_PROMPT/);
});

test("ReportView en modo teacher mantiene visible el resumen curado", () => {
  const html = renderToStaticMarkup(
    <ReportView run={createRun()} mode="teacher" />,
  );

  assert.match(html, /Resumen del Run/);
  assert.match(html, /Evidencia curada del analisis/);
  assert.match(html, /Que observo el sistema/);
});
