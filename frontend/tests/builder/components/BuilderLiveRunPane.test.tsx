import assert from "node:assert/strict";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { BuilderLiveRunPane } from "../../../src/builder/components/BuilderLiveRunPane";
import type { BuildRunEntity } from "../../../src/shared/types";

function createRun(overrides: Partial<BuildRunEntity> = {}): BuildRunEntity {
  return {
    id: "run-live-1",
    deliveryId: "delivery-1",
    triggeredById: "teacher-1",
    runKind: "STANDARD",
    status: "ANALYZING",
    activeStage: "LLM_EVALUATION",
    isTerminal: false,
    warnings: [],
    createdAt: "2026-05-08T18:00:00.000Z",
    updatedAt: "2026-05-08T18:00:00.000Z",
    llmAssessment: {
      structuralType: "CLI",
      evaluativeState: "E2",
      confidence: "medium",
      rationale: "Se completo la fase principal de evaluacion.",
      evidenceSummary: "El sistema reunio evidencia parcial del comportamiento.",
      observedEvidence: ["El proceso respondio con codigo de salida 0."],
      evaluationLimits: [
        "No se pudo confirmar la cobertura de errores de entrada.",
      ],
      capabilities: {},
    },
    runtimeTarget: {
      projectId: "project-1",
      workspaceNetworkName: "workspace-net",
      executionNetworkName: "exec-net",
      primaryContainerId: "container-1234567890",
      helperContainerIds: [],
    },
    ...overrides,
  };
}

test("BuilderLiveRunPane muestra streamError, evidencia curada y estado vacio de artefactos", () => {
  const html = renderToStaticMarkup(
    <BuilderLiveRunPane
      selectedRun={createRun()}
      liveEvents={[]}
      streamState="polling"
      streamError="SSE timeout"
      evidenceArtifacts={[]}
      evidenceLoading={false}
      evidenceError={null}
      downloadingArtifactId={null}
      onDownloadArtifact={() => {}}
      onRefresh={() => {}}
      onCancel={() => {}}
      busyAction={null}
    />,
  );

  assert.match(html, /SSE timeout/);
  assert.match(html, /Que observo el sistema/);
  assert.match(html, /El proceso respondio con codigo de salida 0\./);
  assert.match(html, /Lo que no pudo validar/);
  assert.match(
    html,
    /Las evidencias descargables apareceran conforme avance la ejecucion\./,
  );
});

test("BuilderLiveRunPane renderiza la seccion de evidencias con artefactos descargables", () => {
  const html = renderToStaticMarkup(
    <BuilderLiveRunPane
      selectedRun={createRun({ status: "SUCCESS", isTerminal: true })}
      liveEvents={[]}
      streamState="streaming"
      streamError={null}
      evidenceArtifacts={[
        {
          id: "artifact-1",
          type: "BUILD_LOG",
          contentType: "text/plain",
          sizeBytes: 2048,
          createdAt: "2026-05-08T18:04:00.000Z",
        },
      ]}
      evidenceLoading={false}
      evidenceError={null}
      downloadingArtifactId={null}
      onDownloadArtifact={() => {}}
      onRefresh={() => {}}
      onCancel={() => {}}
      busyAction={null}
    />,
  );

  assert.match(html, /Evidencias del run/);
  assert.match(html, /Build log/);
  assert.match(html, /Descargar/);
});
