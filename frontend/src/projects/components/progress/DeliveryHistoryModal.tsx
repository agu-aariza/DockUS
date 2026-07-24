/**
 * @fileoverview Componente de progreso y métricas de proyectos (DeliveryHistoryModal).
 *
 * @module DeliveryHistoryModal
 */

import {
  RiCloseLine,
  RiCodeSSlashLine,
  RiStackLine,
} from "react-icons/ri";
import { DeliveryStatusBadge } from "../../../features/deliveries/components/DeliveryStatusBadge";
import { Skeleton } from "../../../shared/components/Skeleton";
import type { DeliveryEntity } from "../../../features/deliveries/types";

interface DeliveryHistoryModalProps {
  isOpen: boolean;
  studentName: string;
  deliveries: DeliveryEntity[];
  loading: boolean;
  onClose: () => void;
  onPreview: (deliveryId: string) => void;
}

export function DeliveryHistoryModal({
  isOpen,
  studentName,
  deliveries,
  loading,
  onClose,
  onPreview,
}: DeliveryHistoryModalProps): JSX.Element | null {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/40 p-4 motion-modal-backdrop">
      <div className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-md motion-modal-panel">
        <header className="flex items-center justify-between border-b border-app-border px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Historial de Entregas
            </h3>
            <p className="text-sm text-slate-500">
              Explorando versiones enviadas por {studentName}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar historial"
            className="flex h-10 w-10 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100"
          >
            <RiCloseLine className="text-2xl" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            // Mismo contorno que la fila real (icono + 2 líneas + botón) en
            // vez de un spinner centrado, para que la lista no cambie de
            // forma entre el estado de carga y el cargado (FE-MED-03).
            <div className="space-y-3" aria-busy="true" aria-label="Cargando versiones">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between rounded-md border border-app-border bg-slate-50/60 p-4"
                >
                  <div className="flex items-center gap-4">
                    <Skeleton type="rounded" className="h-9 w-9" />
                    <div className="space-y-2">
                      <Skeleton type="text" className="h-4 w-32" />
                      <Skeleton type="text" className="h-3 w-24" />
                    </div>
                  </div>
                  <Skeleton type="rounded" className="h-10 w-28" />
                </div>
              ))}
            </div>
          ) : deliveries.length === 0 ? (
            <div className="py-10 text-center">
              <RiStackLine className="mx-auto mb-2 text-4xl text-slate-300" />
              <p className="text-sm text-slate-500">
                No hay entregas registradas para este alumno.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {deliveries.map((delivery) => (
                <div
                  key={delivery.id}
                  className="flex items-center justify-between rounded-md border border-app-border bg-slate-50/60 p-4 transition-colors motion-reduce:transition-none hover:border-slate-300 hover:bg-white"
                >
                  <div className="flex items-center gap-4">
                    <div className="data-figure flex h-9 w-9 items-center justify-center rounded-md border border-app-border bg-slate-100 text-sm font-semibold text-slate-600">
                      v{delivery.version}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <DeliveryStatusBadge status={delivery.status} />
                        {delivery.isLate ? (
                          <span className="rounded-full border border-warning-200 bg-warning-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-warning-700">
                            Fuera de plazo
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {new Date(delivery.createdAt).toLocaleString("es-ES")}
                      </p>
                    </div>
                  </div>
                  <button
                    className="btn-secondary h-10 gap-2 px-4"
                    onClick={() => onPreview(delivery.id)}
                  >
                    <RiCodeSSlashLine />
                    Ver código
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
