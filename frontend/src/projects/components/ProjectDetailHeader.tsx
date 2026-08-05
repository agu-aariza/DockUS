/**
 * @fileoverview Vista y gestión de proyectos académicos (ProjectDetailHeader).
 *
 * @module ProjectDetailHeader
 */

import {
  RiBarChart2Line,
  RiLayoutGridFill,
  RiSettings4Line,
  RiTeamFill,
} from "react-icons/ri";
import { Card } from "../../shared/components/ui/Layout";
import { Tabs } from "../../shared/components/ui/Tabs";
import { StatusBadge } from "../../shared/components/ui/StatusBadge";
import { ProjectStatusBadge } from "../../features/projects/components/ProjectStatusBadge";
import type { ProjectEntity } from "../../features/projects/types";

export type SubTab = 'catalog' | 'assignments' | 'config' | 'monitoring';

export interface ProjectDetailHeaderProps {
  project: ProjectEntity;
  activeTab: SubTab;
  onTabChange: (id: SubTab) => void;
}

export function ProjectDetailHeader({
  project,
  activeTab,
  onTabChange,
}: ProjectDetailHeaderProps): JSX.Element {
  return (
    <Card className="p-5">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 pr-0 lg:pr-6">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <ProjectStatusBadge status={project.status} />
            <StatusBadge tone="info">
              {project.maxDeliveriesPerStudent} INTENTOS
            </StatusBadge>
          </div>

          <h3 className="truncate text-base font-semibold text-app-text">
            {project.title}
          </h3>

          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-app-text-secondary line-clamp-2">
            {project.contextAcademico || "Sin contexto académico definido."}
          </p>
        </div>

        <div className="flex items-center shrink-0">
          <Tabs
            tabs={[
              { id: "catalog", label: "Resumen", icon: RiLayoutGridFill },
              { id: "assignments", label: "Alumnos", icon: RiTeamFill },
              { id: "monitoring", label: "Seguimiento", icon: RiBarChart2Line },
              { id: "config", label: "Ajustes", icon: RiSettings4Line },
            ]}
            activeTab={activeTab}
            onTabChange={(id) => onTabChange(id as SubTab)}
          />
        </div>
      </div>
    </Card>
  );
}
