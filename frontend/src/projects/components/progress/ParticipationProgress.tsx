/**
 * @fileoverview Componente de progreso y métricas de proyectos (ParticipationProgress).
 *
 * @module ParticipationProgress
 */

interface ParticipationProgressProps {
  rate: number;
}

export function ParticipationProgress({
  rate,
}: ParticipationProgressProps): JSX.Element {
  return (
    <div className="rounded-lg border border-app-border bg-white p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-900">
            Participación global
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Porcentaje de alumnos que ya registraron al menos una entrega.
          </p>
        </div>
        <span className="data-figure text-3xl font-semibold text-primary">{rate}%</span>
      </div>
      <div className="mt-5 h-3 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full bg-primary transition-[width] duration-300 ease-out motion-reduce:transition-none"
          style={{ width: `${rate}%` }}
        />
      </div>
    </div>
  );
}
