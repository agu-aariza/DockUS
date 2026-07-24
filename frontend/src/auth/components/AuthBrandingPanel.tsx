/**
 * @fileoverview Módulo de la interfaz de usuario (AuthBrandingPanel).
 *
 * @module AuthBrandingPanel
 */

import { RiCommandLine, RiDashboardLine, RiUploadCloud2Line } from "react-icons/ri";

/* ─── Particles Data ─── */
const PARTICLES = [
  { size: 3, left: '12%', top: '18%', anim: 'auth-particle-1', dur: '14s', delay: '0s' },
  { size: 4, left: '75%', top: '25%', anim: 'auth-particle-2', dur: '18s', delay: '2s' },
  { size: 2, left: '35%', top: '65%', anim: 'auth-particle-3', dur: '16s', delay: '4s' },
  { size: 5, left: '85%', top: '70%', anim: 'auth-particle-1', dur: '20s', delay: '1s' },
  { size: 3, left: '55%', top: '40%', anim: 'auth-particle-2', dur: '15s', delay: '3s' },
  { size: 2, left: '20%', top: '80%', anim: 'auth-particle-3', dur: '22s', delay: '5s' },
  { size: 4, left: '65%', top: '10%', anim: 'auth-particle-1', dur: '17s', delay: '6s' },
  { size: 3, left: '40%', top: '90%', anim: 'auth-particle-2', dur: '19s', delay: '2.5s' },
  { size: 2, left: '90%', top: '50%', anim: 'auth-particle-3', dur: '13s', delay: '4.5s' },
  { size: 5, left: '8%', top: '45%', anim: 'auth-particle-1', dur: '21s', delay: '1.5s' },
];

/**
 * Columna izquierda de branding: puramente decorativa, sin estado. Extraída
 * de AuthPanel.tsx (FE-ALTO-03) — antes 660 líneas mezclando esto con el
 * formulario y su validación.
 */
export function AuthBrandingPanel(): JSX.Element {
  return (
    <div className="relative hidden lg:flex lg:w-[48%] flex-col justify-between overflow-hidden bg-slate-950 p-16 text-white select-none">
      {/* Orbe de gradiente animado (fondo) */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full gradient-orb pointer-events-none" />

      {/* Luces de fondo (Glow effects) */}
      <div className="absolute -top-20 -left-20 w-[500px] h-[500px] rounded-full glow-overlay-1 pointer-events-none" />
      <div className="absolute -bottom-20 -right-20 w-[500px] h-[500px] rounded-full glow-overlay-2 pointer-events-none" />

      {/* Patrón de cuadrícula de fondo */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />

      {/* Partículas flotantes */}
      {PARTICLES.map((p, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-white/30 pointer-events-none"
          style={{
            width: p.size,
            height: p.size,
            left: p.left,
            top: p.top,
            animation: `${p.anim} ${p.dur} ease-in-out ${p.delay} infinite`,
          }}
        />
      ))}

      {/* Cabecera — staggered animation */}
      <div className="relative z-10 flex items-center space-x-4 auth-slide-right" style={{ animationDelay: '0.1s' }}>
        <img
          src="/logos/Logo01.png"
          alt="EduCode AI"
          className="h-12 w-12 rounded-full shadow-lg shadow-black/20"
        />
        <span className="text-2xl font-bold tracking-wider text-white">EduCode AI</span>
      </div>

      {/* Tarjeta Visual Destacada (Glassmorphism) — staggered */}
      <div className="relative z-10 my-auto max-w-lg auth-slide-right" style={{ animationDelay: '0.3s' }}>
        <div className="animate-float rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl">
          <div className="mb-6">
            <span className="text-xs font-semibold uppercase tracking-wider text-primary-400 bg-primary-500/10 px-3 py-1 rounded-full border border-primary-500/20">
              Consola Académica
            </span>
            <h3 className="mt-3 text-2xl font-bold text-white">
              Despliegues y Runtime Bajo Control
            </h3>
            <p className="mt-2 text-sm text-slate-300 leading-relaxed">
              Una plataforma unificada para administrar tus entregas de programación, entornos y ejecución de contenedores.
            </p>
          </div>

          <div className="space-y-5 border-t border-white/10 pt-6">
            <div
              className="flex items-start space-x-3.5 auth-slide-right"
              style={{ animationDelay: '0.5s' }}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-500/15 text-primary-300 border border-primary-500/20">
                <RiCommandLine className="text-lg" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white">Runtime Integrado</h4>
                <p className="text-xs text-slate-400 mt-0.5">Ejecuta comandos, levanta contenedores y depura fallas directamente.</p>
              </div>
            </div>

            <div
              className="flex items-start space-x-3.5 auth-slide-right"
              style={{ animationDelay: '0.65s' }}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-danger-500/15 text-danger-300 border border-danger-500/20">
                <RiUploadCloud2Line className="text-lg" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white">Gestión de Entregas</h4>
                <p className="text-xs text-slate-400 mt-0.5">Envía tus prácticas y obtén evaluación automática y retroalimentación inmediata.</p>
              </div>
            </div>

            <div
              className="flex items-start space-x-3.5 auth-slide-right"
              style={{ animationDelay: '0.8s' }}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-success-500/15 text-success-300 border border-success-500/20">
                <RiDashboardLine className="text-lg" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white">Workspace Dinámico</h4>
                <p className="text-xs text-slate-400 mt-0.5">Toda la información académica de tu curso, laboratorios y grupos al alcance.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Terminal mock — muestra el flujo real de la plataforma */}
        <div
          className="mt-6 rounded-2xl border border-white/10 bg-slate-900/80 backdrop-blur-md overflow-hidden shadow-xl auth-slide-right"
          style={{ animationDelay: '0.95s' }}
          aria-hidden="true"
        >
          <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-white/10">
            <span className="h-2.5 w-2.5 rounded-full bg-danger-400/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-warning-400/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-success-400/80" />
            <span className="ml-2 text-[10px] font-mono text-slate-500">runtime · educode</span>
          </div>
          <div className="px-4 py-3.5 font-mono text-[11px] leading-relaxed">
            <p>
              <span className="text-primary-400">$</span>{' '}
              <span className="text-slate-200">educode deploy practica-3</span>
            </p>
            <p className="text-slate-500">→ Construyendo imagen… listo en 1.2s</p>
            <p className="text-slate-500">→ Levantando contenedor aislado…</p>
            <p className="text-success-400">✓ Tests superados: 24/24 · entrega evaluada</p>
            <p>
              <span className="text-primary-400">$</span>{' '}
              <span className="inline-block w-2 h-3.5 align-middle bg-slate-300 auth-cursor" />
            </p>
          </div>
        </div>
      </div>

      {/* Pie de página Izquierdo — staggered */}
      <div className="relative z-10 flex justify-between text-[11px] text-slate-500 auth-slide-right" style={{ animationDelay: '1.1s' }}>
        <span>© 2026 Universidad de Sevilla · Departamento de Telemática</span>
        <span>v1.0.0</span>
      </div>
    </div>
  );
}
