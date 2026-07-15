import {
  RiAlertLine,
  RiCheckboxCircleLine,
  RiCloseCircleLine,
  RiCloseLine,
  RiFileTextLine,
  RiGraduationCapLine,
} from "react-icons/ri";

import { Alert } from "../shared/components/ui/Alert";
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
      icon: <RiGraduationCapLine />,
      variant: "success" as const,
      label: "Nota oficial publicada",
      description:
        notification.grade !== null
          ? `Tu profesor ya consolidó la nota oficial: ${notification.grade.toFixed(2)}.`
          : "Tu profesor ya consolidó la nota oficial.",
    };
  }

  if (notification.outcome === "FAILED") {
    return {
      icon: <RiCloseCircleLine />,
      variant: "danger" as const,
      label: "Informe técnico disponible",
      description: "La evaluación terminó con incidencias y ya puedes revisar el informe.",
    };
  }

  if (notification.outcome === "CANCELLED") {
    return {
      icon: <RiAlertLine />,
      variant: "warning" as const,
      label: "Informe técnico disponible",
      description: "La evaluación quedó cancelada, pero ya tienes contexto técnico consultable.",
    };
  }

  return {
    icon: <RiCheckboxCircleLine />,
    variant: "info" as const,
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
      className="surface-floating sticky top-0 z-20 space-y-3 rounded-none border-x-0 border-t-0 px-5 py-4 lg:px-8"
      aria-live="polite"
    >
      {notifications.length > 1 ? (
        <div className="flex justify-end">
          <button
            className="rounded-md px-2 py-1 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 motion-reduce:transition-none"
            onClick={onDismissAll}
          >
            Descartar todas
          </button>
        </div>
      ) : null}

      {notifications.map((notification) => {
        const config = getNotificationConfig(notification);

        return (
          <div key={notification.id} className="motion-rise-in relative">
            <Alert variant={config.variant} title={config.label} icon={config.icon}>
              <div className="space-y-2 pr-8">
                <p className="text-xs text-slate-500">
                  <strong>v{notification.deliveryVersion}</strong> · {notification.projectTitle}
                </p>
                <p className="text-xs text-slate-500">{config.description}</p>
                <button
                  className="group flex items-center gap-1.5 rounded-md py-1 text-xs font-semibold text-primary transition-colors hover:text-primary-hover motion-reduce:transition-none"
                  onClick={() => onViewReport(notification.deliveryId)}
                >
                  <RiFileTextLine aria-hidden="true" />
                  Consultar informe
                  <span className="transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none">
                    →
                  </span>
                </button>
              </div>
            </Alert>
            <button
              className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 motion-reduce:transition-none"
              onClick={() => onDismiss(notification.id)}
              aria-label="Descartar notificación"
            >
              <RiCloseLine className="text-lg" aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
