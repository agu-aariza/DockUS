/**
 * @fileoverview Componente de progreso y métricas de proyectos (ProgressStatsPanel).
 *
 * @module ProgressStatsPanel
 */

import {
  RiAwardLine,
  RiCheckboxCircleLine,
  RiTimeLine,
} from "react-icons/ri";
import { MetricCard } from "../../../shared/components/MetricCard";
import type { ProjectProgressSummary } from "../../../features/projects/types";

interface ProgressStatsPanelProps {
  summary: ProjectProgressSummary;
}

// El total de alumnos ya vive en `ParticipationProgress` (delivered/total):
// repetirlo aquí como cuarta tarjeta era la misma cifra dos veces en el
// mismo tramo de pantalla.
export function ProgressStatsPanel({
  summary,
}: ProgressStatsPanelProps): JSX.Element {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
      <MetricCard
        label="Han entregado"
        value={summary.deliveredAtLeastOnce}
        icon={<RiCheckboxCircleLine />}
        variant="info"
      />
      <MetricCard
        label="Con PASS"
        value={summary.passedAllTests}
        icon={<RiAwardLine />}
        variant="success"
      />
      <MetricCard
        label="Pendientes"
        value={summary.neverDelivered}
        icon={<RiTimeLine />}
        variant="warning"
      />
    </div>
  );
}
