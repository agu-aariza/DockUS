import {
  RiAlarmWarningLine,
  RiCalendarEventLine,
  RiTimeLine,
  RiUploadCloud2Line,
} from "react-icons/ri";
import { useWorkspace } from "../shared/workspace/WorkspaceContext";
import type { ProjectAssignmentEntity } from "../shared/types";
import {
  describeAssignmentTimeline,
  formatAssignmentDate,
  pickPrimaryAssignment,
} from "./deadlineUtils";
import type { StudentTab } from "./StudentWorkspacePanel";

interface Props {
  assignments: ProjectAssignmentEntity[];
  onNavigate: (tab: StudentTab) => void;
}

const toneClasses = {
  upcoming: {
    panel: "border-sky-200 bg-sky-50",
    badge: "bg-sky-100 text-sky-800",
    icon: "text-sky-600",
  },
  open: {
    panel: "border-emerald-200 bg-emerald-50",
    badge: "bg-emerald-100 text-emerald-800",
    icon: "text-emerald-600",
  },
  "open-no-deadline": {
    panel: "border-slate-200 bg-slate-50",
    badge: "bg-white text-slate-700",
    icon: "text-slate-600",
  },
  late: {
    panel: "border-amber-200 bg-amber-50",
    badge: "bg-amber-100 text-amber-800",
    icon: "text-amber-600",
  },
} as const;

export function StudentDeadlineBanner({
  assignments,
  onNavigate,
}: Props): JSX.Element | null {
  const { selection } = useWorkspace();
  const activeAssignment = pickPrimaryAssignment(
    assignments,
    selection.assignmentId,
    selection.projectId,
  );

  if (!activeAssignment) {
    return null;
  }

  const timeline = describeAssignmentTimeline(activeAssignment);
  const tone = toneClasses[timeline.state];

  return (
    <section
      className={`rounded-3xl border p-5 shadow-sm ${tone.panel}`}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Plazo de entrega
          </div>
          <div className="mt-2 flex items-start gap-3">
            <div className={`rounded-2xl bg-white/80 p-3 ${tone.icon}`}>
              <RiCalendarEventLine className="text-2xl" />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-slate-950">
                {activeAssignment.projectTitle}
              </h3>
              <p className="mt-1 text-sm font-medium text-slate-800">
                {timeline.headline}
              </p>
              <p className="mt-1 text-sm text-slate-600">{timeline.detail}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-start gap-3 lg:items-end">
          <div
            className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold ${tone.badge}`}
          >
            <RiTimeLine />
            {timeline.countdownLabel ?? "Sin fecha de cierre"}
          </div>
          <button
            className="btn-secondary text-sm"
            onClick={() => onNavigate("subir")}
          >
            <RiUploadCloud2Line />
            Ir a entregar
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-white/80 bg-white/70 px-4 py-3 text-sm text-slate-700">
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            Apertura
          </div>
          <div className="mt-1 font-semibold text-slate-900">
            {formatAssignmentDate(activeAssignment.opensAt)}
          </div>
        </div>
        <div className="rounded-2xl border border-white/80 bg-white/70 px-4 py-3 text-sm text-slate-700">
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            Fin de entrega
          </div>
          <div className="mt-1 font-semibold text-slate-900">
            {formatAssignmentDate(activeAssignment.closesAt)}
          </div>
        </div>
      </div>

      {timeline.state === "late" ? (
        <div className="mt-4 flex items-start gap-2 rounded-2xl border border-amber-200 bg-white/60 px-4 py-3 text-sm text-amber-900">
          <RiAlarmWarningLine className="mt-0.5 text-base" />
          <span>
            Si subes ahora, la entrega seguirá siendo válida pero quedará marcada
            como fuera de plazo.
          </span>
        </div>
      ) : null}
    </section>
  );
}
