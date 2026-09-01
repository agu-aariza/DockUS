/**
 * @fileoverview Vista y gestión de entregas de código de alumnos (DeliveryOutcomeBadge).
 *
 * @module DeliveryOutcomeBadge
 */

import { StatusBadge } from '../../../shared/components/ui/StatusBadge';
import type { BuildRunEntity } from '../../builder/types';
import type { DeliveryEntity } from '../types';
import { resolveStudentRunOutcome } from '../../../student/studentWorkspaceInsights';

interface DeliveryOutcomeBadgeProps {
  delivery: DeliveryEntity;
  summaryRun: BuildRunEntity | null;
  className?: string;
}

export function DeliveryOutcomeBadge({ delivery, summaryRun, className }: DeliveryOutcomeBadgeProps) {
  const outcome = resolveStudentRunOutcome(summaryRun);

  if (delivery.grade !== null) {
    return (
      <StatusBadge tone="success" className={className}>
        Nota {delivery.grade.toFixed(2)}
      </StatusBadge>
    );
  }

  if (!summaryRun) {
    return (
      <StatusBadge tone="idle" className={className}>
        Sin evaluación
      </StatusBadge>
    );
  }

  if (outcome === 'PASS') {
    return (
      <StatusBadge tone="success" className={className}>
        Apto
      </StatusBadge>
    );
  }

  if (outcome === 'FAIL') {
    return (
      <StatusBadge tone="danger" className={className}>
        No apto
      </StatusBadge>
    );
  }

  if (outcome === 'PARTIAL') {
    return (
      <StatusBadge tone="warning" className={className}>
        Necesita mejoras
      </StatusBadge>
    );
  }

  return (
    <StatusBadge tone="info" className={className}>
      En seguimiento
    </StatusBadge>
  );
}
