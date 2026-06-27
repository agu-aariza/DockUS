import type { ProjectStatus } from "../../features/projects/types";

export const STATUS_LABEL: Record<ProjectStatus, string> = {
  DRAFT: "Borrador",
  ACTIVE: "Activo",
  ARCHIVED: "Archivado",
};

export const STATUS_STYLE: Record<ProjectStatus, string> = {
  DRAFT: "border-academic-secondary/30 bg-academic-secondary/5 text-academic-secondary",
  ACTIVE: "border-academic-primary/30 bg-academic-primary/5 text-academic-primary",
  ARCHIVED: "border-academic-tertiary/30 bg-academic-tertiary/5 text-academic-tertiary",
};

export function ProjectStatusPill({ status }: { status: ProjectStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 ui-label ${STATUS_STYLE[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
