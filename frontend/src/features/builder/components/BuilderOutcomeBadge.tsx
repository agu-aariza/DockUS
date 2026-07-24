/**
 * @fileoverview Vista y componentes del motor Builder de evaluación (BuilderOutcomeBadge).
 *
 * @module BuilderOutcomeBadge
 */

import { StatusBadge, type StatusTone } from '../../../shared/components/ui/StatusBadge';
import type { BuilderOutcome } from '../types';

const OUTCOME_TONE: Record<BuilderOutcome, StatusTone> = {
  PASS: 'success',
  PARTIAL: 'warning',
  FAIL: 'danger',
  UNKNOWN: 'idle',
};

interface BuilderOutcomeBadgeProps {
  outcome: BuilderOutcome | null;
  className?: string;
}

export function BuilderOutcomeBadge({ outcome, className }: BuilderOutcomeBadgeProps) {
  const resolved = outcome ?? 'UNKNOWN';

  return (
    <StatusBadge tone={OUTCOME_TONE[resolved]} className={className}>
      {resolved}
    </StatusBadge>
  );
}
