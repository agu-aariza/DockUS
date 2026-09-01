import { describe, expect, it } from "vitest";
import { parseSseFrame } from "@/builder/stream/sseFrameParser";

describe("parseSseFrame", () => {
  it("combina líneas data y conserva el tipo de evento", () => {
    expect(parseSseFrame("event: run-event\r\ndata: {\"a\":\ndata: 1}"))
      .toEqual({ eventName: "run-event", data: '{"a":1}' });
  });

  it("ignora frames vacíos o sin datos", () => {
    expect(parseSseFrame("\r\n"))
      .toBeNull();
    expect(parseSseFrame("event: keep-alive"))
      .toBeNull();
  });
});
