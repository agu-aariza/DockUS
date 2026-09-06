/**
 * @fileoverview Controlador compatible del stream SSE de ejecuciones Builder.
 *
 * @module useBuilderRunStream
 */

import { useEffect, useReducer, useRef } from "react";
import { apiBaseUrl } from "../../shared/api/http";
import { builderApi } from "../api/builderApi";
import type { BuildRunEvent } from "../../features/builder/types";
import type { SessionRecord } from "../../shared/session/session.types";
import { getErrorMessage } from "../../shared/utils/errors";
import {
  builderRunStreamReducer,
  initialBuilderRunStreamState,
  type BuilderRunStreamAction,
  type BuilderRunStreamState,
  type StreamState,
} from "../stream/builderRunStream.reducer";
import { parseSseFrame } from "../stream/sseFrameParser";
import { getReconnectDelay, nextReconnectAttempt } from "../stream/reconnectPolicy";

export type { StreamState } from "../stream/builderRunStream.reducer";

interface ReconnectWait {
  timer: number | null;
  resolve: (() => void) | null;
}

function waitForReconnect(
  delay: number,
  signal: AbortSignal,
  wait: ReconnectWait,
): Promise<void> {
  return new Promise((resolve) => {
    wait.resolve = resolve;
    wait.timer = window.setTimeout(() => {
      wait.timer = null;
      wait.resolve = null;
      resolve();
    }, delay);

    if (signal.aborted) {
      window.clearTimeout(wait.timer);
      wait.timer = null;
      wait.resolve = null;
      resolve();
      return;
    }

    if (typeof signal.addEventListener !== "function") return;

    signal.addEventListener(
      "abort",
      () => {
        if (wait.timer !== null) {
          window.clearTimeout(wait.timer);
          wait.timer = null;
        }
        wait.resolve = null;
        resolve();
      },
      { once: true },
    );
  });
}

function isBuildRunEvent(value: unknown): value is BuildRunEvent {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as BuildRunEvent).id === "string" &&
      typeof (value as BuildRunEvent).sequence === "number" &&
      typeof (value as BuildRunEvent).eventType === "string",
  );
}

function isTerminalStatusCode(status: number): boolean {
  return status === 401 || status === 403 || status === 404;
}

function getErrorStatusCode(error: unknown): number | null {
  if (typeof error === "object" && error !== null) {
    if ("statusCode" in error && typeof (error as { statusCode?: unknown }).statusCode === "number") {
      return (error as { statusCode: number }).statusCode;
    }
    if ("status" in error && typeof (error as { status?: unknown }).status === "number") {
      return (error as { status: number }).status;
    }
    if ("response" in error && typeof (error as { response?: unknown }).response === "object" && (error as { response: unknown }).response !== null) {
      const res = (error as { response: { status?: unknown } }).response;
      if (typeof res.status === "number") {
        return res.status;
      }
    }
  }
  return null;
}

export function useBuilderRunStream(
  runId: string,
  session: SessionRecord | null,
): {
  events: BuildRunEvent[];
  streamState: StreamState;
  streamError: string | null;
  latestSequence: number;
} {
  const [state, dispatch] = useReducer(
    builderRunStreamReducer,
    initialBuilderRunStreamState,
  );
  const stateRef = useRef<BuilderRunStreamState>(initialBuilderRunStreamState);

  const dispatchStream = (action: BuilderRunStreamAction) => {
    stateRef.current = builderRunStreamReducer(stateRef.current, action);
    dispatch(action);
  };

  useEffect(() => {
    dispatchStream({
      type: "reset",
      streamState: runId && session ? "connecting" : "idle",
    });
  }, [runId, session?.accessToken]);

  useEffect(() => {
    if (!runId || !session) return;

    let disposed = false;
    const abortController = new AbortController();
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    let reconnectAttempt = 0;
    const reconnectWait: ReconnectWait = { timer: null, resolve: null };

    const fetchBacklog = async () => {
      const page = await builderApi.listEvents({
        buildRunId: runId,
        afterSequence: stateRef.current.latestSequence,
        limit: 200,
        signal: abortController.signal,
      });
      if (disposed) return;
      dispatchStream({
        type: "backlog",
        events: page.events,
        latestSequence: page.latestSequence,
      });
    };

    const consumeFrame = (frame: string) => {
      const parsedFrame = parseSseFrame(frame);
      if (!parsedFrame) return;

      if (parsedFrame.eventName === "ready") {
        try {
          const ready = JSON.parse(parsedFrame.data) as { latestSequence?: number };
          dispatchStream({
            type: "ready",
            latestSequence: ready.latestSequence ?? 0,
          });
        } catch {
          // Ignore malformed ready frames.
        }
        return;
      }

      if (parsedFrame.eventName !== "run-event") return;

      try {
        const event: unknown = JSON.parse(parsedFrame.data);
        if (isBuildRunEvent(event)) {
          dispatchStream({ type: "event", event });
        }
      } catch {
        // Ignore malformed event frames.
      }
    };

    const consumeStream = async (response: Response) => {
      if (!response.body) {
        throw new Error(`Stream no disponible (${response.status}).`);
      }

      reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (!disposed) {
        const chunk = await reader.read();
        if (chunk.done) break;
        buffer += decoder.decode(chunk.value, { stream: true });

        let boundaryIndex = buffer.indexOf("\n\n");
        while (boundaryIndex >= 0) {
          const frame = buffer.slice(0, boundaryIndex);
          buffer = buffer.slice(boundaryIndex + 2);
          consumeFrame(frame);
          boundaryIndex = buffer.indexOf("\n\n");
        }
      }
    };

    const runStream = async () => {
      while (!disposed && !stateRef.current.terminal) {
        let isTerminalFailure = false;
        try {
          dispatchStream({ type: "loading-backlog" });
          await fetchBacklog();
          if (disposed || stateRef.current.terminal) break;

          dispatchStream({ type: "connecting" });
          const response = await fetch(
            `${apiBaseUrl}/builder/runs/${runId}/stream?afterSequence=${stateRef.current.latestSequence}`,
            {
              headers: {
                Accept: "text/event-stream",
                Authorization: `Bearer ${session.accessToken}`,
              },
              signal: abortController.signal,
            },
          );

          if (!response.ok || !response.body) {
            if (isTerminalStatusCode(response.status)) {
              isTerminalFailure = true;
            }
            throw new Error(`Stream no disponible (${response.status}).`);
          }

          dispatchStream({ type: "streaming" });
          reconnectAttempt = 0;
          await consumeStream(response);
        } catch (error) {
          if (disposed || abortController.signal.aborted) return;
          const status = getErrorStatusCode(error);
          if (status && isTerminalStatusCode(status)) {
            isTerminalFailure = true;
          }
          dispatchStream({ type: "error", message: getErrorMessage(error) });
        }

        if (disposed || stateRef.current.terminal) break;

        if (isTerminalFailure) {
          dispatchStream({ type: "terminal" });
          break;
        }

        dispatchStream({ type: "polling" });
        const delay = getReconnectDelay(reconnectAttempt);
        reconnectAttempt = nextReconnectAttempt(reconnectAttempt);
        await waitForReconnect(delay, abortController.signal, reconnectWait);
      }

      if (!disposed && stateRef.current.terminal) {
        dispatchStream({ type: "terminal" });
      }
    };

    void runStream();

    return () => {
      disposed = true;
      abortController.abort();
      if (reconnectWait.timer !== null) {
        window.clearTimeout(reconnectWait.timer);
        reconnectWait.timer = null;
      }
      reconnectWait.resolve?.();
      reconnectWait.resolve = null;
      if (reader) {
        void reader.cancel().catch(() => undefined);
        reader.releaseLock();
        reader = undefined;
      }
      dispatchStream({ type: "disposed" });
    };
  }, [runId, session]);

  return {
    events: state.events,
    streamState: state.streamState,
    streamError: state.streamError,
    latestSequence: state.latestSequence,
  };
}
