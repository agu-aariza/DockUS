import { DeliveryStatus } from "../../shared/types";
import { StatusBadge } from "../../shared/components/ui/StatusBadge";

export const STATUS_TEXT: Record<DeliveryStatus, string> = {
  DRAFT: "Borrador",
  SUBMITTED: "Entregada",
  IN_REVIEW: "En revisión",
  EVALUATED: "Evaluada",
};

function statusTone(status: DeliveryStatus) {
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

export function DeliveryStatusPill({ status }: { status: DeliveryStatus }) {
  return (
    <StatusBadge tone={statusTone(status)}>
      {STATUS_TEXT[status]}
    </StatusBadge>
  );
}
