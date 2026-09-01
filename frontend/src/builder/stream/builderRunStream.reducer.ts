import type { BuildRunEvent } from "../../features/builder/types";
import { mergeEvents } from "../utils";

export type StreamState =
  | "idle"
  | "loading-backlog"
  | "connecting"
  | "streaming"
  | "polling"
  | "terminal"
  | "disposed";

export interface BuilderRunStreamState {
  events: BuildRunEvent[];
  streamState: StreamState;
  streamError: string | null;
  latestSequence: number;
  terminal: boolean;
}

export const initialBuilderRunStreamState: BuilderRunStreamState = {
  events: [],
  streamState: "idle",
  streamError: null,
  latestSequence: 0,
  terminal: false,
};

const terminalEventTypes = new Set([
  "RUN_COMPLETED",
  "RUN_FAILED",
  "RUN_CANCELLED",
]);

function isTerminalEvent(event: BuildRunEvent): boolean {
  return terminalEventTypes.has(event.eventType);
}

export type BuilderRunStreamAction =
  | { type: "reset"; streamState: StreamState }
  | { type: "loading-backlog" }
  | { type: "connecting" }
  | { type: "streaming" }
  | { type: "polling" }
  | { type: "clear-error" }
  | { type: "error"; message: string }
  | { type: "ready"; latestSequence: number }
  | { type: "backlog"; events: BuildRunEvent[]; latestSequence: number }
  | { type: "event"; event: BuildRunEvent }
  | { type: "terminal" }
  | { type: "disposed" };

export function builderRunStreamReducer(
  state: BuilderRunStreamState,
  action: BuilderRunStreamAction,
): BuilderRunStreamState {
  switch (action.type) {
    case "reset":
      return {
        ...initialBuilderRunStreamState,
        streamState: action.streamState,
      };
    case "loading-backlog":
      return { ...state, streamState: "loading-backlog", streamError: null };
    case "connecting":
      return { ...state, streamState: "connecting" };
    case "streaming":
      return { ...state, streamState: "streaming", streamError: null };
    case "polling":
      return { ...state, streamState: "polling" };
    case "clear-error":
      return { ...state, streamError: null };
    case "error":
      return { ...state, streamError: action.message };
    case "ready":
      return {
        ...state,
        latestSequence: Math.max(state.latestSequence, action.latestSequence),
      };
    case "backlog": {
      const terminal = action.events.some(isTerminalEvent);
      return {
        ...state,
        events: mergeEvents(state.events, action.events),
        latestSequence: Math.max(state.latestSequence, action.latestSequence),
        terminal: state.terminal || terminal,
        streamState: terminal ? "terminal" : state.streamState,
      };
    }
    case "event": {
      const terminal = isTerminalEvent(action.event);
      return {
        ...state,
        events: mergeEvents(state.events, [action.event]),
        latestSequence: Math.max(state.latestSequence, action.event.sequence),
        terminal: state.terminal || terminal,
        streamState: terminal ? "terminal" : state.streamState,
      };
    }
    case "terminal":
      return { ...state, streamState: "terminal", terminal: true };
    case "disposed":
      return { ...state, streamState: "disposed" };
  }
}
