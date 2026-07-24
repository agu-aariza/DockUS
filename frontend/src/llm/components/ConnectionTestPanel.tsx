import { RiTimeLine } from "react-icons/ri";
import { Card } from "../../shared/components/ui/Layout";
import type { ConnectionEvent } from "../llmConfigConstants";

interface ConnectionTestPanelProps {
  testStatus: "idle" | "testing" | "success" | "error";
  testLogs: string;
  testEvents: ConnectionEvent[];
}

export function ConnectionTestPanel({
  testStatus,
  testLogs,
  testEvents,
}: ConnectionTestPanelProps): JSX.Element {
  return (
    <Card title="Prueba de Conexión en Directo">
      {testStatus === "idle" ? (
        <div className="rounded-md border border-dashed border-app-border bg-app-bg px-4 py-20 text-center text-sm text-app-text-muted">
          Guarda la configuración y pulsa «Probar Conexión»: el backend enviará un prompt real
          al proveedor con las credenciales almacenadas y verás aquí su latencia y sus tokens.
        </div>
      ) : (
        <div className="space-y-6">
          <div className="min-w-0 overflow-hidden rounded-lg border border-app-border bg-slate-950">
            <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-100">Consola de pruebas</h3>
                <p className="mt-0.5 font-mono text-xs text-slate-500">
                  respuesta del proveedor
                </p>
              </div>
              {testStatus === "testing" && (
                <span className="flex items-center gap-2 rounded-full border border-success/20 bg-success/10 px-2.5 py-1">
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-success animate-pulse"
                    aria-hidden="true"
                  />
                  <span className="font-mono text-xs font-medium text-success">
                    conectando
                  </span>
                </span>
              )}
            </header>

            <pre className="custom-scrollbar max-h-[160px] min-h-[120px] max-w-full overflow-y-auto whitespace-pre-wrap break-all p-4 font-mono text-xs leading-6 text-success-400 bg-slate-950">
              {testLogs || "Esperando respuesta..."}
            </pre>
          </div>

          <div className="rounded-lg border border-app-border bg-app-bg-subtle/50 p-4">
            <header className="border-b border-app-border pb-3 mb-4">
              <h4 className="text-xs font-semibold text-app-text-secondary uppercase tracking-wider flex items-center gap-1.5">
                <RiTimeLine className="text-base text-app-text-muted" />
                Traza de la Conexión
              </h4>
            </header>

            <ol className="relative border-l border-app-border ml-2 pl-4 space-y-4">
              {testEvents.map((event) => {
                const isSuccess = event.type === "SUCCESS";
                const isError = event.type === "ERROR";

                return (
                  <li key={event.id} className="relative">
                    <span
                      className={`absolute -left-[21px] mt-1 h-2.5 w-2.5 rounded-full ring-4 ring-app-surface ${
                        isSuccess ? "bg-success" : isError ? "bg-danger" : "bg-primary"
                      }`}
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <span
                          className={`font-mono text-[10px] font-bold uppercase tracking-wide ${
                            isSuccess
                              ? "text-success"
                              : isError
                                ? "text-danger"
                                : "text-app-text-muted"
                          }`}
                        >
                          {event.type}
                        </span>
                        <time className="text-[10px] font-mono text-app-text-muted">
                          {event.time.slice(11, 19)}
                        </time>
                      </div>

                      <p
                        className={`mt-0.5 text-xs ${
                          isError ? "text-danger font-semibold" : "text-app-text-secondary"
                        }`}
                      >
                        {event.message}
                      </p>

                      {event.payload && (
                        <pre className="mt-2 max-w-full overflow-x-auto rounded-md bg-slate-900 p-2 font-mono text-[10px] leading-relaxed text-slate-300 border border-white/5">
                          {JSON.stringify(event.payload, null, 2)}
                        </pre>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      )}
    </Card>
  );
}
