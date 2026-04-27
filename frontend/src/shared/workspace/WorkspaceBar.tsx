import { useNavigate } from "react-router-dom";
import { RiStackFill, RiLayoutGridFill, RiPulseFill, RiCloseCircleFill } from "react-icons/ri";
import { useWorkspace } from "./WorkspaceContext";

export function WorkspaceBar(): JSX.Element | null {
  const { selection, clearWorkspace, setProject, setAssignment, setDelivery } = useWorkspace();
  const navigate = useNavigate();

  if (!selection.projectId && !selection.assignmentId && !selection.deliveryId) {
    return null;
  }

  return (
    <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shadow-sm z-10 sticky top-0">
      <div className="flex items-center gap-2 text-sm overflow-x-auto no-scrollbar whitespace-nowrap">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mr-2">
          Contexto Activo
        </span>

        {selection.projectId && (
          <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 rounded-full px-3 py-1 text-slate-700">
            <RiStackFill className="text-indigo-500" />
            <button onClick={() => navigate("/projects")} className="font-medium hover:text-indigo-600 transition truncate max-w-[150px]">
              {selection.projectTitle || "Proyecto Seleccionado"}
            </button>
            <button onClick={() => clearWorkspace()} className="ml-1 text-slate-400 hover:text-rose-500 transition">
              <RiCloseCircleFill />
            </button>
          </div>
        )}

        {selection.assignmentId && (
          <>
            <span className="text-slate-300">/</span>
            <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 rounded-full px-3 py-1 text-slate-700">
              <RiLayoutGridFill className="text-indigo-500" />
              <button onClick={() => navigate("/deliveries")} className="font-medium hover:text-indigo-600 transition truncate max-w-[150px]">
                {selection.assignmentLabel || "Alumno"}
              </button>
              <button onClick={() => setProject(selection.projectId!, selection.projectTitle ?? undefined)} className="ml-1 text-slate-400 hover:text-rose-500 transition">
                <RiCloseCircleFill />
              </button>
            </div>
          </>
        )}

        {selection.deliveryId && (
          <>
            <span className="text-slate-300">/</span>
            <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 rounded-full px-3 py-1 text-slate-700">
              <RiPulseFill className="text-indigo-500" />
              <button onClick={() => navigate("/runtime")} className="font-medium hover:text-indigo-600 transition truncate max-w-[150px]">
                {selection.deliveryLabel || "Entrega"}
              </button>
              <button onClick={() => setAssignment(selection.assignmentId!, selection.assignmentLabel ?? undefined)} className="ml-1 text-slate-400 hover:text-rose-500 transition">
                <RiCloseCircleFill />
              </button>
            </div>
          </>
        )}
      </div>

      <div className="hidden sm:flex items-center gap-3">
        {selection.projectId && (
          <button onClick={() => navigate("/runtime")} className="btn-secondary py-1.5 px-3 text-xs">
            Ir a Runtime
          </button>
        )}
      </div>
    </div>
  );
}
