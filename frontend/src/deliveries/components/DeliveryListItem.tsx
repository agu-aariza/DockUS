/**
 * @fileoverview Vista y gestión de entregas de código de alumnos (DeliveryListItem).
 *
 * @module DeliveryListItem
 */

import { useState } from "react";
import { RiTimeLine, RiFileChartLine, RiStackLine, RiFileTextLine } from "react-icons/ri";
import { DeliveryEntity } from "../../shared/types";
import { DeliveryStatusBadge } from "../../features/deliveries/components/DeliveryStatusBadge";
import { formatDateTime } from "../utils";

const STATUS_TEXT: Record<DeliveryEntity["status"], string> = {
  DRAFT: "Borrador",
  SUBMITTED: "Entregada",
  IN_REVIEW: "En revisión",
  EVALUATED: "Evaluada",
};

export function DeliveryListItem({
  delivery,
  active,
  onSelect,
  onOpenReport,
  onQuickGrade,
}: {
  delivery: DeliveryEntity;
  active: boolean;
  onSelect: () => void;
  onOpenReport: () => void;
  onQuickGrade: (_grade: number) => void;
}) {
  const [inlineGrade, setInlineGrade] = useState(
    delivery.grade !== null ? String(delivery.grade) : "",
  );
  const canInlineGrade =
    delivery.status === "IN_REVIEW" || delivery.status === "EVALUATED";

  const commitGrade = () => {
    const parsed = parseFloat(inlineGrade);
    if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 10) {
      onQuickGrade(parsed);
    }
  };

  return (
    <article
      className={`group relative w-full overflow-hidden rounded-xl border p-4 text-left ${
        active
          ? "border-primary bg-primary text-white shadow-md shadow-primary/20"
          : "card-interactive border-app-border bg-white"
      }`}
    >
      <button type="button" onClick={onSelect} className="w-full text-left focus:outline-none">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className={`text-xs font-semibold ${active ? "text-primary-100 opacity-80" : "text-slate-400"}`}>
              v{delivery.version}
            </div>
            <div className="mt-0.5 truncate text-sm font-bold text-current">
              {delivery.studentName}
            </div>
          </div>
          {active ? (
            <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-xs font-medium text-white shadow-inner">
              {STATUS_TEXT[delivery.status]}
            </span>
          ) : (
            <DeliveryStatusBadge status={delivery.status} />
          )}
        </div>

        <div className={`mt-3 space-y-1 text-xs font-medium leading-tight ${active ? "text-primary-100/90" : "text-slate-500"}`}>
          <div className="flex items-center gap-1.5">
            <RiTimeLine className="text-sm opacity-60" />
            {formatDateTime(delivery.createdAt)}
          </div>
          <div className="flex items-center gap-1.5">
            <RiFileChartLine className="text-sm opacity-60" />
            <span className={delivery.isLate ? "text-rose-500 font-bold" : "text-success-500 font-bold"}>
              {delivery.isLate ? "Retrasada" : "En plazo"}
            </span>
          </div>
        </div>
      </button>

      {canInlineGrade ? (
        // El div no realiza ninguna acción propia: solo evita que un clic en
        // el input burbujee hasta el <button> de selección de la tarjeta. El
        // input y el botón de abajo ya gestionan su propio teclado.
        // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
        <div
          className="mt-3 flex items-center gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          <RiFileChartLine className={`text-sm ${active ? "text-white/60" : "text-slate-400"}`} />
          <input
            type="number"
            min={0}
            max={10}
            step={0.5}
            aria-label="Nota numérica 0–10"
            value={inlineGrade}
            onChange={(e) => setInlineGrade(e.target.value)}
            onBlur={commitGrade}
            onKeyDown={(e) => e.key === "Enter" && commitGrade()}
            placeholder="0–10"
            className={`w-20 rounded-lg border px-2 py-1 text-xs font-bold focus:outline-none focus:ring-2 ${
              active
                ? "border-white/20 bg-white/10 text-white placeholder-white/40 focus:ring-white/30"
                : "border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 focus:ring-primary/20"
            }`}
          />
          <span className={`text-xs ${active ? "text-white/60" : "text-slate-400"}`}>/ 10</span>
        </div>
      ) : (
        <div className={`mt-3 flex items-center gap-1.5 text-xs font-medium ${active ? "text-white" : "text-slate-500"}`}>
          <RiFileChartLine className="text-sm opacity-60" />
          <span className={active ? "text-white" : "text-slate-900 font-bold"}>
            {delivery.grade !== null ? `Nota: ${delivery.grade.toFixed(2)}` : "Nota pendiente"}
          </span>
        </div>
      )}

      <div className={`mt-3 flex items-center justify-between border-t pt-3 ${active ? "border-white/10" : "border-slate-100"}`}>
        <div className={`flex items-center gap-1 text-xs font-medium ${active ? "text-primary-100/90" : "text-slate-400"}`}>
          <RiStackLine className="text-xs" />
          {delivery.remainingDeliveries} disponibles
        </div>
        <button
          type="button"
          className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all active:scale-[0.98] ${
            active
              ? "bg-white/10 text-white hover:bg-white/20"
              : "bg-white text-slate-700 hover:bg-slate-50 border border-slate-200"
          }`}
          onClick={(event) => {
            event.stopPropagation();
            onOpenReport();
          }}
        >
          <RiFileTextLine className="text-sm" />
          Informe
        </button>
      </div>
    </article>
  );
}
