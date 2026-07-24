/**
 * @fileoverview Vista y gestión de entregas de código de alumnos (DeliveryOverview).
 *
 * @module DeliveryOverview
 */

import { RiTimeLine, RiStackLine, RiSparkling2Line, RiFileChartLine, RiRefreshLine, RiFileTextLine, RiFolderChartLine, RiPulseLine } from "react-icons/ri";
import { DeliveryEntity, ProjectEntity, ProjectAssignmentEntity } from "../../shared/types";
import { MetricCard } from "../../shared/components/MetricCard";
import { Button } from "../../shared/components/ui/Button";
import { AssignmentLabel } from "./AssignmentLabel";
import { formatDateTime } from "../utils";
import { DetailTab } from "../hooks/useDeliveriesPanel";

export function DeliveryOverview({
  selectedDelivery,
  selectedProject,
  selectedAssignment,
  selectedDeliveryReviewNotes,
  canWrite,
  onRefreshDeliveries,
  onSetDetailTab,
  onNavigateRuntime,
}: {
  selectedDelivery: DeliveryEntity;
  selectedProject: ProjectEntity | undefined;
  selectedAssignment: ProjectAssignmentEntity | undefined;
  selectedDeliveryReviewNotes: { manualNotes?: string | null };
  canWrite: boolean;
  onRefreshDeliveries: () => void;
  onSetDetailTab: (_tab: DetailTab) => void;
  onNavigateRuntime: () => void;
}) {
  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-4">
        <MetricCard
          label="Recepción"
          value={formatDateTime(selectedDelivery.createdAt)}
          helper="Fecha y hora"
          icon={<RiTimeLine />}
          variant="default"
        />
        <MetricCard
          label="Histórico"
          value={`${selectedDelivery.deliveryCount} entregas`}
          helper="Total acumulado"
          icon={<RiStackLine />}
        />
        <MetricCard
          label="Disponibles"
          value={`${selectedDelivery.remainingDeliveries} intentos`}
          helper="Cupo restante"
          icon={<RiSparkling2Line />}
        />
        <MetricCard
          label="Nota Oficial"
          value={selectedDelivery.grade !== null ? selectedDelivery.grade.toFixed(2) : "Pendiente"}
          helper="Escala 0-10"
          icon={<RiFileChartLine />}
          variant={selectedDelivery.grade !== null ? "default" : "warning"}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-lg border border-app-border bg-white p-6">
          <h4 className="text-sm font-semibold text-slate-900">
            Contexto de revisión
          </h4>
          <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
            <div>
              <strong className="text-slate-900">Proyecto:</strong>{" "}
              {selectedProject?.title || selectedDelivery.projectTitle}
            </div>
            <div>
              <strong className="text-slate-900">Asignación:</strong>{" "}
              <AssignmentLabel assignment={selectedAssignment} />
            </div>
            <div>
              <strong className="text-slate-900">Requisito mínimo:</strong>{" "}
              {selectedDelivery.minimumRequirementMet
                ? "Cumplido"
                : "Todavía pendiente"}
            </div>
            <div>
              <strong className="text-slate-900">Notas del alumno:</strong>{" "}
              {selectedDelivery.notes || "Sin observaciones del alumno."}
            </div>
            <div>
              <strong className="text-slate-900">Observaciones docentes:</strong>{" "}
              {selectedDeliveryReviewNotes.manualNotes ||
                "Aún no hay feedback manual publicado."}
            </div>
          </div>
        </article>

        <article className="rounded-lg border border-app-border bg-white p-6">
          <h4 className="text-sm font-semibold text-slate-900">
            Acciones rápidas
          </h4>
          <div className="mt-4 space-y-2">
            <Button
              variant="secondary"
              size="sm"
              className="w-full justify-start"
              onClick={onRefreshDeliveries}
            >
              <RiRefreshLine />
              Refrescar cola actual
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="w-full justify-start"
              onClick={() => onSetDetailTab("report")}
            >
              <RiFileTextLine />
              Cargar último informe
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="w-full justify-start"
              onClick={() => onSetDetailTab("grading")}
            >
              <RiFolderChartLine />
              Editar nota y feedback
            </Button>
            {canWrite && (
              <Button
                variant="secondary"
                size="sm"
                className="w-full justify-start"
                onClick={onNavigateRuntime}
              >
                <RiPulseLine />
                Abrir runtime contextual
              </Button>
            )}
          </div>

          <div className="mt-5 rounded-lg border border-app-border bg-slate-50 p-4 text-sm leading-6 text-slate-600">
            <div>
              <strong className="text-slate-900">Estado operativo:</strong>{" "}
              {selectedDelivery.status === "SUBMITTED"
                ? "Pendiente de corrección"
                : selectedDelivery.status === "IN_REVIEW"
                  ? "Builder o revisión en curso"
                  : selectedDelivery.status === "EVALUATED"
                    ? "Cierre técnico disponible"
                    : "Borrador aún no entregado"}
            </div>
            <div className="mt-2">
              <strong className="text-slate-900">Prioridad:</strong>{" "}
              {selectedDelivery.isLate
                ? "Conviene revisar el impacto de la entrega tardía."
                : selectedDelivery.grade === null &&
                    selectedDelivery.status === "EVALUATED"
                  ? "Falta consolidar nota oficial."
                  : "Flujo estable."}
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}
