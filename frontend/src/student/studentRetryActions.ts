/**
 * @fileoverview Panel y vista del espacio del alumno (studentRetryActions).
 *
 * @module studentRetryActions
 */

import type { BuildRunEntity } from "../features/builder/types";
import type { DeliveryEntity } from "../features/deliveries/types";

interface StudentRetryAction {
  enabled: boolean;
  label: string;
}

export function deriveStudentRetryAction(
  delivery: DeliveryEntity | null | undefined,
  latestRun: BuildRunEntity | null | undefined,
): StudentRetryAction | null {
  if (!delivery) {
    return null;
  }

  const isFailedRun = latestRun?.status === "FAILED";
  const hasReport = Boolean(latestRun?.reportSummary?.hasReport);

  // Si no hay run previo, o el run previo aún no tiene reporte y no ha fallado (ej. en curso), no hay reintento
  if (!hasReport && !isFailedRun) {
    return null;
  }

  if (delivery.remainingDeliveries <= 0) {
    return {
      enabled: false,
      label: "Sin intentos para reenviar",
    };
  }

  return {
    enabled: true,
    label:
      isFailedRun || latestRun?.reportSummary?.passReadiness === "BLOCKED"
        ? "Corregir y reenviar"
        : "Mejorar y subir nueva versión",
  };
}
