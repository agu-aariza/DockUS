import { describe, expect, it } from "vitest";
import { getReconnectDelay, nextReconnectAttempt } from "@/builder/stream/reconnectPolicy";

describe("reconnectPolicy", () => {
  it("calcula backoff creciente con jitter controlable", () => {
    expect(getReconnectDelay(0, () => 0)).toBe(2000);
    expect(getReconnectDelay(1, () => 1)).toBe(4000);
    expect(getReconnectDelay(10, () => 1)).toBe(30000);
  });

  it("avanza solo el contador de intentos del controlador", () => {
    expect(nextReconnectAttempt(0)).toBe(1);
    expect(nextReconnectAttempt(3)).toBe(4);
  });
});
