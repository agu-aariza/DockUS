import { useMemo } from "react";
import {
  RiArrowRightLine,
  RiFolderOpenLine,
  RiTimeLine,
} from "react-icons/ri";

import type { ProjectAssignmentEntity } from "../shared/types";
import { EmptyState } from "../shared/components/EmptyState";
import { Skeleton } from "../shared/components/Skeleton";
import { useWorkspaceSelection } from "../shared/workspace/WorkspaceContext";
import type { StudentWorkspaceData } from "./hooks/useStudentWorkspaceData";
import { describeAssignmentTimeline } from "./deadlineUtils";
import type { StudentTab } from "./studentTabs";

interface Props {
  data: StudentWorkspaceData;
  onNavigate: (_tab: StudentTab) => void;
}

function getUrgencyStyle(
  assignment: ProjectAssignmentEntity,
  now: number,
): { border: string; iconBg: string; iconColor: string; chip: string } {
  if (assignment.revokedAt) {
    return {
      border: "border-app-border/30 opacity-75 bg-slate-50/20",
      iconBg: "bg-slate-50",
      iconColor: "text-slate-400",
      chip: "bg-slate-50 text-slate-500 border-app-border/20",
    };
  }

  const closesAt = assignment.closesAt
    ? new Date(assignment.closesAt).getTime()
    : null;

  if (closesAt && closesAt < now) {
    return {
      border: "border-rose-100 bg-rose-50/10",
      iconBg: "bg-rose-50",
      iconColor: "text-rose-600",
      chip: "bg-rose-50 text-rose-700 border-rose-100",
    };
  }

  if (closesAt && closesAt - now < 48 * 60 * 60 * 1000) {
    return {
      border: "border-warning-100 bg-warning-50/10",
      iconBg: "bg-warning-50",
      iconColor: "text-warning-600",
      chip: "bg-warning-50 text-warning-700 border-warning-100",
    };
  }

  return {
    border: "border-primary/15",
    iconBg: "bg-primary/10",
    iconColor: "text-primary",
    chip: "bg-primary/5 text-primary border-primary/15",
  };
}

function formatDate(value?: string | null): string {
  return value ? new Date(value).toLocaleString("es-ES") : "Sin fecha";
}

export function StudentAssignmentsSection({
  data,
  onNavigate,
}: Props): JSX.Element {
  const { setAssignment, setProject } = useWorkspaceSelection();
  const { assignments, loading, error } = data;

  const handleSelect = (assignment: ProjectAssignmentEntity) => {
    setProject(assignment.projectId, assignment.projectTitle);
    setAssignment(assignment.id, assignment.projectTitle);
    onNavigate("entregas");
  };

  const sortedAssignments = useMemo(() => {
    const now = Date.now();
    return [...assignments].sort((left, right) => {
      const leftRevoked = Boolean(left.revokedAt);
      const rightRevoked = Boolean(right.revokedAt);
      if (leftRevoked !== rightRevoked) {
        return leftRevoked ? 1 : -1;
      }

      const leftClosesAt = left.closesAt ? new Date(left.closesAt).getTime() : null;
      const rightClosesAt = right.closesAt ? new Date(right.closesAt).getTime() : null;
      const leftPast = leftClosesAt !== null && leftClosesAt < now;
      const rightPast = rightClosesAt !== null && rightClosesAt < now;

      if (leftPast !== rightPast) {
        return leftPast ? 1 : -1;
      }

      if (leftClosesAt === null && rightClosesAt === null) {
        return 0;
      }
      if (leftClosesAt === null) {
        return 1;
      }
      if (rightClosesAt === null) {
        return -1;
      }

      return leftClosesAt - rightClosesAt;
    });
  }, [assignments]);

  if (loading) {
    return (
      <div
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
        aria-busy="true"
        aria-label="Cargando proyectos"
      >
        {[1, 2, 3].map((index) => (
          <div
            key={index}
            className="rounded-lg border border-app-border bg-white p-6 shadow-sm"
          >
            <div className="flex items-start justify-between gap-4">
              <Skeleton type="rounded" className="h-12 w-12" />
              <Skeleton type="text" className="h-6 w-24 rounded-full" />
            </div>
            <Skeleton type="text" className="mt-6 h-5 w-3/4" />
            <Skeleton type="text" className="mt-3 h-4 w-full" />
            <Skeleton type="rounded" className="mt-5 h-28 w-full" />
            <Skeleton type="text" className="mt-6 h-4 w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="rounded-lg border border-danger/30 bg-danger-subtle p-4 text-danger-800"
        role="alert"
      >
        Error al cargar proyectos: {error}
      </div>
    );
  }

  if (assignments.length === 0) {
    return (
      <EmptyState
        icon={<RiFolderOpenLine className="text-4xl text-slate-400/40" />}
        title="Sin proyectos asignados"
        description="Aún no tienes ningún proyecto asignado. Contacta con tu profesor si crees que es un error o espera a que se abran nuevas convocatorias."
      />
    );
  }

  const now = Date.now();

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {sortedAssignments.map((assignment) => {
          const urgency = getUrgencyStyle(assignment, now);
          const timeline = describeAssignmentTimeline(assignment, now);

          return (
            <div
              key={assignment.id}
              role="button"
              tabIndex={0}
              aria-label={`Abrir historial de ${assignment.projectTitle}`}
              className={`card-interactive group flex h-full cursor-pointer flex-col rounded-lg border bg-white p-6 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${urgency.border}`}
              onClick={() => handleSelect(assignment)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  handleSelect(assignment);
                }
              }}
            >
              <div className="flex items-start justify-between gap-4">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-lg transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none ${urgency.iconBg} ${urgency.iconColor}`}
                >
                  <RiFolderOpenLine className="text-xl" aria-hidden="true" />
                </div>
                <span
                  className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase  ${urgency.chip}`}
                >
                  {assignment.revokedAt ? "Revocada" : timeline.headline}
                </span>
              </div>

              <div className="mt-6 flex-1">
                <h4 className="text-base font-semibold text-slate-900">
                  {assignment.projectTitle}
                </h4>
                <p className="mt-3 text-sm leading-6 text-slate-500">
                  {timeline.detail}
                </p>

                <div className="mt-5 space-y-3 rounded-lg border border-app-border bg-slate-50 p-4 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <span className="ui-label text-slate-400">Entregas realizadas</span>
                    <span className="font-semibold text-slate-900">
                      {assignment.deliveryCount}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="ui-label text-slate-400">Intentos restantes</span>
                    <span className="font-semibold text-slate-900">
                      {assignment.remainingDeliveries}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="ui-label text-slate-400">Apertura</span>
                    <span className="text-right font-medium text-slate-900">
                      {formatDate(assignment.opensAt)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="ui-label text-slate-400">Cierre</span>
                    <span className="text-right font-medium text-slate-900">
                      {formatDate(assignment.closesAt)}
                    </span>
                  </div>
                </div>

                {assignment.teachers.length > 0 && (
                  <div className="mt-4">
                    <span className="ui-label text-slate-400">Equipo docente</span>
                    <ul className="mt-2 flex flex-wrap gap-3">
                      {assignment.teachers.map((teacher) => (
                        <li
                          key={teacher.id}
                          className="flex items-center gap-2 text-sm text-slate-700"
                        >
                          {/* Solo nombre: el alumno no navega al perfil de un docente. */}
                          <span className="flex h-7 w-7 items-center justify-center rounded-full border border-app-border bg-slate-100 text-[10px] font-semibold uppercase text-slate-600">
                            {teacher.firstName[0]}
                            {teacher.lastName[0]}
                          </span>
                          {teacher.firstName} {teacher.lastName}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-app-border pt-4">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <RiTimeLine className="text-sm" />
                  {timeline.countdownLabel ?? "Sin cuenta atrás"}
                </div>
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary transition group-hover:translate-x-1">
                  Abrir historial
                  <RiArrowRightLine />
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
