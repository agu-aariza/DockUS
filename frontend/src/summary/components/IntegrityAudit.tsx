/**
 * @fileoverview Panel de resumen y analíticas generales docentes (IntegrityAudit).
 *
 * @module IntegrityAudit
 */

import { useState } from "react";
import {
  RiArrowDownSLine,
  RiLoader4Line,
  RiRefreshLine,
  RiShieldCheckLine,
} from "react-icons/ri";
import type {
  ProjectOperationalIssuesReconcileResult as SyncResult,
  ProjectOperationalIssuesSummary,
} from "../../features/projects/types";
import { Button } from "../../shared/components/ui/Button";
import { DataTable } from "../../shared/components/ui/DataTable";
import { StatusBadge, type StatusTone } from "../../shared/components/ui/StatusBadge";

interface IntegrityAuditProps {
  issues: ProjectOperationalIssuesSummary | null;
  syncPreview: SyncResult | null;
  syncing: "dry-run" | "apply" | null;
  onValidate: () => void;
  onRequestSync: () => void;
}

/**
 * Herramienta de mantenimiento, no de docencia: vive plegada y solo se abre cuando
 * el profesor la busca. La cabecera resume el veredicto en una línea.
 */
export function IntegrityAudit({
  issues,
  syncPreview,
  syncing,
  onValidate,
  onRequestSync,
}: IntegrityAuditProps): JSX.Element {
  const [expanded, setExpanded] = useState(false);

  const counts = issues?.counts;
  const checks = counts
    ? [
        { label: "Asignaciones huérfanas", value: counts.orphanAssignments, critical: true },
        { label: "Entregas huérfanas", value: counts.orphanDeliveries, critical: true },
        { label: "Storage sin padre", value: counts.orphanStorageObjects, critical: false },
        { label: "Asignaciones revocadas", value: counts.revokedAssignments, critical: false },
        { label: "Entregas tardías", value: counts.lateDeliveries, critical: false },
        { label: "Sin nota", value: counts.ungradedEvaluatedDeliveries, critical: false },
      ]
    : [];

  const affected = checks.filter((check) => check.value > 0);
  const hasCritical = affected.some((check) => check.critical);

  return (
    <section className="rounded-lg border border-app-border bg-white">
      <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <button
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={expanded}
          className="group flex min-w-0 items-center gap-3 text-left"
        >
          <RiArrowDownSLine
            className={`shrink-0 text-lg text-slate-400 transition-transform duration-[--motion-standard] ${expanded ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-900 group-hover:text-accent">
              Integridad de datos
            </h2>
            <p className="truncate text-sm text-slate-500">{summarize(issues, affected.length, hasCritical)}</p>
          </div>
        </button>

        <div className="flex shrink-0 items-center gap-2">
          <Button variant="secondary" size="sm" onClick={onValidate} disabled={syncing !== null}>
            {syncing === "dry-run" ? (
              <RiLoader4Line className="animate-spin" />
            ) : (
              <RiShieldCheckLine />
            )}
            Validar
          </Button>
          <Button variant="danger" size="sm" onClick={onRequestSync} disabled={syncing !== null}>
            <RiRefreshLine className={syncing === "apply" ? "animate-spin" : ""} />
            Sincronizar
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="motion-rise-in space-y-5 border-t border-app-border px-5 py-4">
          {issues ? (
            <>
              <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
                {checks.map((check) => (
                  <div
                    key={check.label}
                    className="flex items-baseline justify-between gap-3 border-b border-app-border-subtle py-1.5"
                  >
                    <dt className="text-sm text-slate-600">{check.label}</dt>
                    <dd
                      className={`data-figure text-sm font-semibold ${
                        check.value === 0
                          ? "text-slate-300"
                          : check.critical
                            ? "text-danger"
                            : "text-warning"
                      }`}
                    >
                      {check.value}
                    </dd>
                  </div>
                ))}
              </dl>

              {issues.issues.length > 0 && (
                <div className="space-y-2">
                  <h3 className="ui-label">Incidencias destacadas</h3>
                  <ul className="grid gap-2 lg:grid-cols-2">
                    {issues.issues.map((issue) => (
                      <li
                        key={issue.id}
                        className="rounded-md border border-app-border bg-app-bg-subtle/60 p-3"
                      >
                        <div className="mb-1 flex items-start justify-between gap-3">
                          <span className="text-sm font-medium text-slate-900">{issue.title}</span>
                          <StatusBadge tone={issue.severity === "error" ? "danger" : "warning"}>
                            {issue.severity === "error" ? "Crítico" : "Aviso"}
                          </StatusBadge>
                        </div>
                        <p className="line-clamp-2 text-sm text-slate-500">{issue.detail}</p>
                        <div className="data-meta mt-2 text-slate-400">
                          {issue.category}
                          {issue.projectTitle ? ` · ${issue.projectTitle}` : ""}
                          {issue.createdAt
                            ? ` · ${new Date(issue.createdAt).toLocaleString("es-ES")}`
                            : ""}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <p className="rounded-md border border-dashed border-slate-300 bg-app-bg-subtle p-6 text-center text-sm text-slate-500">
              No se pudo leer el estado de integridad. Vuelve a validar para reintentarlo.
            </p>
          )}

          {syncPreview && <SyncPreview preview={syncPreview} />}
        </div>
      )}
    </section>
  );
}

function summarize(
  issues: ProjectOperationalIssuesSummary | null,
  affectedCount: number,
  hasCritical: boolean,
): string {
  if (!issues) return "Estado desconocido. Valida para comprobarlo.";
  if (affectedCount === 0) return "6 comprobaciones, ninguna incidencia.";
  const noun = affectedCount === 1 ? "comprobación" : "comprobaciones";
  const severity = hasCritical ? "incluida alguna crítica" : "ninguna crítica";
  return `${affectedCount} ${noun} con incidencias, ${severity}.`;
}

function SyncPreview({ preview }: { preview: SyncResult }): JSX.Element {
  return (
    <div className="rounded-md border border-app-border bg-app-bg-subtle/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">
          {preview.mode === "apply" ? "Sincronización aplicada" : "Simulación de sincronización"}
        </h3>
        <StatusBadge tone="info">
          {preview.actions.length} {preview.actions.length === 1 ? "acción" : "acciones"}
        </StatusBadge>
      </div>

      <dl className="grid gap-3 sm:grid-cols-3">
        {(["orphanAssignments", "orphanDeliveries", "orphanStorageObjects"] as const).map(
          (category) => (
            <div key={category} className="rounded-md border border-app-border bg-white p-3">
              <dt className="ui-label">{category}</dt>
              <dd className="data-figure mt-1 text-lg font-semibold">
                {preview.applied[category]}
                <span className="text-slate-300"> / </span>
                {preview.matched[category]}
              </dd>
              <p className="text-xs text-slate-400">Aplicadas / Detectadas</p>
            </div>
          ),
        )}
      </dl>

      {preview.actions.length > 0 && (
        <DataTable
          className="mt-3"
          caption="Acciones detectadas por la reconciliación"
          density="compact"
          stickyHeader
          maxHeight="15rem"
          data={preview.actions}
          keyExtractor={(action) => `${action.targetId}-${action.action}-${action.category}`}
          columns={[
            {
              header: "Acción",
              accessor: "action",
              sortable: true,
              sortValue: (action) => action.action,
            },
            {
              header: "Categoría",
              accessor: "category",
              sortable: true,
              sortValue: (action) => action.category,
              className: "text-slate-500",
            },
            {
              header: "Resultado",
              accessor: "outcome",
              sortable: true,
              sortValue: (action) => action.outcome,
              render: (action) => (
                <StatusBadge
                  tone={
                    (action.outcome === "applied"
                      ? "success"
                      : action.outcome === "would_apply"
                        ? "info"
                        : "idle") as StatusTone
                  }
                >
                  {action.outcome}
                </StatusBadge>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
