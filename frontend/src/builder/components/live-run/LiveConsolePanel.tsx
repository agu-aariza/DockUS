import { RiLoader4Line } from "react-icons/ri";
import type { StreamState } from "../../hooks/useBuilderRunStream";

interface LiveConsolePanelProps {
  consoleOutput: string;
  streamState: StreamState;
}

/**
 * Terminal real: el fondo oscuro no es decoración, es el medio en el que se leen los logs
 * del contenedor. Por eso aquí no hay degradados ni glow por encima del texto.
 */
export function LiveConsolePanel({
  consoleOutput,
  streamState,
}: LiveConsolePanelProps): JSX.Element {
  const streaming = streamState === "streaming";

  return (
    <section className="min-w-0 overflow-hidden rounded-lg border border-app-border bg-slate-950">
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">Consola en vivo</h3>
          <p className="mt-0.5 font-mono text-xs text-slate-500">
            stdout · stderr del contenedor
          </p>
        </div>
        {streaming && (
          <span className="flex items-center gap-2 rounded-full border border-success/20 bg-success/10 px-2.5 py-1">
            <span
              className="status-pulse status-pulse-success h-1.5 w-1.5 rounded-full bg-success"
              aria-hidden="true"
            />
            <span className="font-mono text-xs font-medium text-success">en directo</span>
          </span>
        )}
      </header>

      {consoleOutput ? (
        <pre className="custom-scrollbar max-h-[460px] max-w-full overflow-y-auto whitespace-pre-wrap break-all p-4 font-mono text-xs leading-6 text-success-300/90 selection:bg-success-500/30">
          {consoleOutput}
        </pre>
      ) : (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-500">
          <RiLoader4Line className="animate-spin text-xl" aria-hidden="true" />
          <span className="font-mono text-xs">esperando logs del orquestador…</span>
        </div>
      )}
    </section>
  );
}
