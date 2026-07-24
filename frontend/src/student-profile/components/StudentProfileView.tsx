/**
 * @fileoverview Componente de perfil y expediente del alumno (StudentProfileView).
 *
 * @module StudentProfileView
 */

import {
  RiFileList3Line,
  RiFolderChartLine,
  RiPlayCircleLine,
  RiStarLine,
} from "react-icons/ri";
import { MetricCard } from "../../shared/components/MetricCard";
import { SectionCard } from "../../shared/components/ui/Layout";
import { StatusBadge } from "../../shared/components/ui/StatusBadge";
import { StudentProjectTimeline } from "./StudentProjectTimeline";
import type { StudentProfileResponse } from "../../features/students/types";

const formatGrade = (grade: number | null) =>
  grade === null ? "—" : grade.toFixed(2).replace(".", ",");

interface StudentProfileViewProps {
  profile: StudentProfileResponse;
  onOpenDelivery?: (deliveryId: string) => void;
}

/**
 * Presentacional puro: lo montan tanto el panel del profesor (`/students/:id`)
 * como la pestaña de expediente del alumno, que consumen el mismo contrato.
 */
export function StudentProfileView({
  profile,
  onOpenDelivery,
}: StudentProfileViewProps): JSX.Element {
  const { student, groups, summary, projects } = profile;
  const initials = `${student.firstName[0] ?? ""}${student.lastName[0] ?? ""}`;

  return (
    <div className="space-y-6">
      <SectionCard>
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-app-border bg-slate-100 text-sm font-semibold uppercase text-slate-600">
            {initials}
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-slate-900">
              {student.lastName}, {student.firstName}
            </h2>
            <p className="data-meta">{student.email}</p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StatusBadge
                tone={student.status === "ACTIVE" ? "success" : "idle"}
              >
                {student.status === "ACTIVE" ? "Activo" : student.status}
              </StatusBadge>
              {groups.length > 0 ? (
                groups.map((group) => (
                  <StatusBadge key={group.id} tone="info">
                    {group.name}
                    {group.code ? ` · ${group.code}` : ""}
                  </StatusBadge>
                ))
              ) : (
                <StatusBadge tone="idle">Sin grupo</StatusBadge>
              )}
            </div>
          </div>
        </div>
      </SectionCard>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Nota media"
          value={formatGrade(summary.averageGrade)}
          helper={
            summary.evaluatedCount === 1
              ? "1 entrega evaluada"
              : `${summary.evaluatedCount} entregas evaluadas`
          }
          icon={<RiStarLine />}
          variant="success"
        />
        <MetricCard
          label="Proyectos"
          value={summary.projectsCount}
          helper="Asignados y vigentes"
          icon={<RiFolderChartLine />}
        />
        <MetricCard
          label="Entregas"
          value={summary.deliveriesCount}
          helper={
            summary.deliveriesCount === 1 ? "Versión enviada" : "Versiones enviadas"
          }
          icon={<RiFileList3Line />}
        />
        <MetricCard
          label="Ejecuciones"
          value={summary.runsCount}
          helper="Del pipeline de evaluación"
          icon={<RiPlayCircleLine />}
          variant="info"
        />
      </section>

      <StudentProjectTimeline
        projects={projects}
        onOpenDelivery={onOpenDelivery}
      />
    </div>
  );
}
