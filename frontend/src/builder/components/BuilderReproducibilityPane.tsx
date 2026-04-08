import { JsonResult } from "../../shared/components/JsonResult";
import type { BuildRunEntity } from "../../shared/types";

interface BuilderReproducibilityPaneProps {
  selectedRun: BuildRunEntity | null;
}

export function BuilderReproducibilityPane({
  selectedRun,
}: BuilderReproducibilityPaneProps): JSX.Element {
  return (
    <article className="card stack">
      <h3>Reproducibilidad</h3>
      {selectedRun?.reproducibilityResult ? (
        <>
          <div className="message info">
            <strong>{selectedRun.reproducibilityResult.overallStatus}</strong> ·{" "}
            {selectedRun.reproducibilityResult.summary}
          </div>
          <div className="builder-summary-card">
            <ul className="builder-summary-list">
              {selectedRun.reproducibilityResult.checks.map((check) => (
                <li key={check.id}>
                  {check.id}: {check.status}
                </li>
              ))}
            </ul>
          </div>
          <JsonResult
            title="Resultado de reproducibilidad"
            value={selectedRun.reproducibilityResult}
          />
        </>
      ) : selectedRun?.runKind === "STANDARD" && selectedRun.isTerminal ? (
        <p className="hint">
          Este run estándar puede relanzarse como frozen replay desde la tabla.
        </p>
      ) : (
        <p className="hint">
          Selecciona un frozen replay o un run terminal estándar para trabajar la
          reproducibilidad.
        </p>
      )}
    </article>
  );
}
