import { MetricCard } from "../../shared/components/MetricCard";
import {
  RiTeamFill,
  RiSparkling2Line,
  RiCalendarScheduleLine,
  RiTimeLine,
  RiSettings4Line,
  RiRefreshLine,
  RiTestTubeLine,
  RiBarChart2Line,
  RiDeleteBin6Line,
} from "react-icons/ri";
import type { ProjectEntity as Project } from "../../features/projects/types";

export function formatOptionalDate(value?: string | null): string {
  return value ? new Date(value).toLocaleString("es-ES") : "Sin definir";
}

export function ProjectOverview({
  project,
  assignmentCount,
  preparedStudentCount,
  onOpenAssignments,
  onOpenSettings,
  onOpenMonitoring,
  onRefreshAssignments,
  onFetchTestSuite,
  onDelete,
}: {
  project: Project;
  assignmentCount: number;
  preparedStudentCount: number;
  onOpenAssignments: () => void;
  onOpenSettings: () => void;
  onOpenMonitoring: () => void;
  onRefreshAssignments: () => void;
  onFetchTestSuite: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="space-y-6">
      <section className="grid gap-5 lg:grid-cols-4">
        <MetricCard
          label="Asignados"
          value={assignmentCount}
          helper="Alumnos activos"
          icon={<RiTeamFill />}
          variant="info"
        />
        <MetricCard
          label="Preparados"
          value={preparedStudentCount}
          helper="Listos para asignar"
          icon={<RiSparkling2Line />}
          variant="default"
        />
        <MetricCard
          label="Apertura"
          value={formatOptionalDate(project.opensAt).split(',')[0]}
          helper="Inicio de entregas"
          icon={<RiCalendarScheduleLine />}
          variant="default"
        />
        <MetricCard
          label="Cierre"
          value={formatOptionalDate(project.closesAt).split(',')[0]}
          helper="Fin de entregas"
          icon={<RiTimeLine />}
          variant="warning"
        />
      </section>

      <article className="rounded-lg border border-academic-surface-variant bg-white p-8 shadow-academic lg:col-span-4">
        <div className="flex flex-col xl:flex-row gap-8">
          <div className="flex-1 space-y-4">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h4 className="eyebrow">
                  Operaciones de Gestión
                </h4>
                <h3 className="mt-2 text-xl font-bold text-academic-on-surface">Control Operativo</h3>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-academic-surface-container text-2xl text-academic-outline">
                <RiSettings4Line />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <button
                className="group/btn flex items-center gap-3 w-full p-4 rounded-2xl bg-academic-surface-container/50 border border-academic-outline-variant/20 text-sm font-bold text-academic-on-surface-variant hover:bg-white hover:border-brand-maroon/25 hover:text-brand-maroon hover:shadow-academic transition-all"
                onClick={onRefreshAssignments}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white border border-academic-outline-variant/30 text-academic-outline group-hover/btn:text-brand-maroon group-hover/btn:border-brand-maroon/10 shadow-sm">
                  <RiRefreshLine className="text-lg" />
                </div>
                <span>Sincronizar asignaciones</span>
              </button>

              <button
                className="group/btn flex items-center gap-3 w-full p-4 rounded-2xl bg-academic-surface-container/50 border border-academic-outline-variant/20 text-sm font-bold text-academic-on-surface-variant hover:bg-white hover:border-brand-blue/25 hover:text-brand-blue hover:shadow-academic transition-all"
                onClick={onFetchTestSuite}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white border border-academic-outline-variant/30 text-academic-outline group-hover/btn:text-brand-blue group-hover/btn:border-brand-blue/10 shadow-sm">
                  <RiTestTubeLine className="text-lg" />
                </div>
                <span>Recuperar suite docente</span>
              </button>

              <button
                className="group/btn flex items-center gap-3 w-full p-4 rounded-2xl bg-academic-surface-container/50 border border-academic-outline-variant/20 text-sm font-bold text-academic-on-surface-variant hover:bg-white hover:border-brand-blue/25 hover:text-brand-blue hover:shadow-academic transition-all"
                onClick={onOpenMonitoring}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white border border-academic-outline-variant/30 text-academic-outline group-hover/btn:text-brand-blue group-hover/btn:border-brand-blue/10 shadow-sm">
                  <RiBarChart2Line className="text-lg" />
                </div>
                <span>Ver seguimiento</span>
              </button>
            </div>
          </div>

          <div className="xl:w-[240px] shrink-0 xl:border-l xl:border-academic-outline-variant/20 xl:pl-8 flex items-end">
            <button
              className="group/btn flex items-center gap-3 w-full p-4 rounded-2xl bg-rose-50/70 border border-rose-100 text-sm font-bold text-rose-600 hover:bg-rose-600 hover:text-white hover:shadow-academic transition-all"
              onClick={onDelete}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-rose-500 shadow-sm group-hover/btn:bg-white/20 group-hover/btn:text-white transition-colors">
                <RiDeleteBin6Line className="text-lg" />
              </div>
              <span>Eliminar proyecto</span>
            </button>
          </div>
        </div>
      </article>
    </div>
  );
}
