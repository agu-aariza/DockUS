import { RiCheckboxCircleLine, RiCloseCircleLine, RiAlertLine, RiCloseLine, RiFileTextLine } from "react-icons/ri";
import type { EvaluationNotification } from "./hooks/useEvaluationNotifications";

interface Props {
  notifications: EvaluationNotification[];
  onDismiss: (runId: string) => void;
  onDismissAll: () => void;
  onViewReport: (deliveryId: string) => void;
}

const OUTCOME_CONFIG = {
  SUCCESS: {
    icon: RiCheckboxCircleLine,
    bg: "bg-emerald-50 border-emerald-200",
    iconColor: "text-emerald-600",
    label: "Evaluación completada",
    description: "Tu código ha pasado la evaluación correctamente.",
  },
  FAILED: {
    icon: RiCloseCircleLine,
    bg: "bg-rose-50 border-rose-200",
    iconColor: "text-rose-600",
    label: "Evaluación finalizada con errores",
    description: "Se encontraron problemas durante la evaluación.",
  },
  CANCELLED: {
    icon: RiAlertLine,
    bg: "bg-amber-50 border-amber-200",
    iconColor: "text-amber-600",
    label: "Evaluación cancelada",
    description: "La evaluación fue cancelada.",
  },
};

export function EvaluationNotificationBanner({
  notifications,
  onDismiss,
  onDismissAll,
  onViewReport,
}: Props): JSX.Element | null {
  if (notifications.length === 0) return null;

  return (
    <div className="space-y-3 mb-6 animate-in fade-in slide-in-from-top-4 duration-300">
      {notifications.length > 1 && (
        <div className="flex justify-end">
          <button
            className="text-xs font-medium text-slate-500 hover:text-slate-700 transition"
            onClick={onDismissAll}
          >
            Descartar todas
          </button>
        </div>
      )}

      {notifications.map((notification) => {
        const config = OUTCOME_CONFIG[notification.outcome];
        const Icon = config.icon;

        return (
          <div
            key={notification.id}
            className={`relative rounded-2xl border p-4 shadow-sm transition-all ${config.bg} animate-in fade-in slide-in-from-top-2 duration-200`}
          >
            <button
              className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 transition"
              onClick={() => onDismiss(notification.id)}
              aria-label="Descartar notificación"
            >
              <RiCloseLine className="text-lg" />
            </button>

            <div className="flex items-start gap-3 pr-8">
              <Icon className={`text-2xl mt-0.5 flex-shrink-0 ${config.iconColor}`} />
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-slate-900">
                  {config.label}
                </h4>
                <p className="text-xs text-slate-600 mt-0.5">
                  <strong>v{notification.deliveryVersion}</strong> · {notification.projectTitle}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {config.description}
                </p>
                <button
                  className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition"
                  onClick={() => onViewReport(notification.deliveryId)}
                >
                  <RiFileTextLine />
                  Consultar informe
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
