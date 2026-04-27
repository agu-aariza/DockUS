import type { SessionRecord, ProjectAssignmentEntity } from "../shared/types";
import { RiFolderOpenLine, RiArrowRightSLine } from "react-icons/ri";
import { useWorkspace } from "../shared/workspace/WorkspaceContext";
import { Skeleton } from "../shared/components/Skeleton";
import { EmptyState } from "../shared/components/EmptyState";
import type { StudentWorkspaceData } from "./hooks/useStudentWorkspaceData";

interface Props {
  session: SessionRecord | null;
  data: StudentWorkspaceData;
  onNavigate: (tab: any) => void;
}

export function StudentAssignmentsSection({ session, data, onNavigate }: Props): JSX.Element {
  const { setAssignment, setProject } = useWorkspace();
  const { assignments, loading, error } = data;
  const formatDate = (value?: string | null) =>
    value ? new Date(value).toLocaleString("es-ES") : "Sin fecha";

  const handleSelect = (assignment: ProjectAssignmentEntity) => {
    setProject(assignment.projectId, assignment.projectTitle);
    setAssignment(assignment.id, assignment.studentEmail);
    onNavigate("entregas");
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton type="text" className="h-6 w-48 mb-6" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
              <Skeleton type="rounded" className="h-10 w-10 mb-4" />
              <Skeleton type="text" className="h-5 w-3/4" />
              <div className="space-y-2 mt-4">
                <Skeleton type="text" className="h-3 w-full" />
                <Skeleton type="text" className="h-3 w-full" />
                <Skeleton type="text" className="h-3 w-5/6" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-800 font-medium shadow-sm">
        Error al cargar proyectos: {error}
      </div>
    );
  }

  if (assignments.length === 0) {
    return (
      <EmptyState 
        icon={<RiFolderOpenLine className="text-4xl text-slate-400" />}
        title="Sin proyectos asignados"
        description="Aún no tienes ningún proyecto asignado. Contacta con tu profesor si crees que es un error o espera a que se abran nuevas convocatorias."
      />
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold tracking-tight text-slate-950">
        Mis Asignaciones Académicas
      </h3>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {assignments.map((assignment) => {
          const restantes = assignment.remainingDeliveries;
          return (
            <article 
              key={assignment.id}
              className="group cursor-pointer rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-indigo-300 hover:shadow-md"
              onClick={() => handleSelect(assignment)}
            >
              <div className="flex items-start justify-between">
                <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600">
                  <RiFolderOpenLine className="text-xl" />
                </div>
                <RiArrowRightSLine className="text-slate-300 transition group-hover:text-indigo-600 group-hover:translate-x-1" />
              </div>
              <h4 className="mt-4 text-base font-semibold text-slate-900 line-clamp-1">
                {assignment.projectTitle}
              </h4>
              <div className="mt-3 space-y-2 text-sm text-slate-500">
                <div className="flex justify-between">
                  <span>Estado del trabajo:</span>
                  <span className="font-medium text-slate-700">
                    {assignment.revokedAt ? 'Revocado' : 'Activo'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Entregas realizadas:</span>
                  <span className="font-medium text-slate-700">{assignment.deliveryCount}</span>
                </div>
                <div className="flex justify-between">
                  <span>Intentos restantes:</span>
                  <span className={`font-medium ${restantes === 0 ? 'text-rose-600' : 'text-slate-700'}`}>
                    {restantes}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span>Apertura:</span>
                  <span className="font-medium text-slate-700 text-right">{formatDate(assignment.opensAt)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span>Cierre:</span>
                  <span className="font-medium text-slate-700 text-right">{formatDate(assignment.closesAt)}</span>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
