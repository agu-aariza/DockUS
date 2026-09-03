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
  if (!delivery || !latestRun?.reportSummary.hasReport) {
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
      latestRun.reportSummary.passReadiness === "BLOCKED"
        ? "Corregir y reenviar"
        : "Mejorar y subir nueva versión",
  };
}
