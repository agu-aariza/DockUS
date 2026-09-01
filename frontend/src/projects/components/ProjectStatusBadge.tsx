/**
 * @fileoverview Vista y gestión de proyectos académicos (ProjectStatusBadge).
 *
 * @module ProjectStatusBadge
 */

import { StatusBadge, type StatusTone } from '../../shared/components/ui/StatusBadge';
import type { ProjectStatus } from '../../features/projects/types';

const STATUS_TONE: Record<ProjectStatus, StatusTone> = {
  DRAFT: 'draft',
  ACTIVE: 'success',
  ARCHIVED: 'closed',
};

const STATUS_LABEL: Record<ProjectStatus, string> = {
  DRAFT: 'Borrador',
  ACTIVE: 'Activo',
  ARCHIVED: 'Archivado',
};

interface ProjectStatusBadgeProps {
  status: ProjectStatus;
  className?: string;
}

export function ProjectStatusBadge({ status, className }: ProjectStatusBadgeProps) {
  return (
    <StatusBadge tone={STATUS_TONE[status]} className={className}>
      {STATUS_LABEL[status]}
    </StatusBadge>
  );
}
