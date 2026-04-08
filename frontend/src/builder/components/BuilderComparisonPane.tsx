import { JsonResult } from "../../shared/components/JsonResult";
import type { BuildRunComparisonResponse, BuildRunEntity } from "../../shared/types";

interface BuilderComparisonPaneProps {
  runs: BuildRunEntity[];
  compareBaseId: string;
  compareCandidateId: string;
  comparison: BuildRunComparisonResponse | null;
  busyAction: string | null;
  onBaseChange: (value: string) => void;
  onCandidateChange: (value: string) => void;
  onCompare: () => void;
}

export function BuilderComparisonPane({
  runs,
  compareBaseId,
  compareCandidateId,
  comparison,
  busyAction,
  onBaseChange,
  onCandidateChange,
  onCompare,
}: BuilderComparisonPaneProps): JSX.Element {
  return (
    <article className="card stack">
      <h3>Comparador técnico</h3>
      <div className="grid two-col">
        <label>
          Run base
          <select value={compareBaseId} onChange={(event) => onBaseChange(event.target.value)}>
            <option value="">--</option>
            {runs.map((run) => (
              <option key={`base-${run.id}`} value={run.id}>
                {run.id} · {run.status} · {run.runKind}
              </option>
            ))}
          </select>
        </label>
        <label>
          Run candidato
          <select
            value={compareCandidateId}
            onChange={(event) => onCandidateChange(event.target.value)}
          >
            <option value="">--</option>
            {runs.map((run) => (
              <option key={`candidate-${run.id}`} value={run.id}>
                {run.id} · {run.status} · {run.runKind}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="row gap-8">
        <button
          className="btn"
          disabled={!compareBaseId || !compareCandidateId || busyAction === "compare"}
          onClick={onCompare}
        >
          Comparar runs
        </button>
      </div>
      {comparison ? (
        <>
          <div className="message info">
            <strong>{comparison.overallVerdict}</strong> ·{" "}
            {comparison.comparison.technicalSummary}
          </div>
          <div className="grid two-col">
            <section className="builder-summary-card">
              <h4>Capacidades</h4>
              <ul className="builder-summary-list">
                {comparison.comparison.capabilityDelta.map((delta) => (
                  <li key={delta.capabilityId}>
                    {delta.capabilityId}: {delta.baseStatus} → {delta.candidateStatus} (
                    {delta.change})
                  </li>
                ))}
              </ul>
            </section>
            <section className="builder-summary-card">
              <h4>Etapas</h4>
              <ul className="builder-summary-list">
                {comparison.comparison.stageDelta.map((delta) => (
                  <li key={delta.stage}>
                    {delta.stage}: {delta.baseStatus} → {delta.candidateStatus} (
                    {delta.change})
                  </li>
                ))}
              </ul>
            </section>
          </div>
          <JsonResult title="Comparación técnica" value={comparison} />
        </>
      ) : (
        <p className="hint">
          Selecciona dos runs terminales de la misma entrega para compararlos.
        </p>
      )}
    </article>
  );
}
