import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import {
  RiCheckLine,
  RiCloseLine,
  RiErrorWarningLine,
  RiInformationLine,
} from "react-icons/ri";

export type ToastTone = "success" | "info" | "warning" | "error";

interface ToastInput {
  title?: string;
  description: string;
  tone?: ToastTone;
  durationMs?: number;
}

interface ToastRecord extends ToastInput {
  id: string;
  tone: ToastTone;
}

interface ToastContextValue {
  pushToast: (input: ToastInput) => string;
  dismissToast: (id: string) => void;
}

const TOAST_CONFIG: Record<
  ToastTone,
  {
    panel: string;
    iconWrap: string;
    icon: typeof RiCheckLine;
    fallbackTitle: string;
  }
> = {
  success: {
    panel: "border-emerald-200 bg-emerald-50/95 text-emerald-950",
    iconWrap: "bg-emerald-100 text-emerald-700",
    icon: RiCheckLine,
    fallbackTitle: "Operación completada",
  },
  info: {
    panel: "border-sky-200 bg-sky-50/95 text-sky-950",
    iconWrap: "bg-sky-100 text-sky-700",
    icon: RiInformationLine,
    fallbackTitle: "Información",
  },
  warning: {
    panel: "border-amber-200 bg-amber-50/95 text-amber-950",
    iconWrap: "bg-amber-100 text-amber-700",
    icon: RiErrorWarningLine,
    fallbackTitle: "Revisa esto",
  },
  error: {
    panel: "border-rose-200 bg-rose-50/95 text-rose-950",
    iconWrap: "bg-rose-100 text-rose-700",
    icon: RiErrorWarningLine,
    fallbackTitle: "Ha ocurrido un error",
  },
};

const ToastContext = createContext<ToastContextValue | null>(null);

function createFingerprint(input: ToastInput): string {
  return `${input.tone ?? "info"}::${input.title ?? ""}::${input.description}`;
}

export function ToastProvider({ children }: PropsWithChildren): JSX.Element {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const fingerprintToIdRef = useRef(new Map<string, string>());

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    fingerprintToIdRef.current.forEach((value, key) => {
      if (value === id) {
        fingerprintToIdRef.current.delete(key);
      }
    });
  }, []);

  const pushToast = useCallback(
    (input: ToastInput): string => {
      const fingerprint = createFingerprint(input);
      const existingId = fingerprintToIdRef.current.get(fingerprint);
      if (existingId) {
        return existingId;
      }

      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const tone = input.tone ?? "info";
      const nextToast: ToastRecord = {
        id,
        tone,
        title: input.title,
        description: input.description,
        durationMs: input.durationMs,
      };

      fingerprintToIdRef.current.set(fingerprint, id);
      setToasts((current) => [...current.slice(-4), nextToast]);

      const durationMs = input.durationMs ?? 5200;
      window.setTimeout(() => {
        dismissToast(id);
      }, durationMs);

      return id;
    },
    [dismissToast],
  );

  const value = useMemo(
    () => ({
      pushToast,
      dismissToast,
    }),
    [dismissToast, pushToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed right-4 top-4 z-[140] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3"
        aria-live="assertive"
        aria-relevant="additions text"
      >
        {toasts.map((toast) => {
          const config = TOAST_CONFIG[toast.tone];
          const Icon = config.icon;

          return (
            <section
              key={toast.id}
              role={toast.tone === "error" ? "alert" : "status"}
              className={`pointer-events-auto overflow-hidden rounded-2xl border shadow-xl shadow-slate-900/10 backdrop-blur animate-in fade-in slide-in-from-top-2 duration-200 ${config.panel}`}
            >
              <div className="flex items-start gap-3 px-4 py-4">
                <div
                  className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${config.iconWrap}`}
                >
                  <Icon className="text-lg" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-semibold tracking-tight">
                    {toast.title ?? config.fallbackTitle}
                  </h4>
                  <p className="mt-1 text-sm leading-5 text-current/80">
                    {toast.description}
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-full p-1 text-current/50 transition hover:bg-white/60 hover:text-current"
                  onClick={() => dismissToast(toast.id)}
                  aria-label="Cerrar aviso"
                >
                  <RiCloseLine className="text-lg" />
                </button>
              </div>
            </section>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast debe usarse dentro de ToastProvider.");
  }

  return context;
}
