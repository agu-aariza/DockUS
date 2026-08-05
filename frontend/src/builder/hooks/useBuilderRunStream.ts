/**
 * @fileoverview Vista y componentes del motor Builder de evaluación (useBuilderRunStream).
 *
 * @module useBuilderRunStream
 */

import { useEffect, useRef, useState } from "react";
import { apiBaseUrl } from "../../shared/api/http";
import { builderApi } from "../../shared/api/services";
import type { BuildRunEvent } from "../../features/builder/types";
import type { SessionRecord } from "../../features/auth/types";
import { getErrorMessage } from "../../shared/utils/errors";
import { computeBackoffDelay } from "../../shared/utils/backoff";
import { mergeEvents } from "../utils";

export type StreamState = "idle" | "connecting" | "streaming" | "polling";

export function useBuilderRunStream(
  runId: string,
  session: SessionRecord | null,
): {
  events: BuildRunEvent[];
  streamState: StreamState;
  streamError: string | null;
  latestSequence: number;
} {
  const [events, setEvents] = useState<BuildRunEvent[]>([]);
  const [streamState, setStreamState] = useState<StreamState>("idle");
  const [streamError, setStreamError] = useState<string | null>(null);
  const latestSequenceRef = useRef(0);
  const streamStateRef = useRef<StreamState>("idle");

  const isTerminalRef = useRef(false);

  useEffect(() => {
    setEvents([]);
    setStreamError(null);
    setStreamState(runId && session ? "connecting" : "idle");
    streamStateRef.current = runId && session ? "connecting" : "idle";
    latestSequenceRef.current = 0;
    isTerminalRef.current = false;
  }, [runId, session?.accessToken]);

  useEffect(() => {
    if (!runId || !session) {
      return;
    }

    let disposed = false;
    const abortController = new AbortController();
    let reconnectTimer: number | null = null;
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined = undefined;
    // Intentos consecutivos fallidos. Se reinicia en cuanto el stream vuelve a
    // entregar datos, de modo que una desconexión aislada no penaliza a la
    // siguiente.
    let reconnectAttempt = 0;

    const updateStreamState = (next: StreamState) => {
      streamStateRef.current = next;
      setStreamState(next);
    };

    /**
     * Reconexión con retroceso exponencial y dispersión. Antes era un retardo
     * fijo de 2.000/2.500 ms: ante un corte que afecte a todos los clientes a
     * la vez, todos volvían en el mismo instante y el pico se repetía idéntico
     * en cada intento, porque nada rompía la alineación.
     */
    const scheduleReconnect = () => {
      const delay = computeBackoffDelay(reconnectAttempt);
      reconnectAttempt += 1;
      reconnectTimer = window.setTimeout(() => {
        if (!disposed) {
          void connect();
        }
      }, delay);
    };

    const fetchBacklog = async () => {
      const page = await builderApi.listEvents({
        buildRunId: runId,
        afterSequence: latestSequenceRef.current,
        limit: 200,
        // Sin la señal, un cambio de runId deja viva la petición anterior: al
        // resolver, escribe estado del run que ya no se observa.
        signal: abortController.signal,
      });
      if (disposed || page.events.length === 0) {
        latestSequenceRef.current = Math.max(
          latestSequenceRef.current,
          page.latestSequence,
        );
        return;
      }

      const containsTerminal = page.events.some((e) =>
        e.eventType === "RUN_COMPLETED" ||
        e.eventType === "RUN_FAILED" ||
        e.eventType === "RUN_CANCELLED"
      );
      if (containsTerminal) {
        isTerminalRef.current = true;
      }

      latestSequenceRef.current = Math.max(
        latestSequenceRef.current,
        page.latestSequence,
      );
      setEvents((current) => mergeEvents(current, page.events));
    };

    const consumeFrame = (frame: string) => {
      if (!frame.trim()) {
        return;
      }

      let eventName = "message";
      let data = "";
      frame.split(/\r?\n/).forEach((line) => {
        if (line.startsWith("event:")) {
          eventName = line.slice("event:".length).trim();
        }
        if (line.startsWith("data:")) {
          data += line.slice("data:".length).trim();
        }
      });

      if (!data) {
        return;
      }

      if (eventName === "ready") {
        try {
          const parsed = JSON.parse(data) as { latestSequence?: number };
          latestSequenceRef.current = Math.max(
            latestSequenceRef.current,
            parsed.latestSequence ?? 0,
          );
        } catch {
          // Ignore malformed ready frames.
        }
        return;
      }

      if (eventName !== "run-event") {
        return;
      }

      try {
        const parsed = JSON.parse(data) as BuildRunEvent;
        latestSequenceRef.current = Math.max(
          latestSequenceRef.current,
          parsed.sequence,
        );
        if (
          parsed.eventType === "RUN_COMPLETED" ||
          parsed.eventType === "RUN_FAILED" ||
          parsed.eventType === "RUN_CANCELLED"
        ) {
          isTerminalRef.current = true;
        }
        setEvents((current) => mergeEvents(current, [parsed]));
      } catch {
        // Ignore malformed event frames.
      }
    };

    const connect = async () => {
      try {
        setStreamError(null);
        await fetchBacklog();
        if (disposed) {
          return;
        }
        updateStreamState("connecting");

        const response = await fetch(
          `${apiBaseUrl}/builder/runs/${runId}/stream?afterSequence=${latestSequenceRef.current}`,
          {
            headers: {
              Accept: "text/event-stream",
              Authorization: `Bearer ${session.accessToken}`,
            },
            signal: abortController.signal,
          },
        );

        if (!response.ok || !response.body) {
          throw new Error(`Stream no disponible (${response.status}).`);
        }

        updateStreamState("streaming");
        // Conexión establecida: la racha de fallos queda saldada.
        reconnectAttempt = 0;
        reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (!disposed) {
          const chunk = await reader.read();
          if (chunk.done) {
            break;
          }
          buffer += decoder.decode(chunk.value, { stream: true });

          let boundaryIndex = buffer.indexOf("\n\n");
          while (boundaryIndex >= 0) {
            const frame = buffer.slice(0, boundaryIndex);
            buffer = buffer.slice(boundaryIndex + 2);
            consumeFrame(frame);
            boundaryIndex = buffer.indexOf("\n\n");
          }
        }

        if (!disposed && !isTerminalRef.current) {
          updateStreamState("polling");
          scheduleReconnect();
        } else if (!disposed) {
          updateStreamState("idle");
        }
      } catch (error) {
        if (disposed || abortController.signal.aborted) {
          return;
        }
        setStreamError(getErrorMessage(error));
        if (!isTerminalRef.current) {
          updateStreamState("polling");
          scheduleReconnect();
        } else {
          updateStreamState("idle");
        }
      }
    };

    void connect();

    return () => {
      disposed = true;
      abortController.abort();
      if (reader) {
        void reader.cancel().catch(() => undefined);
        reader.releaseLock();
        reader = undefined;
      }
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
      }
    };
  }, [runId, session]);

  return {
    events,
    streamState,
    streamError,
    latestSequence: latestSequenceRef.current,
  };
}
