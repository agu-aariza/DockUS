/**
 * @fileoverview Módulo de la interfaz de usuario (AuthAsidePanel).
 *
 * @module AuthAsidePanel
 */

import { PipelineStageList } from "../../landing/components/PipelineStageList";
import { UniversityCrest } from "../../landing/components/UniversityCrest";

/**
 * Columna izquierda de la pantalla de acceso.
 *
 * Repite la tesis y las seis etapas de la landing a propósito: quien llega
 * aquí desde la portada reconoce lo mismo, y quien entra directo a `/acceso`
 * no se queda sin contexto. Es contenido real —las etapas salen del builder—,
 * no relleno decorativo.
 *
 * Se oculta por debajo de `lg`: en móvil la columna del formulario ya lleva
 * su propio membrete, así que no queda ningún hueco vacío.
 */
export function AuthAsidePanel(): JSX.Element {
  return (
    <aside className="hidden border-r border-app-border bg-app-surface lg:flex lg:w-[46%] lg:shrink-0 lg:flex-col lg:justify-between lg:p-10 xl:p-12">
      <div className="flex items-center gap-3">
        <img src="/logos/Logo01.png" alt="" className="h-10 w-10 shrink-0 rounded-full" />
        <div className="leading-tight">
          <div className="text-sm font-semibold tracking-wide">EduCode AI</div>
          <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-app-text-muted">
            Containerizing Academic Excellence
          </div>
        </div>
      </div>

      <div className="my-8">
        <p className="institutional-line text-accent">
          Universidad de Sevilla · Departamento de Telemática
        </p>
        <div className="accent-rule mt-4" />

        <p className="mt-5 font-display text-2xl leading-[1.18] text-balance xl:text-3xl">
          <span className="block">Informe inmediato para el alumno.</span>
          <span className="mt-1 block">Corrección más eficiente para el docente.</span>
        </p>

        <PipelineStageList compact className="mt-7" />
      </div>

      <div className="flex items-center gap-3">
        <UniversityCrest className="h-11 w-11" />
        <span className="font-mono text-[11px] leading-tight text-app-text-muted">
          © 2026 Universidad de Sevilla
          <br />
          Departamento de Telemática
        </span>
      </div>
    </aside>
  );
}
