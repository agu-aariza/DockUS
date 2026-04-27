import type { BuildRunEntity } from "../../shared/types";
import { formatDate } from "../utils";

const PREFLIGHT_COMPATIBILITY_LABEL: Record<string, string> = {
  SUPPORTED_AUTO: "auto",
  SUPPORTED_WITH_MANIFEST: "manifest",
  PARTIAL: "parcial",
  UNSUPPORTED: "bloqueado",
};

interface BuilderRunsTableProps {
  runs: BuildRunEntity[];
  busyAction: string | null;
  selectedRunId?: string;
  onSelectRun: (runId: string) => void;
}

export function BuilderRunsTable({
  runs,
  busyAction,
  selectedRunId,
  onSelectRun,
}: BuilderRunsTableProps): JSX.Element {
  void busyAction; // kept for future "cancel from table" action
  return (
    <article className="min-w-0 rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="panel-header">
        <div>
          <h3 className="text-lg font-semibold tracking-tight text-slate-950">
            Historial de ejecuciones
          </h3>
          <p className="section-copy">
            Selecciona una ejecución para inspeccionar su stream, su entorno y los eventos persistidos.
          </p>
        </div>
      </div>

      <div className="p-6">
      {runs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          No hay runs cargados todavía para esta entrega.
        </div>
      ) : (
        <>
          <div className="space-y-3 2xl:hidden">
            {runs.map((run) => (
              <button
                key={run.id}
                className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                  selectedRunId === run.id
                    ? "border-slate-300 bg-slate-50"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
                onClick={() => onSelectRun(run.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-mono text-xs text-slate-500">{run.id.slice(0, 8)}</div>
                    <div className="mt-1 text-sm font-medium text-slate-950">
                      {run.llmAssessment?.structuralType ?? "Tipo no identificado"}
                    </div>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                    {run.status}
                  </span>
                </div>
                <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                  <div>Etapa: {run.activeStage ?? "n/d"}</div>
                  <div>
                    Preflight:{" "}
                    {run.preflightSummary
                      ? PREFLIGHT_COMPATIBILITY_LABEL[run.preflightSummary.compatibility] ??
                        run.preflightSummary.compatibility
                      : "sin preflight"}
                  </div>
                  <div>Perfil: {run.preflightSummary?.executionProfile ?? "n/d"}</div>
                  <div>Namespace: {run.runtimeTarget?.namespace ?? "sin namespace"}</div>
                  <div>Pod: {run.runtimeTarget?.primaryPodName ?? "resolviéndose"}</div>
                  <div>Fecha: {formatDate(run.createdAt)}</div>
                </div>
              </button>
            ))}
          </div>

          <div className="hidden overflow-x-auto 2xl:block">
          <table className="min-w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-[0.16em] text-slate-500">
                <th className="px-3 py-3 font-medium">Ejecución</th>
                <th className="px-3 py-3 font-medium">Estado</th>
                <th className="px-3 py-3 font-medium">Preflight</th>
                <th className="px-3 py-3 font-medium">Etapa</th>
                <th className="px-3 py-3 font-medium">Entorno</th>
                <th className="px-3 py-3 font-medium">Fecha</th>
                <th className="px-3 py-3 font-medium text-right">Acción</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr
                  key={run.id}
                  className={`border-b border-slate-100 transition ${
                    selectedRunId === run.id ? "bg-slate-50" : "hover:bg-slate-50/80"
                  }`}
                >
                  <td className="px-3 py-4">
                    <div className="font-mono text-xs text-slate-600">{run.id.slice(0, 8)}</div>
                    <div className="mt-1 text-sm font-medium text-slate-950">
                      {run.llmAssessment?.structuralType ?? "Tipo no identificado"}
                    </div>
                  </td>
                  <td className="px-3 py-4">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                      {run.status}
                    </span>
                  </td>
                  <td className="px-3 py-4 text-sm text-slate-600">
                    <div>
                      {run.preflightSummary
                        ? PREFLIGHT_COMPATIBILITY_LABEL[run.preflightSummary.compatibility] ??
                          run.preflightSummary.compatibility
                        : "n/d"}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {run.preflightSummary?.executionProfile ?? "sin perfil"}
                    </div>
                  </td>
                  <td className="px-3 py-4 text-sm text-slate-600">
                    {run.activeStage ?? "n/d"}
                  </td>
                  <td className="px-3 py-4 text-sm text-slate-600">
                    <div>{run.runtimeTarget?.namespace ?? "sin namespace"}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {run.runtimeTarget?.primaryPodName ?? "pod resolviéndose"}
                    </div>
                  </td>
                  <td className="px-3 py-4 text-sm text-slate-600">
                    {formatDate(run.createdAt)}
                  </td>
                  <td className="px-3 py-4 text-right">
                    <button
                      className="btn-secondary"
                      onClick={() => onSelectRun(run.id)}
                    >
                      Ver ejecución
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}
      </div>
    </article>
  );
}
