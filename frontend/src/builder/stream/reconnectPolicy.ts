import { computeBackoffDelay } from "../../shared/utils/backoff";

export function getReconnectDelay(
  attempt: number,
  random?: () => number,
): number {
  return computeBackoffDelay(Math.max(0, attempt), { random });
}

export function nextReconnectAttempt(attempt: number): number {
  return Math.max(0, attempt) + 1;
}
