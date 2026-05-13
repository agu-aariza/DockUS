import {
  RiAlertLine,
  RiCheckboxCircleLine,
  RiCloseCircleLine,
  RiCloseLine,
  RiFileTextLine,
  RiGraduationCapLine,
} from "react-icons/ri";

import type { EvaluationNotification } from "./evaluationNotifications";

interface Props {
  notifications: EvaluationNotification[];
  onDismiss: (notificationId: string) => void;
  onDismissAll: () => void;
  onViewReport: (deliveryId: string) => void;
}

function getNotificationConfig(notification: EvaluationNotification) {
  if (notification.kind === "grade_published") {
    return {
      icon: RiGraduationCapLine,
      bg: "bg-emerald-50 border-emerald-200",
      iconColor: "text-emerald-600",
      label: "Nota oficial publicada",
      description:
        notification.grade !== null
          ? `Tu profesor ya consolidó la nota oficial: ${notification.grade.toFixed(2)}.`
          : "Tu profesor ya consolidó la nota oficial.",
    };
  }

  if (notification.outcome === "FAILED") {
    return {
      icon: RiCloseCircleLine,
      bg: "bg-rose-50 border-rose-200",
      iconColor: "text-rose-600",
      label: "Informe técnico disponible",
      description: "La evaluación terminó con incidencias y ya puedes revisar el informe.",
    };
  }

  if (notification.outcome === "CANCELLED") {
    return {
      icon: RiAlertLine,
      bg: "bg-amber-50 border-amber-200",
      iconColor: "text-amber-600",
      label: "Informe técnico disponible",
      description: "La evaluación quedó cancelada, pero ya tienes contexto técnico consultable.",
    };
  }

  return {
    icon: RiCheckboxCircleLine,
    bg: "bg-brand-blue/5 border-brand-blue/20",
    iconColor: "text-brand-blue",
    label: "Informe técnico disponible",
    description: "Tu evaluación terminó y el informe técnico ya está listo para consulta.",
  };
}

export function EvaluationNotificationBanner({
  notifications,
  onDismiss,
  onDismissAll,
  onViewReport,
}: Props): JSX.Element | null {
  if (notifications.length === 0) return null;

  return (
    <div
      className="mb-6 space-y-3 animate-in fade-in slide-in-from-top-4 duration-300"
      aria-live="polite"
    >
      {notifications.length > 1 ? (
        <div className="flex justify-end">
          <button
            className="text-xs font-medium text-slate-500 transition hover:text-slate-700"
            onClick={onDismissAll}
          >
            Descartar todas
          </button>
        </div>
      ) : null}

      {notifications.map((notification) => {
        const config = getNotificationConfig(notification);
        const Icon = config.icon;

        return (
          <div
            key={notification.id}
            className={`relative rounded-2xl border p-4 shadow-sm transition-all ${config.bg} animate-in fade-in slide-in-from-top-2 duration-200`}
          >
            <button
              className="absolute right-3 top-3 text-slate-400 transition hover:text-slate-600"
              onClick={() => onDismiss(notification.id)}
              aria-label="Descartar notificación"
            >
              <RiCloseLine className="text-lg" />
            </button>

            <div className="flex items-start gap-3 pr-8">
              <Icon className={`mt-0.5 flex-shrink-0 text-2xl ${config.iconColor}`} />
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-semibold text-slate-900">
                  {config.label}
                </h4>
                <p className="mt-0.5 text-xs text-slate-600">
                  <strong>v{notification.deliveryVersion}</strong> · {notification.projectTitle}
                </p>
                <p className="mt-1 text-xs text-slate-500">{config.description}</p>
                <button
                  className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-indigo-600 transition hover:text-indigo-800"
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
