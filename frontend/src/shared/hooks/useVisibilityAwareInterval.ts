/**
 * Intervalo que se suspende mientras la pestaña está oculta.
 *
 * Motivo (ESC-ALTO-10): los sondeos de fondo no distinguían una pestaña en uso
 * de una olvidada en segundo plano. Las notificaciones de evaluación disparan
 * dos peticiones cada 15 s por alumno conectado, de modo que 10.000 sesiones
 * *sin actividad alguna* sostenían del orden de 1,3k peticiones/s contra la API
 * y, a través de ella, contra Postgres. En un aula real la mayoría de esas
 * pestañas están detrás de otra ventana.
 *
 * Al volver a mostrarse la pestaña se ejecuta una pasada inmediata: quien
 * regresa espera ver el estado actual, no esperar un ciclo entero. Esa pasada
 * es también la razón de dispersarla —véase `computeBackoffDelay`—: sin
 * dispersión, un patrón común (cambiar de aplicación y volver al terminar una
 * clase) alinearía a muchos clientes en el mismo instante.
 */

import { useEffect, useRef } from "react";

import { computeBackoffDelay } from "../utils/backoff";

/** Dispersión corta al recuperar visibilidad: suficiente para desalinear. */
const RESUME_JITTER_MS = 750;

export function useVisibilityAwareInterval(
  callback: () => void,
  intervalMs: number,
  enabled = true,
): void {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!enabled || intervalMs <= 0) {
      return;
    }

    let interval: number | null = null;
    let resumeTimer: number | null = null;

    const isHidden = () =>
      typeof document !== "undefined" && document.visibilityState === "hidden";

    const stop = () => {
      if (interval !== null) {
        window.clearInterval(interval);
        interval = null;
      }
    };

    const start = () => {
      if (interval !== null) {
        return;
      }
      interval = window.setInterval(() => {
        if (!isHidden()) {
          callbackRef.current();
        }
      }, intervalMs);
    };

    const handleVisibilityChange = () => {
      if (isHidden()) {
        stop();
        if (resumeTimer !== null) {
          window.clearTimeout(resumeTimer);
          resumeTimer = null;
        }
        return;
      }

      resumeTimer = window.setTimeout(() => {
        callbackRef.current();
        start();
      }, computeBackoffDelay(0, { baseDelayMs: 0, maxDelayMs: RESUME_JITTER_MS }));
    };

    if (!isHidden()) {
      start();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      stop();
      if (resumeTimer !== null) {
        window.clearTimeout(resumeTimer);
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [intervalMs, enabled]);
}
