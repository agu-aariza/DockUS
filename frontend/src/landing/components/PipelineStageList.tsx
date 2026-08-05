/**
 * @fileoverview Módulo de la interfaz de usuario (PipelineStageList).
 *
 * @module PipelineStageList
 */

import { useState } from "react";
import { PIPELINE_STAGES } from "../pipelineStages";

interface PipelineStageListProps {
  /** Filas más apretadas, para la columna lateral de `/acceso`. */
  compact?: boolean;
  className?: string;
}

/**
 * Las seis etapas del pipeline. El resumen se ve siempre; la explicación
 * larga se despliega al pasar el cursor.
 *
 * Cada fila es un `<button>` sin aspecto de botón, a propósito: así el
 * despliegue también ocurre al llegar con el tabulador y al tocar en pantalla
 * táctil, donde no hay cursor que pasar. No lleva icono de más/menos porque
 * la fila no es un acordeón que haya que ir abriendo: el detalle es un
 * añadido opcional, no contenido escondido.
 *
 * El texto largo vive siempre en el DOM —se pliega con `grid-template-rows`,
 * no se desmonta— para que siga en el árbol de accesibilidad y sea buscable.
 */
export function PipelineStageList({
  compact = false,
  className = "",
}: PipelineStageListProps): JSX.Element {
  const [active, setActive] = useState<string | null>(null);

  return (
    <ol className={`divide-y divide-app-border border-y border-app-border ${className}`}>
      {PIPELINE_STAGES.map((stage, index) => {
        const expanded = active === stage.id;
        return (
          <li key={stage.id}>
            <button
              type="button"
              aria-expanded={expanded}
              aria-controls={`stage-detail-${stage.id}`}
              onMouseEnter={() => setActive(stage.id)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(stage.id)}
              onBlur={() => setActive(null)}
              onClick={() => setActive((prev) => (prev === stage.id ? null : stage.id))}
              className={`flex w-full items-baseline gap-4 rounded-sm text-left transition-colors hover:bg-app-bg-subtle/60 focus-visible:ring-2 focus-visible:ring-accent/40 ${
                compact ? "py-2" : "py-3"
              }`}
            >
              <span className="w-6 shrink-0 font-mono text-xs tabular-nums text-accent">
                {String(index + 1).padStart(2, "0")}
              </span>

              <span className="min-w-0 flex-1">
                <span className="block font-mono text-sm text-app-text">{stage.id}</span>
                <span className="mt-0.5 block text-sm text-app-text-secondary">
                  {stage.summary}
                </span>
                <span
                  id={`stage-detail-${stage.id}`}
                  className={`grid text-sm leading-relaxed text-app-text-muted transition-all duration-[--motion-state] ${
                    expanded ? "mt-2 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                  }`}
                >
                  <span className="overflow-hidden">{stage.detail}</span>
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
