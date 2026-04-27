import type { SessionRecord, DeliveryEntity } from "../shared/types";
import { useWorkspace } from "../shared/workspace/WorkspaceContext";
import { RiInboxArchiveLine, RiFileTextLine } from "react-icons/ri";
import type { StudentWorkspaceData } from "./hooks/useStudentWorkspaceData";
import {
  deriveStudentWorkflowState,
  describeStudentWorkflowState,
} from "./studentWorkflowState";

interface Props {
  session: SessionRecord | null;
  data: StudentWorkspaceData;
  onNavigate: (tab: any) => void;
}

const STUDENT_STATUS_TEXT: Record<string, string> = {
  DRAFT: "Preparando entrega",
  SUBMITTED: "Entregada",
  IN_REVIEW: "En revisión",
  EVALUATED: "Evaluada",
};

const STUDENT_STATUS_STYLE: Record<string, string> = {
  DRAFT: "border-slate-200 bg-slate-100 text-slate-700",
  SUBMITTED: "border-sky-200 bg-sky-50 text-sky-700",
  IN_REVIEW: "border-amber-200 bg-amber-50 text-amber-700",
  EVALUATED: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

export function StudentDeliveriesSection({ session, data, onNavigate }: Props): JSX.Element {
  const { selection, setDelivery } = useWorkspace();
  const { deliveries, assignments, latestRunByDeliveryId, loading, error } = data;
  
  const selectedAssignmentId = selection.assignmentId;

  const handleSelectReport = (d: DeliveryEntity) => {
    setDelivery(d.id, `v${d.version}`);
    onNavigate("informes");
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Cargando entregas...</div>;
  }

  if (error) {
    return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-800">Error: {error}</div>;
  }

  const filteredDeliveries = selectedAssignmentId 
    ? deliveries.filter(d => d.assignmentId === selectedAssignmentId) 
    : deliveries;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold tracking-tight text-slate-950">
          Historial de Entregas {selectedAssignmentId ? "del Proyecto" : "Generales"}
        </h3>
        <button 
          className="btn-primary"
          onClick={() => onNavigate("subir")}
        >
          Subir nueva versión
        </button>
      </div>

      {filteredDeliveries.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center">
          <RiInboxArchiveLine className="mx-auto text-4xl text-slate-400" />
          <h3 className="mt-4 text-lg font-medium text-slate-900">Aún no hay entregas</h3>
          <p className="mt-2 text-sm text-slate-500">
            No has realizado ninguna entrega para este proyecto.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="min-w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-[0.16em] text-slate-500">
                <th className="px-4 py-3 font-medium">Versión</th>
                <th className="px-4 py-3 font-medium">Proyecto</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Nota</th>
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDeliveries.map((d) => (
                <tr key={d.id} className="transition hover:bg-slate-50">
                  {(() => {
                    const assignment =
                      assignments.find((candidate) => candidate.id === d.assignmentId) ??
                      null;
                    const workflow = describeStudentWorkflowState(
                      deriveStudentWorkflowState({
                        assignment,
                        delivery: d,
                        latestRun: latestRunByDeliveryId[d.id] ?? null,
                      }),
                      {
                        isLate: d.isLate,
                        projectTitle: d.projectTitle,
                      },
                    );

                    return (
                      <>
                  <td className="px-4 py-4 text-sm font-medium text-slate-950">
                    v{d.version}
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-600">
                    {d.projectTitle ?? "Proyecto"}
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${workflow.badgeClassName}`}>
                      {workflow.label}
                    </span>
                    {d.isLate ? (
                      <div className="mt-2 text-xs font-medium text-amber-700">Fuera de plazo</div>
                    ) : null}
                    <div className="mt-2 text-xs text-slate-500">
                      {workflow.description}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-600">
                    {d.grade !== null ? d.grade.toFixed(2) : "Pendiente"}
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-600">
                    {new Date(d.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <button 
                      className="btn-secondary text-xs"
                      onClick={() => handleSelectReport(d)}
                    >
                      <RiFileTextLine /> Ver informe
                    </button>
                  </td>
                      </>
                    );
                  })()}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
