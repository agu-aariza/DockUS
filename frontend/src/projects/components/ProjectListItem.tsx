import { RiArrowRightSLine, RiFoldersLine, RiTeamFill } from "react-icons/ri";
import type { ProjectEntity } from "../../features/projects/types";
import { ProjectStatusBadge } from "../../features/projects/components/ProjectStatusBadge";

export interface ProjectListItemProps {
  project: ProjectEntity;
  isSelected: boolean;
  onClick: () => void;
}

export function ProjectListItem({ project, isSelected, onClick }: ProjectListItemProps): JSX.Element {
  return (
    <button
      key={project.id}
      className={`group relative w-full rounded-xl border p-4 text-left ${isSelected
        ? "border-primary/50 bg-primary-subtle shadow-sm ring-1 ring-primary/10"
        : "card-interactive border-app-border bg-white"
        }`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3 relative">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <RiFoldersLine className={`text-base transition-colors duration-200 ${isSelected ? "text-primary" : "text-slate-400 group-hover:text-slate-500"}`} />
            <span className={`line-clamp-1 text-sm font-semibold transition-colors duration-200 ${isSelected ? "text-primary" : "text-slate-900"}`}>
              {project.title}
            </span>
          </div>
          <div className="text-xs font-medium text-slate-400 line-clamp-1">
            {project.expectedType || "Sin stack definido"}
          </div>
        </div>
        <RiArrowRightSLine className={`text-lg transition-transform duration-200 ${isSelected ? "text-primary translate-x-0.5" : "text-slate-300 group-hover:text-slate-400 group-hover:translate-x-0.5"}`} />
      </div>

      <div className="mt-4 flex items-center justify-between relative">
        <div className="flex items-center gap-3">
          <span>
            <ProjectStatusBadge status={project.status} />
          </span>

          {project.teachers && project.teachers.length > 0 && (
            <div className="flex -space-x-2">
              {project.teachers.slice(0, 3).map((teacher) => (
                <div
                  key={teacher.id}
                  className={`flex h-6 w-6 items-center justify-center rounded-full border-2 text-[8px] font-semibold uppercase transition-colors ${
                    isSelected
                      ? 'border-white bg-primary text-white'
                      : 'border-white bg-slate-100 text-slate-600'
                  }`}
                  title={`${teacher.firstName} ${teacher.lastName}`}
                >
                  {teacher.firstName[0]}{teacher.lastName[0]}
                </div>
              ))}
              {project.teachers.length > 3 && (
                <div className={`flex h-6 w-6 items-center justify-center rounded-full border-2 text-[8px] font-semibold ${
                  isSelected
                    ? 'border-white bg-primary/80 text-white'
                    : 'border-white bg-slate-50 text-slate-500'
                  }`}>
                  +{project.teachers.length - 3}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <RiTeamFill className={`text-base ${isSelected ? "text-primary/40" : "text-slate-300"}`} />
          <span className="text-xs font-medium text-slate-400">
            {project.maxDeliveriesPerStudent} {project.maxDeliveriesPerStudent === 1 ? 'intento' : 'intentos'}
          </span>
        </div>
      </div>
    </button>
  );
}
