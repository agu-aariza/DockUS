import type { BuildRunEntity } from "../../features/builder/types";
import { DataTable, type Column } from "../../shared/components/ui/DataTable";
import { StatusBadge, type StatusTone } from "../../shared/components/ui/StatusBadge";
import { formatDate } from "../utils";

const STATUS_TONE: Record<string, StatusTone> = {
  SUCCESS: "success",
  FAILED: "danger",
  CANCELLED: "warning",
  RUNNING: "running",
  QUEUED: "pending",
};

function runStatusTone(status: string): StatusTone {
  return STATUS_TONE[status] ?? "idle";
}

interface BuilderRunsTableProps {
  runs: BuildRunEntity[];
  busyAction: string | null;
  selectedRunId?: string;
  loading?: boolean;
  onSelectRun: (runId: string) => void;
}

export function BuilderRunsTable({
  runs,
  busyAction,
  selectedRunId,
  loading = false,
  onSelectRun,
}: BuilderRunsTableProps): JSX.Element {
  void busyAction; // kept for future "cancel from table" action

  const columns: Column<BuildRunEntity>[] = [
    {
      header: "Ejecución",
      accessor: "id",
      sortable: true,
      sortValue: (run) => run.llmAssessment?.structuralType ?? "",
      className: "whitespace-normal",
      render: (run) => (
        <div>
          <div className="data-meta">{run.id.slice(0, 8)}</div>
          <div className="mt-1 text-sm font-medium text-slate-900">
            {run.llmAssessment?.structuralType ?? "Tipo no identificado"}
          </div>
        </div>
      ),
    },
    {
      header: "Estado",
      accessor: "status",
      sortable: true,
      sortValue: (run) => run.status,
      render: (run) => (
        <StatusBadge tone={runStatusTone(run.status)}>{run.status}</StatusBadge>
      ),
    },
    {
      header: "Tokens (In/Out)",
      accessor: "id",
      className: "text-sm text-slate-600 font-mono data-figure",
      render: (run) => (
        run.inputTokens !== undefined && run.inputTokens > 0 ? (
          <div>
            <span className="font-semibold text-slate-700">{run.inputTokens.toLocaleString()}</span>
            <span className="text-slate-400 mx-1">/</span>
            <span className="text-slate-500">{run.outputTokens?.toLocaleString() ?? 0}</span>
          </div>
        ) : (
          <span className="text-slate-400">-</span>
        )
      ),
    },
    {
      header: "Coste (USD)",
      accessor: "executionCostUsd",
      sortable: true,
      sortValue: (run) => run.executionCostUsd ?? 0,
      className: "text-sm text-slate-700 font-mono data-figure",
      render: (run) => (
        run.executionCostUsd !== undefined && run.executionCostUsd > 0 ? (
          <span className="text-success-600 font-semibold">
            ${run.executionCostUsd.toFixed(4)}
          </span>
        ) : (
          <span className="text-slate-400">-</span>
        )
      ),
    },
    {
      header: "Fecha",
      accessor: "createdAt",
      numeric: true,
      sortable: true,
      sortValue: (run) => new Date(run.createdAt).getTime(),
      render: (run) => <span className="data-meta">{formatDate(run.createdAt)}</span>,
    },
    {
      header: "Acción",
      accessor: "id",
      align: "right",
      render: (run) => (
        <button className="btn-secondary" onClick={() => onSelectRun(run.id)}>
          Ver ejecución
        </button>
      ),
    },
  ];

  return (
    <article className="min-w-0 rounded-lg border border-app-border bg-white">
      <div className="panel-header">
        <div>
          <h3 className="text-base font-semibold tracking-tight text-slate-900">
            Historial de ejecuciones
          </h3>
          <p className="section-copy">
            Selecciona una ejecución para inspeccionar su stream y los eventos
            persistidos.
          </p>
        </div>
      </div>

      <div className="p-6">
        {/* Tarjetas por debajo de 2xl: la tabla tiene demasiadas columnas para caber. */}
        <div className="space-y-3 2xl:hidden">
          {runs.length === 0 ? (
            <div className="rounded-md border border-dashed border-app-border bg-app-bg-subtle px-4 py-8 text-center text-sm text-slate-500">
              No hay runs cargados todavía para esta entrega.
            </div>
          ) : (
            runs.map((run) => (
              <button
                key={run.id}
                className={`card-interactive w-full rounded-md border px-4 py-4 text-left ${
                  selectedRunId === run.id
                    ? "border-accent/40 bg-accent-subtle"
                    : "border-app-border bg-white"
                }`}
                onClick={() => onSelectRun(run.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="data-meta">{run.id.slice(0, 8)}</div>
                    <div className="mt-1 text-sm font-medium text-slate-900">
                      {run.llmAssessment?.structuralType ?? "Tipo no identificado"}
                    </div>
                  </div>
                  <StatusBadge tone={runStatusTone(run.status)}>
                    {run.status}
                  </StatusBadge>
                </div>
                <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                  <div>Fecha: {formatDate(run.createdAt)}</div>
                  {run.inputTokens !== undefined && run.inputTokens > 0 && (
                    <div>Tokens: <span className="font-mono">{run.inputTokens.toLocaleString()} / {run.outputTokens?.toLocaleString() ?? 0}</span></div>
                  )}
                  {run.executionCostUsd !== undefined && run.executionCostUsd > 0 && (
                    <div>Coste: <span className="font-mono text-success-600 font-semibold">${run.executionCostUsd.toFixed(4)}</span></div>
                  )}
                </div>
              </button>
            ))
          )}
        </div>

        <div className="hidden 2xl:block">
          <DataTable
            caption="Historial de ejecuciones del builder"
            columns={columns}
            data={runs}
            loading={loading}
            keyExtractor={(run) => run.id}
            density="compact"
            stickyHeader
            maxHeight="28rem"
            rowClassName={(run) =>
              selectedRunId === run.id ? "bg-accent-subtle" : ""
            }
            emptyState={
              <div className="text-center text-sm text-slate-500">
                No hay runs cargados todavía para esta entrega.
              </div>
            }
          />
        </div>
      </div>
    </article>
  );
}
