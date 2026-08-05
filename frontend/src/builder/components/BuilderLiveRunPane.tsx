/**
 * @fileoverview Panel de visualización de ejecuciones del motor Builder en tiempo real.
 *
 * @description
 * Renderiza la consola en vivo, la línea de tiempo de eventos SSE, la evaluación del modelo de IA,
 * los hallazgos de código estático y los artefactos de evidencia técnica adjuntos a una ejecución `BuildRun`.
 *
 * @module BuilderLiveRunPane
 */

import { useEffect, useMemo, useState } from "react";
import type {
  BuildRunEntity,
  BuildRunEvent,
  EvidenceArtifactDto,
} from "../../features/builder/types";
import type { StreamState } from "../hooks/useBuilderRunStream";
import { Button } from "../../shared/components/ui/Button";
import { Card } from "../../shared/components/ui/Layout";
import { StatusBadge } from "../../shared/components/ui/StatusBadge";
import { Tabs } from "../../shared/components/ui/Tabs";
import {
  EvidenceSection,
  type PreviewedArtifact,
} from "./live-run/EvidenceSection";
import { LiveConsolePanel } from "./live-run/LiveConsolePanel";
import { LlmAssessmentPanel } from "./live-run/LlmAssessmentPanel";
import { RunMetaBar } from "./live-run/RunMetaBar";
import { RunStatusStrip } from "./live-run/RunStatusStrip";
import { TimelinePanel } from "./live-run/TimelinePanel";
import { normalizeItems } from "./live-run/liveRunUtils";

type LiveRunTab = "live" | "evidence";

interface BuilderLiveRunPaneProps {
  selectedRun: BuildRunEntity | null;
  liveEvents: BuildRunEvent[];
  streamState: StreamState;
  streamError?: string | null;
  evidenceArtifacts?: EvidenceArtifactDto[];
  evidenceLoading?: boolean;
  evidenceError?: string | null;
  downloadingArtifactId?: string | null;
  previewingArtifact?: PreviewedArtifact | null;
  previewLoading?: string | null;
  onPreviewArtifact?: (artifactId: string) => void;
  onClosePreview?: () => void;
  onDownloadArtifact?: (artifactId: string) => void;
  onRefresh: () => void;
  onCancel: () => void;
  busyAction: string | null;
}

function buildConsoleOutput(liveEvents: BuildRunEvent[]): string {
  return liveEvents
    .filter((event) => event.eventType === "LOG_CHUNK")
    .map((event) =>
      typeof event.payload?.text === "string" ? event.payload.text : "",
    )
    .filter(Boolean)
    .reverse()
    .join("");
}

function buildEvidenceEmptyMessage(
  selectedRun: BuildRunEntity | null,
): string | null {
  if (!selectedRun) {
    return null;
  }

  if (!selectedRun.isTerminal) {
    return "Las evidencias descargables aparecerán conforme avance la ejecución.";
  }

  const evaluationLimits = normalizeItems(
    selectedRun.llmAssessment?.evaluationLimits,
  );

  return selectedRun.status === "FAILED" || evaluationLimits.length > 0
    ? "El run terminó con límites o fallos y no generó artefactos descargables."
    : "Este run terminó sin artefactos descargables.";
}

export function BuilderLiveRunPane({
  selectedRun,
  liveEvents,
  streamState,
  streamError = null,
  evidenceArtifacts = [],
  evidenceLoading = false,
  evidenceError = null,
  downloadingArtifactId = null,
  previewingArtifact = null,
  previewLoading = null,
  onPreviewArtifact,
  onClosePreview,
  onDownloadArtifact,
  onRefresh,
  onCancel,
  busyAction,
}: BuilderLiveRunPaneProps): JSX.Element {
  const [activeTab, setActiveTab] = useState<LiveRunTab>("live");
  // liveEvents crece con cada frame SSE (mergeEvents reordena el array
  // entero); sin memoizar, cada render no relacionado con la consola volvía
  // a recorrerlo completo dos veces.
  const consoleOutput = useMemo(
    () => buildConsoleOutput(liveEvents),
    [liveEvents],
  );
  const timelineEvents = useMemo(
    () => liveEvents.filter((event) => event.eventType !== "LOG_CHUNK"),
    [liveEvents],
  );

  // Al cambiar de run se vuelve a la vista en vivo: si no, quedarías mirando la pestaña
  // de evidencias con los artefactos de la ejecución anterior.
  const selectedRunId = selectedRun?.id;
  useEffect(() => {
    setActiveTab("live");
    onClosePreview?.();
    // `onClosePreview` se omite a propósito: solo debe dispararse al cambiar de run.
  }, [selectedRunId]);

  return (
    <Card
      title="Ejecución en vivo"
      className="min-w-0"
      headerAction={
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone={streamState === "streaming" ? "success" : "warning"}>
            {streamState}
          </StatusBadge>
          <Button variant="ghost" disabled={!selectedRun} onClick={onRefresh}>
            Refrescar
          </Button>
          <Button
            variant="danger"
            disabled={
              !selectedRun || selectedRun.isTerminal || busyAction === "cancel"
            }
            onClick={onCancel}
          >
            Cancelar
          </Button>
        </div>
      }
    >
      <RunMetaBar selectedRun={selectedRun} />

      {selectedRun ? (
        <>
          {streamError ? (
            <div className="mb-6 rounded-md border border-danger/30 bg-danger-subtle px-4 py-3 text-sm text-danger">
              El stream en vivo falló: {streamError}. El panel sigue actualizándose por
              sondeo; puedes refrescar a mano.
            </div>
          ) : null}

          <RunStatusStrip selectedRun={selectedRun} />

          <Tabs
            className="mb-6"
            activeTab={activeTab}
            onTabChange={(tab) => setActiveTab(tab as LiveRunTab)}
            tabs={[
              { id: "live", label: "En vivo" },
              {
                id: "evidence",
                label: "Evidencias",
                badge: evidenceArtifacts.length,
              },
            ]}
          />

          {activeTab === "live" ? (
            <>
              {selectedRun.llmAssessment ? (
                <LlmAssessmentPanel assessment={selectedRun.llmAssessment} />
              ) : null}

              <div className="grid gap-6 2xl:grid-cols-[0.95fr_1.05fr]">
                <LiveConsolePanel
                  consoleOutput={consoleOutput}
                  streamState={streamState}
                />
                <TimelinePanel events={timelineEvents} />
              </div>
            </>
          ) : (
            <EvidenceSection
              isTerminal={selectedRun.isTerminal}
              emptyMessage={buildEvidenceEmptyMessage(selectedRun)}
              artifacts={evidenceArtifacts}
              loading={evidenceLoading}
              error={evidenceError}
              downloadingArtifactId={downloadingArtifactId}
              previewingArtifact={previewingArtifact}
              previewLoading={previewLoading}
              onPreviewArtifact={onPreviewArtifact}
              onClosePreview={onClosePreview}
              onDownloadArtifact={onDownloadArtifact}
            />
          )}
        </>
      ) : (
        <div className="rounded-md border border-dashed border-app-border bg-app-bg px-4 py-10 text-center text-sm text-slate-500">
          Selecciona una ejecución del historial para abrir su consola y su traza.
        </div>
      )}
    </Card>
  );
}
