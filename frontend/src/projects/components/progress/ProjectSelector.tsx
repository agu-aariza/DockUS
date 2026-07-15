import { RiLoader4Line } from "react-icons/ri";
import type { ProjectEntity } from "../../../features/projects/types";

interface ProjectSelectorProps {
  projectOptions: ProjectEntity[];
  projectId: string;
  loading: boolean;
  onProjectChange: (projectId: string) => void;
  onLoad: () => void;
}

export function ProjectSelector({
  projectOptions,
  projectId,
  loading,
  onProjectChange,
  onLoad,
}: ProjectSelectorProps): JSX.Element {
  return (
    <div className="rounded-lg border border-app-border bg-slate-50 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
        <div className="flex-1">
          <label className="mb-2 block text-sm font-semibold text-slate-700">
            Proyecto a monitorizar
          </label>
          <select
            className="input-field bg-white"
            value={projectId}
            onChange={(event) => onProjectChange(event.target.value)}
          >
            <option value="">Selecciona un proyecto...</option>
            {projectOptions.map((project) => (
              <option key={project.id} value={project.id}>
                {project.title}
              </option>
            ))}
          </select>
        </div>
        <button
          className="btn-primary"
          onClick={onLoad}
          disabled={loading || !projectId.trim()}
        >
          {loading ? (
            <RiLoader4Line className="animate-spin motion-reduce:animate-none" />
          ) : null}
          {loading ? "Cargando seguimiento..." : "Cargar seguimiento"}
        </button>
      </div>
    </div>
  );
}
