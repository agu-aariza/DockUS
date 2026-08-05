/**
 * @fileoverview Componente de perfil y expediente del alumno (StudentProjectTimeline).
 *
 * @module StudentProjectTimeline
 */

import { useState } from "react";
import {
  RiArrowDownSLine,
  RiArrowRightSLine,
  RiStackLine,
} from "react-icons/ri";
import { SectionCard } from "../../shared/components/ui/Layout";
import { StatusBadge } from "../../shared/components/ui/StatusBadge";
import { EmptyState } from "../../shared/components/EmptyState";
import { DeliveryStatusBadge } from "../../features/deliveries/components/DeliveryStatusBadge";
import type {
  StudentProfileDelivery,
  StudentProfileProject,
  StudentProfileRun,
} from "../../features/students/types";

const RUN_TONE: Record<StudentProfileRun["status"], "success" | "danger" | "running" | "idle"> = {
  SUCCESS: "success",
  FAILED: "danger",
  RUNNING: "running",
  QUEUED: "idle",
  CANCELLED: "idle",
};

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const formatGrade = (grade: number | null) =>
  grade === null ? null : grade.toFixed(2).replace(".", ",");

interface StudentProjectTimelineProps {
  projects: StudentProfileProject[];
  /** Solo el profesor puede abrir el código de una entrega. */
  onOpenDelivery?: (deliveryId: string) => void;
}

export function StudentProjectTimeline({
  projects,
  onOpenDelivery,
}: StudentProjectTimelineProps): JSX.Element {
  if (projects.length === 0) {
    return (
      <SectionCard title="Historial">
        <EmptyState
          icon={<RiStackLine className="text-3xl text-app-text-muted" />}
          title="Sin proyectos asignados"
          description="Cuando el alumno tenga proyectos asignados aparecerán aquí con sus entregas y ejecuciones."
        />
      </SectionCard>
    );
  }

  return (
    <div className="space-y-6">
      {projects.map((project) => (
        <SectionCard
          key={project.id}
          title={project.title}
          description={
            project.teachers.length > 0
              ? `Equipo docente: ${project.teachers
                  .map((teacher) => `${teacher.firstName} ${teacher.lastName}`)
                  .join(", ")}`
              : "Sin equipo docente asignado"
          }
          headerAction={
            <div className="flex items-center gap-2">
              <StatusBadge tone={project.status === "ACTIVE" ? "success" : "idle"}>
                {project.status === "ACTIVE" ? "Activo" : project.status}
              </StatusBadge>
              {formatGrade(project.grade) ? (
                <span className="data-figure text-sm font-semibold">
                  {formatGrade(project.grade)}
                </span>
              ) : (
                <span className="text-xs text-app-text-muted">Sin nota</span>
              )}
            </div>
          }
        >
          {project.deliveries.length === 0 ? (
            <p className="py-2 text-sm text-app-text-secondary">
              El alumno todavía no ha entregado en este proyecto.
            </p>
          ) : (
            <ul className="-my-1 divide-y divide-app-border">
              {project.deliveries.map((delivery) => (
                <DeliveryRow
                  key={delivery.id}
                  delivery={delivery}
                  onOpenDelivery={onOpenDelivery}
                />
              ))}
            </ul>
          )}
        </SectionCard>
      ))}
    </div>
  );
}

function DeliveryRow({
  delivery,
  onOpenDelivery,
}: {
  delivery: StudentProfileDelivery;
  onOpenDelivery?: (deliveryId: string) => void;
}): JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const hasRuns = delivery.runs.length > 0;
  const grade = formatGrade(delivery.grade);

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          disabled={!hasRuns}
          aria-expanded={expanded}
          className="flex items-center gap-2 text-app-text-muted transition-colors hover:text-app-text-secondary disabled:opacity-40"
        >
          {expanded ? <RiArrowDownSLine /> : <RiArrowRightSLine />}
          <span className="data-figure text-sm font-semibold text-app-text">
            v{delivery.version}
          </span>
        </button>

        <DeliveryStatusBadge status={delivery.status} />
        {delivery.isLate && <StatusBadge tone="warning">Fuera de plazo</StatusBadge>}

        <span className="data-meta">{formatDateTime(delivery.createdAt)}</span>

        <span className="data-meta">
          {delivery.runs.length} {delivery.runs.length === 1 ? "run" : "runs"}
        </span>

        <div className="ml-auto flex items-center gap-3">
          {grade ? (
            <span className="data-figure text-sm font-semibold">{grade}</span>
          ) : (
            <span className="text-xs text-app-text-muted">Pendiente</span>
          )}
          {onOpenDelivery && (
            <button
              type="button"
              onClick={() => onOpenDelivery(delivery.id)}
              className="text-xs font-semibold text-primary hover:underline"
            >
              Ver entrega
            </button>
          )}
        </div>
      </div>

      {expanded && hasRuns && (
        <ul className="mt-3 space-y-2 border-l border-app-border pl-4">
          {delivery.runs.map((run) => (
            <li key={run.id} className="flex flex-wrap items-center gap-3">
              <StatusBadge tone={RUN_TONE[run.status]}>{run.status}</StatusBadge>
              <span className="data-meta">{formatDateTime(run.createdAt)}</span>
              {run.inputTokens > 0 && (
                <span className="data-meta">
                  {run.inputTokens.toLocaleString("es-ES")} /{" "}
                  {run.outputTokens.toLocaleString("es-ES")} tokens
                </span>
              )}
              {run.executionCostUsd > 0 && (
                <span className="data-meta">
                  ${run.executionCostUsd.toFixed(4)}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
