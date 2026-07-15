import type { BuilderPreflightSummary } from "../../../features/builder/types";
import { PREFLIGHT_COMPATIBILITY_LABEL } from "./liveRunUtils";

interface PreflightSummaryPanelProps {
  preflightSummary: BuilderPreflightSummary;
}

/**
 * Detección automática previa al plan. Es información de apoyo, no el veredicto:
 * se compone en gris y sin jerarquía propia para no competir con la traza.
 */
export function PreflightSummaryPanel({
  preflightSummary,
}: PreflightSummaryPanelProps): JSX.Element {
  const runCommand = preflightSummary.resolvedCommands.run;

  return (
    <section className="mb-6 rounded-lg border border-app-border bg-app-bg-subtle/60 px-5 py-4">
      <div className="ui-label">Detección previa</div>
      <h3 className="mt-1.5 text-base font-semibold tracking-tight text-slate-900">
        {preflightSummary.supportedProjectType}
      </h3>
      <p className="mt-0.5 text-sm text-slate-500">
        {PREFLIGHT_COMPATIBILITY_LABEL[preflightSummary.compatibility] ??
          preflightSummary.compatibility}
        {" · perfil "}
        {preflightSummary.executionProfile}
        {" · gestor "}
        {preflightSummary.dependencyManager}
      </p>

      <dl className="mt-4 space-y-1.5">
        <div className="flex gap-2">
          <dt className="ui-label w-24 shrink-0 pt-0.5">Directorio</dt>
          <dd className="data-meta break-all text-slate-600">
            {preflightSummary.workingDirectory}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="ui-label w-24 shrink-0 pt-0.5">Comando</dt>
          <dd className="data-meta break-all text-slate-600">
            {runCommand ? runCommand.join(" ") : "sin comando"}
          </dd>
        </div>
      </dl>
    </section>
  );
}
