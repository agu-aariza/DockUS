import { useMemo } from "react";
import {
  RiArrowRightLine,
  RiFolderOpenLine,
  RiTimeLine,
} from "react-icons/ri";

import type { SessionRecord, ProjectAssignmentEntity } from "../shared/types";
import { Button } from "../shared/components/ui/Button";
import { EmptyState } from "../shared/components/EmptyState";
import { Skeleton } from "../shared/components/Skeleton";
import { useWorkspace } from "../shared/workspace/WorkspaceContext";
import type { StudentWorkspaceData } from "./hooks/useStudentWorkspaceData";
import { StudentSurface, StudentSurfaceHeader } from "./components/StudentWorkspaceSurface";
import { describeAssignmentTimeline } from "./deadlineUtils";

interface Props {
  session: SessionRecord | null;
  data: StudentWorkspaceData;
  onNavigate: (tab: any) => void;
}

function getUrgencyStyle(
  assignment: ProjectAssignmentEntity,
  now: number,
): { border: string; iconBg: string; iconColor: string; chip: string } {
  if (assignment.revokedAt) {
    return {
      border: "border-slate-200 opacity-70",
      iconBg: "bg-slate-100",
      iconColor: "text-slate-400",
      chip: "bg-slate-100 text-slate-600 border-slate-200",
    };
  }

  const closesAt = assignment.closesAt
    ? new Date(assignment.closesAt).getTime()
    : null;

  if (closesAt && closesAt < now) {
    return {
      border: "border-rose-200",
      iconBg: "bg-rose-50",
      iconColor: "text-rose-500",
      chip: "bg-rose-50 text-rose-700 border-rose-200",
    };
  }

  if (closesAt && closesAt - now < 48 * 60 * 60 * 1000) {
    return {
      border: "border-amber-200",
      iconBg: "bg-amber-50",
      iconColor: "text-amber-600",
      chip: "bg-amber-50 text-amber-700 border-amber-200",
    };
  }

  return {
    border: "border-brand-blue/15",
    iconBg: "bg-brand-blue/10",
    iconColor: "text-brand-blue",
    chip: "bg-brand-blue/5 text-brand-blue-dark border-brand-blue/15",
  };
}

function formatDate(value?: string | null): string {
  return value ? new Date(value).toLocaleString("es-ES") : "Sin fecha";
}

export function StudentAssignmentsSection({
  session,
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
        <div className="rounded-[2rem] border border-academic-surface-variant bg-white p-6 shadow-sm">
          <div className="h-5 w-40 animate-pulse rounded bg-slate-200" />
          <div className="mt-4 h-4 w-3/4 animate-pulse rounded bg-slate-100" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((index) => (
            <div
              key={index}
              className="rounded-[2rem] border border-academic-surface-variant bg-white p-6 shadow-sm"
            >
              <Skeleton type="rounded" className="h-12 w-12" />
              <div className="mt-6 h-5 w-3/4 animate-pulse rounded bg-slate-100" />
              <div className="mt-4 h-4 w-full animate-pulse rounded bg-slate-100" />
              <div className="mt-2 h-4 w-5/6 animate-pulse rounded bg-slate-100" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-800">
        Error al cargar proyectos: {error}
      </div>
    );
  }

  if (assignments.length === 0) {
    return (
      <EmptyState
        icon={<RiFolderOpenLine className="text-4xl text-slate-400" />}
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
              className={`group flex h-full cursor-pointer flex-col rounded-[2rem] border bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-academic ${urgency.border}`}
              onClick={() => handleSelect(assignment)}
            >
              <div className="flex items-start justify-between gap-4">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-2xl ${urgency.iconBg} ${urgency.iconColor}`}
                >
                  <RiFolderOpenLine className="text-xl" />
                </div>
                <span
                  className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${urgency.chip}`}
                >
                  {assignment.revokedAt ? "Revocada" : timeline.headline}
                </span>
              </div>

              <div className="mt-6 flex-1">
                <h4 className="font-display text-2xl font-semibold tracking-tight text-academic-on-surface">
                  {assignment.projectTitle}
                </h4>
                <p className="mt-3 text-sm leading-6 text-academic-on-surface-variant">
                  {timeline.detail}
                </p>

                <div className="mt-5 space-y-3 rounded-[1.5rem] border border-academic-surface-variant bg-academic-surface-container-lowest p-4 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <span className="ui-label text-academic-outline">Entregas realizadas</span>
                    <span className="font-semibold text-academic-on-surface">
                      {assignment.deliveryCount}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="ui-label text-academic-outline">Intentos restantes</span>
                    <span className="font-semibold text-academic-on-surface">
                      {assignment.remainingDeliveries}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="ui-label text-academic-outline">Apertura</span>
                    <span className="text-right font-medium text-academic-on-surface">
                      {formatDate(assignment.opensAt)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="ui-label text-academic-outline">Cierre</span>
                    <span className="text-right font-medium text-academic-on-surface">
                      {formatDate(assignment.closesAt)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-academic-surface-variant pt-4">
                <div className="flex items-center gap-2 text-xs text-academic-on-surface-variant">
                  <RiTimeLine className="text-sm" />
                  {timeline.countdownLabel ?? "Sin cuenta atrás"}
                </div>
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-brand-blue transition group-hover:translate-x-1">
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
