import { useState, useEffect } from "react";
import type { SessionRecord, BuildRunEntity, DeliveryEntity } from "../shared/types";
import { builderApi } from "../shared/api/builderApi";
import { getErrorMessage } from "../shared/utils/errors";
import { useWorkspace } from "../shared/workspace/WorkspaceContext";
import { ReportView } from "../shared/components/ReportView";
import { Skeleton, SkeletonCard } from "../shared/components/Skeleton";
import { EmptyState } from "../shared/components/EmptyState";
import { RiFileTextLine, RiArrowDownSLine, RiArrowUpSLine, RiInboxArchiveLine } from "react-icons/ri";
import type { StudentWorkspaceData } from "./hooks/useStudentWorkspaceData";

interface Props {
  session: SessionRecord | null;
  data: StudentWorkspaceData;
}

function ReportContainer({ delivery, defaultOpen = false }: { delivery: DeliveryEntity; defaultOpen?: boolean }) {
  const [run, setRun] = useState<BuildRunEntity | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    if (isOpen && !hasLoaded) {
      async function loadReport() {
        setLoading(true);
        setError(null);
        try {
          const res = await builderApi.listByDelivery({ deliveryId: delivery.id, limit: 1, sortOrder: "DESC" });
          if (res.data.length > 0) {
            const fullRun = await builderApi.detail(res.data[0].id);
            setRun(fullRun);
          } else {
            setRun(null);
          }
          setHasLoaded(true);
        } catch (e) {
          setError(getErrorMessage(e));
        } finally {
          setLoading(false);
        }
      }
      void loadReport();
    }
  }, [isOpen, hasLoaded, delivery.id]);

  return (
    <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <button 
        className="flex w-full items-center justify-between bg-slate-50 px-6 py-4 transition hover:bg-slate-100"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-4">
          <RiFileTextLine className="text-xl text-slate-400" />
          <div className="text-left">
            <h4 className="text-sm font-semibold text-slate-900">
              Entrega v{delivery.version} · {delivery.projectTitle ?? "Proyecto"}
            </h4>
            <span className="text-xs text-slate-500">
              {new Date(delivery.createdAt).toLocaleString()}
            </span>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-slate-600">
                {delivery.grade !== null ? `Nota ${delivery.grade.toFixed(2)}` : "Sin nota"}
              </span>
              {delivery.isLate ? (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-700">
                  Fuera de plazo
                </span>
              ) : null}
            </div>
          </div>
        </div>
        {isOpen ? <RiArrowUpSLine className="text-xl text-slate-400" /> : <RiArrowDownSLine className="text-xl text-slate-400" />}
      </button>

      {isOpen && (
        <div className="border-t border-slate-200 p-6 bg-slate-50/50">
          <div className="mb-5 grid gap-4 lg:grid-cols-3">
            <article className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Nota final
              </div>
              <div className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
                {delivery.grade !== null ? delivery.grade.toFixed(2) : "Pendiente"}
              </div>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Estado de entrega
              </div>
              <div className="mt-3 text-sm font-medium text-slate-900">
                {delivery.isLate ? "Fuera de plazo" : "Dentro de plazo"}
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {delivery.isLate
                  ? "La versión se recibió después del cierre y queda marcada como tardía."
                  : "La versión quedó registrada dentro de la ventana prevista."}
              </p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Observaciones del profesor
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {delivery.graderNotes || "Todavía no hay observaciones manuales añadidas por el profesorado."}
              </p>
            </article>
          </div>

          {loading ? (
            <div className="text-center text-sm text-slate-500 py-4">Cargando informe...</div>
          ) : error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">Error: {error}</div>
          ) : !run ? (
            <div className="text-center text-sm text-slate-500 py-4">Esta entrega aún no ha sido evaluada.</div>
          ) : (
            <ReportView run={run} deliveryVersion={delivery.version} mode="student" />
          )}
        </div>
      )}
    </div>
  );
}

export function StudentReportsSection({ session, data }: Props): JSX.Element {
  const { selection } = useWorkspace();
  const { deliveries, loading, error } = data;

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton type="text" className="h-6 w-52 mb-6" />
        {[1, 2].map(i => <SkeletonCard key={i} />)}
      </div>
    );
  }

  if (error) {
    return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-800 font-medium shadow-sm">Error: {error}</div>;
  }

  if (deliveries.length === 0) {
    return (
      <EmptyState 
        icon={<RiInboxArchiveLine className="text-4xl text-slate-400" />}
        title="Aún no hay informes"
        description="No tienes entregas registradas en esta asignatura. Realiza tu primera entrega para generar un informe de evaluación técnica."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold tracking-tight text-slate-950">
          Mis Informes de Evaluación
        </h3>
        <span className="text-sm text-slate-500">
          Mostrando los {Math.min(15, deliveries.length)} más recientes
        </span>
      </div>
      
      <div className="space-y-4">
        {deliveries.slice(0, 15).map((delivery) => (
          <ReportContainer 
            key={delivery.id} 
            delivery={delivery} 
            defaultOpen={selection.deliveryId === delivery.id || (deliveries.length === 1)}
          />
        ))}
      </div>
    </div>
  );
}
