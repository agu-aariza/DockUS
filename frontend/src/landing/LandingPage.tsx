/**
 * @fileoverview Módulo de la interfaz de usuario (LandingPage).
 *
 * @module LandingPage
 */

import { Link } from "react-router";
import { LLM_PROVIDER_IDS } from "../features/llm/types";
import { PROVIDER_METADATA } from "../llm/llmConfigConstants";
import { StatusBadge } from "../shared/components/ui/StatusBadge";
import { LogoPlate } from "../shared/components/ui/LogoPlate";
import { PipelineStageList } from "./components/PipelineStageList";
import { UniversityCrest } from "./components/UniversityCrest";

/**
 * Lenguajes que el pipeline sabe construir y ejecutar. Solo C y Python están
 * en producción; el resto se anuncia como en desarrollo a propósito, para no
 * prometer lo que todavía no evalúa.
 */
const LANGUAGES_AVAILABLE = [
  { id: "c", name: "C", logo: "/logos/logo_c.webp" },
  { id: "python", name: "Python", logo: "/logos/logo_py.webp" },
] as const;

const LANGUAGES_IN_PROGRESS = [
  { id: "cpp", name: "C++", logo: "/logos/logo_cpp.webp" },
  { id: "java", name: "Java", logo: "/logos/logo_java.png" },
  { id: "javascript", name: "JavaScript", logo: "/logos/logo_js.png" },
  { id: "bash", name: "Bash", logo: "/logos/logo_bash.webp" },
] as const;

/**
 * Ficha de lenguaje. Los que están en desarrollo van atenuados: el estado se
 * dice con la insignia y además se ve, sin depender solo del color.
 */
function LanguageCard({
  name,
  logo,
  muted = false,
}: {
  name: string;
  logo: string;
  muted?: boolean;
}): JSX.Element {
  return (
    <li
      className={`flex items-center gap-3 rounded-lg border border-app-border bg-app-surface p-3.5 ${
        muted ? "opacity-60" : ""
      }`}
    >
      <LogoPlate src={logo} className="h-10 w-10" />
      <span className="truncate text-sm font-semibold">{name}</span>
    </li>
  );
}

/** Cada afirmación se corresponde con algo que la plataforma hace de verdad. */
const VALUE_PROPS = [
  {
    title: "Retroalimentación mientras la práctica sigue fresca",
    body:
      "El informe llega al terminar la ejecución, no semanas más tarde. El estudiante corrige cuando todavía recuerda las decisiones que tomó.",
  },
  {
    title: "El mismo criterio para todas las entregas",
    body:
      "El profesorado define la rúbrica y las guías de evaluación. La plataforma las aplica igual sobre cada entrega, sin depender de quién corrige ni de cuándo.",
  },
  {
    title: "Resultados reproducibles",
    body:
      "Cada entrega se ejecuta aislada, con el mismo entorno y los mismos límites de tiempo y memoria. El resultado no depende de la máquina donde se corrige.",
  },
  {
    title: "La última palabra sigue siendo del docente",
    body:
      "La evaluación asistida se entrega como una propuesta razonada, con la traza de ejecución y los hallazgos que la respaldan. El profesorado revisa y ajusta.",
  },
] as const;

/**
 * Landing pública. No llama a ninguna API ni lee sesión: es la primera
 * superficie que ve alguien que aún no ha entrado.
 */
export function LandingPage(): JSX.Element {
  return (
    <div className="flex min-h-screen flex-col bg-app-bg text-app-text">
      <header className="border-b border-app-border">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-5 lg:px-10">
          <div className="flex items-center gap-3">
            <img src="/logos/Logo01.png" alt="" className="h-9 w-9 shrink-0 rounded-full" />
            <div className="leading-tight">
              <div className="text-sm font-semibold tracking-wide">EduCode AI</div>
              <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-app-text-muted">
                Containerizing Academic Excellence
              </div>
            </div>
          </div>
          {/* El departamento, no otro "Entrar": el acceso ya lo cubren los dos
              botones del héroe y los del cierre. */}
          <LogoPlate
            src="/logos/logo_dit.png"
            alt="Departamento de Ingeniería Telemática"
            className="h-11 w-11"
          />
        </div>
      </header>

      <main className="flex-1">
        {/* ── Tesis ─────────────────────────────────────────── */}
        <section className="mx-auto w-full max-w-7xl px-6 py-14 lg:px-10 lg:py-20">
          <p className="institutional-line text-accent">
            Universidad de Sevilla · Departamento de Telemática
          </p>
          <div className="accent-rule mt-4" />

          {/* A ancho completo del contenedor, no dentro de la columna: cada
              mitad cabe así en una sola línea. Las dos nombran a los dos
              públicos de la plataforma y van con el mismo peso y el mismo
              tono — atenuar una jerarquizaba lo que no tiene jerarquía. */}
          <h1 className="mt-6 font-display text-[2rem] leading-[1.16] text-balance sm:text-4xl lg:text-5xl xl:text-[3.5rem]">
            <span className="block">Informe inmediato para el alumno.</span>
            <span className="mt-1 block">Corrección más eficiente para el docente.</span>
          </h1>

          <div className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:gap-16">
            <div>
              <p className="max-w-xl text-base leading-relaxed text-app-text-secondary">
                Plataforma de evaluación automatizada de prácticas de programación:
                cada entrega se ejecuta aislada en un contenedor y se evalúa con
                apoyo de modelos de lenguaje.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/acceso" className="cta-primary">
                  Entrar
                </Link>
                <Link to="/acceso?modo=crear" className="cta-secondary">
                  Crear cuenta
                </Link>
              </div>
            </div>

            <div>
              <h2 className="institutional-line text-app-text-muted">El recorrido de una entrega</h2>
              <PipelineStageList className="mt-5" />
            </div>
          </div>
        </section>

        {/* ── Por qué ───────────────────────────────────────── */}
        <section className="border-t border-app-border bg-app-surface">
          <div className="mx-auto w-full max-w-7xl px-6 py-16 lg:px-10 lg:py-20">
            <p className="institutional-line text-accent">El futuro de la evaluación de prácticas</p>
            <div className="accent-rule mt-4" />
            <h2 className="mt-6 max-w-3xl font-display text-3xl leading-[1.15] sm:text-4xl">
              Corregir a tiempo es lo que convierte una entrega en aprendizaje.
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-app-text-secondary">
              Una práctica corregida semanas después llega cuando el estudiante
              ya ha pasado a otra cosa. La plataforma acorta esa distancia sin
              renunciar al criterio del docente.
            </p>

            <div className="mt-12 grid gap-x-10 gap-y-10 sm:grid-cols-2">
              {VALUE_PROPS.map((prop, index) => (
                <div key={prop.title} className="border-t border-app-border pt-5">
                  <span className="font-mono text-xs tabular-nums text-accent">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-3 text-lg font-semibold leading-snug">{prop.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-app-text-secondary">{prop.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Lenguajes ─────────────────────────────────────── */}
        <section className="border-t border-app-border">
          <div className="mx-auto w-full max-w-7xl px-6 py-16 lg:px-10 lg:py-20">
            <p className="institutional-line text-accent">Lenguajes</p>
            <div className="accent-rule mt-4" />
            <h2 className="mt-6 max-w-3xl font-display text-3xl leading-[1.15] sm:text-4xl">
              C y Python, en pleno funcionamiento.
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-app-text-secondary">
              Las prácticas en C y Python se compilan, se ejecutan y se evalúan
              de principio a fin. El resto de lenguajes está en desarrollo: se
              irán incorporando al pipeline conforme se validen.
            </p>

            <div className="mt-12 grid gap-x-10 gap-y-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
              <div>
                <StatusBadge tone="success">En funcionamiento</StatusBadge>
                <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                  {LANGUAGES_AVAILABLE.map((lang) => (
                    <LanguageCard key={lang.id} name={lang.name} logo={lang.logo} />
                  ))}
                </ul>
              </div>

              <div>
                <StatusBadge tone="pending">En desarrollo</StatusBadge>
                <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {LANGUAGES_IN_PROGRESS.map((lang) => (
                    <LanguageCard key={lang.id} name={lang.name} logo={lang.logo} muted />
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ── Modelos compatibles ───────────────────────────── */}
        <section className="border-t border-app-border">
          <div className="mx-auto w-full max-w-7xl px-6 py-16 lg:px-10 lg:py-20">
            <p className="institutional-line text-accent">Modelos compatibles</p>
            <div className="accent-rule mt-4" />
            <h2 className="mt-6 max-w-3xl font-display text-3xl leading-[1.15] sm:text-4xl">
              Conecta el proveedor que ya utilice tu institución.
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-app-text-secondary">
              La evaluación no depende de un único proveedor. Cada función del
              pipeline —planificación, evaluación, auditoría de calidad y
              tutoría— puede asignarse a un modelo distinto, incluido uno que se
              ejecute en la propia infraestructura del centro.
            </p>

            <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {LLM_PROVIDER_IDS.map((id) => {
                const meta = PROVIDER_METADATA[id];
                return (
                  <li
                    key={id}
                    className="flex items-center gap-4 rounded-lg border border-app-border bg-app-surface p-4"
                  >
                    <LogoPlate src={meta.logoUrl} className="h-11 w-11" />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{meta.name}</div>
                      <div className="mt-0.5 truncate text-xs text-app-text-secondary">
                        {meta.subtitle}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* Mismas etiquetas y misma forma que el par del héroe: una acción
                conserva su nombre y su aspecto en toda la página. */}
            <div className="mt-12 flex flex-wrap gap-3 border-t border-app-border pt-8">
              <Link to="/acceso" className="cta-primary">
                Entrar
              </Link>
              <Link to="/acceso?modo=crear" className="cta-secondary">
                Crear cuenta
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-app-border">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-3 px-6 py-5 lg:px-10">
          <div className="flex items-center gap-3">
            <UniversityCrest className="h-12 w-12" />
            <span className="font-mono text-[11px] leading-tight text-app-text-muted">
              © 2026 Universidad de Sevilla
              <br />
              Departamento de Telemática
            </span>
          </div>
          <span className="data-meta">v1.0.0</span>
        </div>
      </footer>
    </div>
  );
}
