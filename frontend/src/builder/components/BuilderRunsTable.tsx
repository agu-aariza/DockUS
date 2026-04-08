import type { BuildRunEntity } from "../../shared/types";

interface BuilderRunsTableProps {
  runs: BuildRunEntity[];
  busyAction: string | null;
  onSelectRun: (runId: string) => void;
  onSelectBase: (runId: string) => void;
  onSelectCandidate: (runId: string) => void;
  onReplay: (runId: string) => void;
}

export function BuilderRunsTable({
  runs,
  busyAction,
  onSelectRun,
  onSelectBase,
  onSelectCandidate,
  onReplay,
}: BuilderRunsTableProps): JSX.Element {
  return (
    <article className="card stack">
      <h3>Runs</h3>
      {runs.length === 0 ? (
        <p className="hint">
          No hay runs cargados. Indica una entrega y usa "Cargar historial".
        </p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Tipo</th>
                <th>Status</th>
                <th>Activo</th>
                <th>LLM</th>
                <th>Repro</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id}>
                  <td>{run.id}</td>
                  <td>{run.runKind}</td>
                  <td>{run.status}</td>
                  <td>{run.activeStage ?? "n/a"}</td>
                  <td>
                    {run.llmAssessment?.evaluativeState ?? "n/a"}
                    {run.llmAssessment?.structuralType
                      ? ` · ${run.llmAssessment.structuralType}`
                      : ""}
                  </td>
                  <td>{run.reproducibilityResult?.overallStatus ?? "n/a"}</td>
                  <td>
                    <div className="row gap-8">
                      <button className="btn ghost" onClick={() => onSelectRun(run.id)}>
                        Ver
                      </button>
                      <button className="btn ghost" onClick={() => onSelectBase(run.id)}>
                        Base
                      </button>
                      <button
                        className="btn ghost"
                        onClick={() => onSelectCandidate(run.id)}
                      >
                        Candidate
                      </button>
                      <button
                        className="btn"
                        disabled={
                          busyAction === `replay:${run.id}` ||
                          !run.isTerminal ||
                          run.runKind !== "STANDARD"
                        }
                        onClick={() => onReplay(run.id)}
                      >
                        Frozen replay
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}
