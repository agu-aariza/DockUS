import { Button } from "../../shared/components/ui/Button";
import { SkeletonCard } from "../../shared/components/Skeleton";
import {
  RiSearchLine,
  RiLoader4Line,
  RiRefreshLine,
  RiFoldersLine,
  RiArrowRightSLine,
  RiTeamFill,
} from "react-icons/ri";
import type { ProjectEntity as Project, ProjectStatus } from "../../features/projects/types";
import { STATUS_LABEL, STATUS_STYLE } from "./ProjectStatusPill";

export function ProjectCatalog({
  projects,
  visibleProjects,
  projectSearch,
  setProjectSearch,
  loadingProjects,
  refreshProjects,
  detailMode,
  selectedProjectId,
  openProject,
}: {
  projects: Project[];
  visibleProjects: Project[];
  projectSearch: string;
  setProjectSearch: (s: string) => void;
  loadingProjects: boolean;
  refreshProjects: () => void;
  detailMode: string;
  selectedProjectId: string;
  openProject: (id: string) => void;
}) {
  return (
    <aside className="flex flex-col h-full rounded-lg border border-academic-surface-variant bg-white p-6 shadow-academic overflow-hidden">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div>
          <p className="eyebrow !mb-1">Catálogo</p>
          <h3 className="text-xl font-bold tracking-tight text-academic-on-surface">
            Proyectos
          </h3>
        </div>
        <span className="flex h-8 min-w-[2rem] items-center justify-center rounded-full bg-brand-maroon px-2 text-[11px] font-bold text-academic-on-primary shadow-sm">
          {projects.length}
        </span>
      </div>

      <div className="space-y-4">
        <div className="group relative">
          <RiSearchLine className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-academic-outline text-lg transition-colors group-focus-within:text-brand-maroon" />
          <input
            className="input-field pl-11 h-12 bg-academic-surface-container border-academic-outline-variant/20 focus:bg-white focus:border-brand-maroon/25 focus:ring-2 focus:ring-brand-maroon/10 transition-all"
            placeholder="Buscar proyecto..."
            value={projectSearch}
            onChange={(event) => setProjectSearch(event.target.value)}
          />
        </div>
        <Button
          variant="secondary"
          className="w-full justify-center"
          onClick={refreshProjects}
          disabled={loadingProjects}
        >
          {loadingProjects ? <RiLoader4Line className="animate-spin" /> : <RiRefreshLine />}
          Actualizar catálogo
        </Button>
      </div>

      <div className="mt-8 flex-1 overflow-y-auto space-y-3 pr-1 -mr-1 custom-scrollbar">
        {loadingProjects ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : visibleProjects.length === 0 ? (
          <div className="rounded-[2rem] border-2 border-dashed border-academic-outline-variant/20 bg-academic-surface-container/30 px-4 py-12 text-center">
            <RiFoldersLine className="mx-auto text-3xl text-academic-outline/40 mb-3" />
            <p className="text-xs font-medium text-academic-outline italic">No se encontraron proyectos</p>
          </div>
        ) : (
          visibleProjects.map((project) => {
            const isSelected =
              detailMode === "selected-project" &&
              selectedProjectId === project.id;

            return (
              <button
                key={project.id}
                className={`group w-full rounded-lg border p-5 text-left transition-all duration-300 relative overflow-hidden ${isSelected
                  ? "border-academic-primary bg-academic-primary text-academic-on-primary shadow-academic-lg scale-[1.02] z-10"
                  : "border-academic-surface-variant bg-white hover:border-academic-outline hover:bg-academic-surface-container-lowest hover:shadow-academic active:scale-95"
                  }`}
                onClick={() => openProject(project.id)}
              >
                {isSelected && (
                  <div className="absolute top-0 right-0 p-1 opacity-20">
                    <RiFoldersLine className="text-4xl -rotate-12 translate-x-2 -translate-y-2" />
                  </div>
                )}

                <div className="flex items-start justify-between gap-3 relative">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <RiFoldersLine className={isSelected ? "text-academic-secondary" : "text-academic-outline group-hover:text-academic-outline-variant"} />
                      <span className="line-clamp-1 text-sm font-bold tracking-tight">
                        {project.title}
                      </span>
                    </div>
                    <div className={`ui-label leading-relaxed line-clamp-1 ${isSelected ? "text-slate-400" : "text-slate-500"}`}>
                      {project.expectedType || "Sin stack definido"}
                    </div>
                  </div>
                  <RiArrowRightSLine className={`text-lg transition-transform ${isSelected ? "text-white/40 translate-x-1" : "text-slate-200 group-hover:text-slate-400"}`} />
                </div>

                <div className="mt-5 flex items-center justify-between relative">
                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded-full px-3 py-1 ui-label ${isSelected
                        ? "bg-white/10 text-white/90 border border-white/10"
                        : STATUS_STYLE[project.status as ProjectStatus]
                        }`}
                    >
                      {STATUS_LABEL[project.status as ProjectStatus]}
                    </span>

                    {project.teachers && project.teachers.length > 0 && (
                      <div className="flex -space-x-1.5">
                        {project.teachers.slice(0, 3).map((teacher: any) => (
                          <div
                            key={teacher.id}
                            className={`h-5 w-5 rounded-full border-2 flex items-center justify-center text-[7px] font-bold uppercase transition-transform hover:scale-110 hover:z-20 ${isSelected ? 'border-slate-800 bg-slate-700 text-brand-blue-light' : 'border-white bg-brand-blue/5 text-brand-blue'
                              }`}
                            title={`${teacher.firstName} ${teacher.lastName}`}
                          >
                            {teacher.firstName[0]}{teacher.lastName[0]}
                          </div>
                        ))}
                        {project.teachers.length > 3 && (
                          <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center text-[7px] font-bold ${isSelected ? 'border-slate-800 bg-slate-700 text-slate-400' : 'border-white bg-slate-50 text-slate-400'
                            }`}>
                            +{project.teachers.length - 3}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <RiTeamFill className={isSelected ? "text-white/20" : "text-slate-200"} />
                    <span
                      className={`ui-label ${isSelected ? "text-slate-500" : "text-slate-400"
                        }`}
                    >
                      {project.maxDeliveriesPerStudent} {project.maxDeliveriesPerStudent === 1 ? 'intento' : 'intentos'}
                    </span>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}
