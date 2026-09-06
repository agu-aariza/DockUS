/**
 * @fileoverview Hook de lógica de negocio para el espacio del estudiante (useBuildRunStream).
 *
 * @module useBuildRunStream
 */

import { useMemo } from "react";

import { useBuilderRunStream } from "../../builder/hooks/useBuilderRunStream";
import type { BuildRunEntity } from "../../features/builder/types";
import type { SessionRecord } from "../../shared/session/session.types";
import {
  deriveStudentRunProgress,
  type StudentRunProgressSnapshot,
} from "../studentBuildRunStages";

export function useBuildRunStream(
  run: BuildRunEntity | null | undefined,
  session: SessionRecord | null,
): {
  progress: StudentRunProgressSnapshot;
  events: ReturnType<typeof useBuilderRunStream>["events"];
  streamState: ReturnType<typeof useBuilderRunStream>["streamState"];
  streamError: string | null;
  latestSequence: number;
  elapsedMs: number;
  isActive: boolean;
} {
  const stream = useBuilderRunStream(run?.id ?? "", session);

  const progress = useMemo(
    () => deriveStudentRunProgress(stream.events, run),
    [run, stream.events],
  );

  const elapsedMs = useMemo(() => {
    if (!run?.startedAt) {
      return 0;
    }

    const started = new Date(run.startedAt).getTime();
    const finished = run.finishedAt ? new Date(run.finishedAt).getTime() : Date.now();
    return Math.max(0, finished - started);
  }, [run?.finishedAt, run?.startedAt, stream.latestSequence]);

  const isTerminalStream =
    stream.streamState === "terminal" ||
    stream.events.some(
      (e) =>
        e.eventType === "BUILD_COMPLETED" ||
        e.eventType === "BUILD_FAILED" ||
        e.eventType === "RUN_CANCELLED",
    );

  const isActive = Boolean(run && !run.isTerminal && !isTerminalStream);

  return {
    progress,
    events: stream.events,
    streamState: stream.streamState,
    streamError: stream.streamError,
    latestSequence: stream.latestSequence,
    elapsedMs,
    isActive,
  };
}
