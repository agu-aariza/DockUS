/**
 * @fileoverview Panel de resumen y analíticas generales docentes (CourseStatusStrip).
 *
 * @module CourseStatusStrip
 */

import type { ReactNode } from "react";

export interface CourseStatusReading {
  label: string;
  value: number;
  helper: string;
  /** Marca la lectura que exige atención: solo una debe encenderse a la vez. */
  alert?: boolean;
}

interface CourseStatusStripProps {
  readings: CourseStatusReading[];
}

/**
 * Lectura de estado del curso: cuatro cifras en una sola superficie, separadas por
 * filetes en lugar de encajadas en tarjetas. Se lee como el panel de un instrumento,
 * no como un carrusel de KPIs.
 */
export function CourseStatusStrip({ readings }: CourseStatusStripProps): JSX.Element {
  return (
    <section
      aria-label="Estado del curso"
      /* gap-px sobre fondo de borde: los filetes caen entre celdas reales de la rejilla,
         a diferencia de `divide-x`, que los reparte por orden del DOM. */
      className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-app-border bg-app-border lg:grid-cols-4"
    >
      {readings.map((reading) => (
        <Reading key={reading.label} reading={reading} />
      ))}
    </section>
  );
}

function Reading({ reading }: { reading: CourseStatusReading }): JSX.Element {
  const { label, value, helper, alert } = reading;

  return (
    <div className="relative bg-white px-5 py-4">
      {alert && (
        <span
          className="absolute inset-x-0 top-0 h-0.5 bg-accent"
          aria-hidden="true"
        />
      )}
      <div className="flex items-center gap-2">
        <span className="ui-label">{label}</span>
        {alert && (
          <span
            className="status-pulse h-1.5 w-1.5 rounded-full bg-accent"
            style={{ ["--status-pulse-rgb" as string]: "91 4 13" }}
            aria-hidden="true"
          />
        )}
      </div>
      <div className="data-figure mt-2 text-3xl font-semibold">{value}</div>
      <p className="mt-1 text-xs text-slate-500">{helper}</p>
    </div>
  );
}

/** Estado de carga con la misma métrica de la tira, para que no salte el layout. */
export function CourseStatusStripSkeleton(): ReactNode {
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-app-border bg-app-border lg:grid-cols-4">
      {[0, 1, 2, 3].map((index) => (
        <div key={index} className="bg-white px-5 py-4">
          <div className="shimmer h-2.5 w-20 rounded bg-slate-100" />
          <div className="shimmer mt-3 h-8 w-12 rounded bg-slate-100" />
          <div className="shimmer mt-2 h-2.5 w-24 rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}
