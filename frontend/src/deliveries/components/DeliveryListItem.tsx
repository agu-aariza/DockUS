import { useState } from "react";
import { RiTimeLine, RiFileChartLine, RiStackLine, RiFileTextLine } from "react-icons/ri";
import { DeliveryEntity } from "../../shared/types";
import { StatusBadge } from "../../shared/components/ui/StatusBadge";
import { formatDateTime } from "../utils";

function statusTone(status: DeliveryEntity["status"]) {
  switch (status) {
    case "SUBMITTED":
      return "info";
    case "IN_REVIEW":
      return "warning";
    case "EVALUATED":
      return "success";
    default:
      return "draft";
  }
}

function statusText(status: DeliveryEntity["status"]) {
  switch (status) {
    case "SUBMITTED":
      return "Entregada";
    case "IN_REVIEW":
      return "En revisión";
    case "EVALUATED":
      return "Evaluada";
    default:
      return "Borrador";
  }
}

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
      className={`group w-full rounded-xl border p-4 text-left transition-all duration-200 relative overflow-hidden ${
        active
          ? "border-primary bg-gradient-to-r from-primary to-blue-700 text-white shadow-md shadow-primary/20"
          : "border-app-border bg-white hover:border-slate-300 hover:-translate-y-[2px] hover:shadow-md"
      }`}
    >
      <button type="button" onClick={onSelect} className="w-full text-left focus:outline-none">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className={`text-xs font-semibold ${active ? "text-blue-100 opacity-80" : "text-slate-400"}`}>
              v{delivery.version}
            </div>
            <div className="mt-0.5 truncate text-sm font-bold text-current">
              {delivery.studentName}
            </div>
          </div>
          {active ? (
            <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-xs font-medium text-white shadow-inner">
              {statusText(delivery.status)}
            </span>
          ) : (
            <StatusBadge tone={statusTone(delivery.status)}>
              {statusText(delivery.status)}
            </StatusBadge>
          )}
        </div>

        <div className={`mt-3 space-y-1 text-xs font-medium leading-tight ${active ? "text-blue-100/90" : "text-slate-500"}`}>
          <div className="flex items-center gap-1.5">
            <RiTimeLine className="text-sm opacity-60" />
            {formatDateTime(delivery.createdAt)}
          </div>
          <div className="flex items-center gap-1.5">
            <RiFileChartLine className="text-sm opacity-60" />
            <span className={delivery.isLate ? "text-rose-500 font-bold" : "text-emerald-500 font-bold"}>
              {delivery.isLate ? "Retrasada" : "En plazo"}
            </span>
          </div>
        </div>
      </button>

      {canInlineGrade ? (
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
        <div className={`flex items-center gap-1 text-xs font-medium ${active ? "text-blue-100/90" : "text-slate-400"}`}>
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
