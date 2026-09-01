/**
 * @fileoverview Vista y gestión de entregas de código de alumnos (DeliveryStatusBadge).
 *
 * @module DeliveryStatusBadge
 */

import { StatusBadge, type StatusTone } from '../../shared/components/ui/StatusBadge';
import type { DeliveryStatus } from '../../features/deliveries/types';

const STATUS_TONE: Record<DeliveryStatus, StatusTone> = {
  DRAFT: 'draft',
  SUBMITTED: 'info',
  IN_REVIEW: 'warning',
  EVALUATED: 'success',
};

const STATUS_LABEL: Record<DeliveryStatus, string> = {
  DRAFT: 'Borrador',
  SUBMITTED: 'Entregada',
  IN_REVIEW: 'En revisión',
  EVALUATED: 'Evaluada',
};

interface DeliveryStatusBadgeProps {
  status: DeliveryStatus;
  className?: string;
}

export function DeliveryStatusBadge({ status, className }: DeliveryStatusBadgeProps) {
  return (
    <StatusBadge tone={STATUS_TONE[status]} className={className}>
      {STATUS_LABEL[status]}
    </StatusBadge>
  );
}
