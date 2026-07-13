import { useMemo } from "react";
import {
  RiArrowRightLine,
  RiFolderOpenLine,
  RiTimeLine,
} from "react-icons/ri";

import type { ProjectAssignmentEntity } from "../shared/types";
import { EmptyState } from "../shared/components/EmptyState";
import { Skeleton } from "../shared/components/Skeleton";
import { useWorkspace } from "../shared/workspace/WorkspaceContext";
import type { StudentWorkspaceData } from "./hooks/useStudentWorkspaceData";
import { describeAssignmentTimeline } from "./deadlineUtils";

interface Props {
  data: StudentWorkspaceData;
  onNavigate: (_tab: any) => void;
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
      border: "border-amber-100 bg-amber-50/10",
      iconBg: "bg-amber-50",
      iconColor: "text-amber-600",
      chip: "bg-amber-50 text-amber-700 border-amber-100",
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
  const { setAssignment, setProject } = useWorkspace();
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
      <div className="space-y-6">
        <div className="rounded-lg border border-app-border bg-white p-6">
          <div className="h-5 w-40 animate-pulse rounded bg-slate-50" />
          <div className="mt-4 h-4 w-3/4 animate-pulse rounded bg-slate-50/60" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((index) => (
            <div
              key={index}
              className="rounded-lg border border-app-border bg-white p-6"
            >
              <Skeleton type="rounded" className="h-12 w-12 bg-slate-50" />
              <div className="mt-6 h-5 w-3/4 animate-pulse rounded bg-slate-50/60" />
              <div className="mt-4 h-4 w-full animate-pulse rounded bg-slate-50/60" />
              <div className="mt-2 h-4 w-5/6 animate-pulse rounded bg-slate-50/60" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-rose-800">
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
            <article
              key={assignment.id}
              className={`group flex h-full cursor-pointer flex-col rounded-lg border bg-white p-6  transition-all duration-300  ${urgency.border}`}
              onClick={() => handleSelect(assignment)}
            >
              <div className="flex items-start justify-between gap-4">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-lg ${urgency.iconBg} ${urgency.iconColor}`}
                >
                  <RiFolderOpenLine className="text-xl" />
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
            </article>
          );
        })}
      </div>
    </div>
  );
}
