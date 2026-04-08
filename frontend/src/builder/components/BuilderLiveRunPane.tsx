import { pretty } from "../../shared/utils/errors";
import type { BuildRunEntity, BuildRunEvent } from "../../shared/types";
import type { StreamState } from "../hooks/useBuilderRunStream";
import { formatDate, summarizeRun } from "../utils";

interface BuilderLiveRunPaneProps {
  selectedRun: BuildRunEntity | null;
  liveEvents: BuildRunEvent[];
  streamState: StreamState;
  onRefresh: () => void;
  onCancel: () => void;
  busyAction: string | null;
}

export function BuilderLiveRunPane({
  selectedRun,
  liveEvents,
  streamState,
  onRefresh,
  onCancel,
  busyAction,
}: BuilderLiveRunPaneProps): JSX.Element {
  return (
    <article className="card stack">
      <div className="panel-header">
        <h3>Run en vivo</h3>
        <div className="row gap-8 align-center">
          <span className={`pill ${streamState}`}>{streamState}</span>
          <button className="btn ghost" disabled={!selectedRun} onClick={onRefresh}>
            Refrescar
          </button>
          <button
            className="btn danger"
            disabled={!selectedRun || selectedRun.isTerminal || busyAction === "cancel"}
            onClick={onCancel}
          >
            Cancelar
          </button>
        </div>
      </div>
      <p className="hint">{summarizeRun(selectedRun)}</p>
      {selectedRun ? (
        <>
          <div className="grid two-col">
            <div className="builder-info">
              <strong>Creado</strong>
              <span>{formatDate(selectedRun.createdAt)}</span>
            </div>
            <div className="builder-info">
              <strong>Última etapa</strong>
              <span>{selectedRun.activeStage ?? "n/a"}</span>
            </div>
            <div className="builder-info">
              <strong>Inicio</strong>
              <span>{formatDate(selectedRun.startedAt)}</span>
            </div>
            <div className="builder-info">
              <strong>Fin</strong>
              <span>{formatDate(selectedRun.finishedAt)}</span>
            </div>
          </div>
          <div className="builder-timeline">
            {liveEvents.length === 0 ? (
              <p className="hint">Aún no hay eventos para este run.</p>
            ) : (
              liveEvents.map((event) => (
                <article className="builder-event" key={event.id}>
                  <div className="builder-event-head">
                    <strong>{event.eventType}</strong>
                    <span>
                      seq {event.sequence} · {formatDate(event.createdAt)}
                    </span>
                  </div>
                  <p>{event.message}</p>
                  <p className="hint">
                    {event.runStatus ?? "sin status"}
                    {event.stage ? ` · ${event.stage}` : ""}
                  </p>
                  {event.payload ? (
                    <pre className="builder-inline-json">{pretty(event.payload)}</pre>
                  ) : null}
                </article>
              ))
            )}
          </div>
        </>
      ) : (
        <p className="hint">Selecciona un run para abrir el timeline.</p>
      )}
    </article>
  );
}
