import {
  RiBarChart2Line,
  RiCalendarScheduleLine,
  RiDeleteBin6Line,
  RiRefreshLine,
  RiSettings4Line,
  RiSparkling2Line,
  RiTeamFill,
  RiTestTubeLine,
  RiTimeLine,
} from "react-icons/ri";
import { Button } from "../../shared/components/ui/Button";
import { MetricCard } from "../../shared/components/MetricCard";
import { SectionCard } from "../../shared/components/ui/Layout";
import type { ProjectEntity } from "../../features/projects/types";

function formatOptionalDate(value?: string | null): string {
  return value ? new Date(value).toLocaleString("es-ES") : "Sin definir";
}

export interface ProjectOverviewProps {
  project: ProjectEntity;
  assignmentCount: number;
  preparedStudentCount: number;
  onOpenMonitoring: () => void;
  onRefreshAssignments: () => void;
  onFetchTestSuite: () => void;
  onDelete: () => void;
}

export function ProjectOverview({
  project,
  assignmentCount,
  preparedStudentCount,
  onOpenMonitoring,
  onRefreshAssignments,
  onFetchTestSuite,
  onDelete,
}: ProjectOverviewProps): JSX.Element {
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

      <SectionCard
        title="Control Operativo"
        description="Operaciones de gestión"
        headerAction={
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100/80 text-slate-500 border border-slate-200/40 shadow-sm">
            <RiSettings4Line className="text-lg" />
          </div>
        }
      >
        <div className="flex flex-col gap-6 xl:flex-row">
          <div className="flex-1">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              <Button
                variant="secondary"
                className="justify-start shadow-sm hover:shadow"
                onClick={onRefreshAssignments}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100/50 border border-slate-200/40 text-slate-600">
                  <RiRefreshLine />
                </span>
                Sincronizar asignaciones
              </Button>
              <Button
                variant="secondary"
                className="justify-start shadow-sm hover:shadow"
                onClick={onFetchTestSuite}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100/50 border border-slate-200/40 text-slate-600">
                  <RiTestTubeLine />
                </span>
                Recuperar suite docente
              </Button>
              <Button
                variant="secondary"
                className="justify-start shadow-sm hover:shadow"
                onClick={onOpenMonitoring}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100/50 border border-slate-200/40 text-slate-600">
                  <RiBarChart2Line />
                </span>
                Ver seguimiento
              </Button>
            </div>
          </div>

          <div className="flex items-end xl:w-56 xl:shrink-0 xl:border-l xl:border-app-border xl:pl-6">
            <Button variant="danger" className="w-full justify-start shadow-sm" onClick={onDelete}>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-danger-100/60 border border-danger-200/40 text-danger-600">
                <RiDeleteBin6Line />
              </span>
              Eliminar proyecto
            </Button>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
