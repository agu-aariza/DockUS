import { useEffect, useRef, useState } from "react";
import { apiBaseUrl } from "../../shared/api/http";
import { builderApi } from "../../shared/api/services";
import type { BuildRunEvent } from "../../features/builder/types";
import type { SessionRecord } from "../../features/auth/types";
import { getErrorMessage } from "../../shared/utils/errors";
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

  useEffect(() => {
    setEvents([]);
    setStreamError(null);
    setStreamState(runId && session ? "connecting" : "idle");
    streamStateRef.current = runId && session ? "connecting" : "idle";
    latestSequenceRef.current = 0;
  }, [runId, session?.accessToken]);

  useEffect(() => {
    if (!runId || !session) {
      return;
    }

    let disposed = false;
    const abortController = new AbortController();
    let reconnectTimer: number | null = null;

    const updateStreamState = (next: StreamState) => {
      streamStateRef.current = next;
      setStreamState(next);
    };

    const fetchBacklog = async () => {
      const page = await builderApi.listEvents({
        buildRunId: runId,
        afterSequence: latestSequenceRef.current,
        limit: 200,
      });
      if (disposed || page.events.length === 0) {
        latestSequenceRef.current = Math.max(
          latestSequenceRef.current,
          page.latestSequence,
        );
        return;
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
        setEvents((current) => mergeEvents(current, [parsed]));
      } catch {
        // Ignore malformed event frames.
      }
    };

    const connect = async () => {
      try {
        setStreamError(null);
        await fetchBacklog();
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
        const reader = response.body.getReader();
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

        if (!disposed) {
          updateStreamState("polling");
          reconnectTimer = window.setTimeout(() => {
            if (!disposed) {
              void connect();
            }
          }, 2000);
        }
      } catch (error) {
        if (disposed || abortController.signal.aborted) {
          return;
        }
        setStreamError(getErrorMessage(error));
        updateStreamState("polling");
        reconnectTimer = window.setTimeout(() => {
          if (!disposed) {
            void connect();
          }
        }, 2500);
      }
    };

    void connect();

    return () => {
      disposed = true;
      abortController.abort();
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
