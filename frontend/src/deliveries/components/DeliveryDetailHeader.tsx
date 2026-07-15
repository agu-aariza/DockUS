import { RiCodeSSlashLine, RiArrowRightUpLine, RiStackLine, RiFolderChartLine, RiFileTextLine } from "react-icons/ri";
import { DeliveryEntity } from "../../shared/types";
import { Tabs } from "../../shared/components/ui/Tabs";
import { Button } from "../../shared/components/ui/Button";
import { DeliveryStatusBadge } from "../../features/deliveries/components/DeliveryStatusBadge";
import { StatusBadge } from "../../shared/components/ui/StatusBadge";
import { DetailTab } from "../hooks/useDeliveriesPanel";

export function DeliveryDetailHeader({
  selectedDelivery,
  detailTab,
  setDetailTab,
  handlePreview,
  canWrite,
  onNavigateRuntime,
}: {
  selectedDelivery: DeliveryEntity;
  detailTab: DetailTab;
  setDetailTab: (_tab: DetailTab) => void;
  handlePreview: (_id: string) => void;
  canWrite: boolean;
  onNavigateRuntime: () => void;
}) {
  return (
    <article className="rounded-lg border border-app-border bg-white p-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <DeliveryStatusBadge status={selectedDelivery.status} />
            <StatusBadge tone={selectedDelivery.isLate ? "danger" : "success"}>
              {selectedDelivery.isLate ? "Entrega Tardía" : "A Tiempo"}
            </StatusBadge>
            <span className="rounded-full border border-app-border bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-500">
              Versión {selectedDelivery.version}
            </span>
          </div>

          <h3 className="mt-4 text-base font-semibold text-slate-900">
            {selectedDelivery.studentName}
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            {selectedDelivery.projectTitle} · <span className="text-slate-400">{selectedDelivery.studentEmail}</span>
          </p>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-600">
            {selectedDelivery.notes || "Sin notas adicionales del alumno para esta entrega."}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Tabs 
            tabs={[
              { id: "overview", label: "Resumen", icon: RiStackLine },
              { id: "grading", label: "Calificación", icon: RiFolderChartLine },
              { id: "report", label: "Informe", icon: RiFileTextLine },
            ]}
            activeTab={detailTab}
            onTabChange={(id) => setDetailTab(id as DetailTab)}
          />
          
          <div className="mx-2 h-9 w-px bg-app-border" />

          <Button
            variant="secondary"
            size="sm"
            onClick={() => handlePreview(selectedDelivery.id)}
          >
            <RiCodeSSlashLine />
            Ver código
          </Button>
          
          {canWrite && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onNavigateRuntime}
            >
              <RiArrowRightUpLine />
              Runtime
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
