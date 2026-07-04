import type { BuildRunEntity, DeliveryEntity } from "../shared/types";

interface StudentRetryAction {
  enabled: boolean;
  label: string;
}

export function deriveStudentRetryAction(
  delivery: DeliveryEntity | null | undefined,
  latestRun: BuildRunEntity | null | undefined,
): StudentRetryAction | null {
  if (!delivery || !latestRun?.report?.coaching) {
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
      latestRun.report.coaching.passReadiness === "BLOCKED"
        ? "Corregir y reenviar"
        : "Mejorar y subir nueva version",
  };
}
