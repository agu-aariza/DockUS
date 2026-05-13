import { useMemo } from "react";

import { useBuilderRunStream } from "../../builder/hooks/useBuilderRunStream";
import type { BuildRunEntity, SessionRecord } from "../../shared/types";
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

  const isActive = Boolean(run && !run.isTerminal);

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
