import type { BuildRunEntity } from "../../shared/types";

interface BuilderRunsTableProps {
  runs: BuildRunEntity[];
  busyAction: string | null;
  onSelectRun: (runId: string) => void;
}

export function BuilderRunsTable({
  runs,
  busyAction,
  onSelectRun,
}: BuilderRunsTableProps): JSX.Element {
  void busyAction; // kept for future "cancel from table" action
  return (
    <article className="card stack">
      <h3>Historial de runs</h3>
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
                <th>Status</th>
                <th>Etapa activa</th>
                <th>LLM</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id}>
                  <td>{run.id}</td>
                  <td>{run.status}</td>
                  <td>{run.activeStage ?? "n/a"}</td>
                  <td>
                    {run.llmAssessment?.evaluativeState ?? "n/a"}
                    {run.llmAssessment?.structuralType
                      ? ` · ${run.llmAssessment.structuralType}`
                      : ""}
                  </td>
                  <td>
                    <button
                      className="btn ghost"
                      onClick={() => onSelectRun(run.id)}
                    >
                      Ver
                    </button>
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
