import { beforeEach, describe, expect, it } from "vitest";
import { readSessions, writeSessions } from "./sessionStore";
import type { SessionRecord } from "../../features/auth/types";

function makeSession(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    id: "session-1",
    label: "alumno@dockus.local (STUDENT)",
    userId: "user-1",
    email: "alumno@dockus.local",
    role: "STUDENT",
    accessToken: "live-access-token",
    refreshToken: "live-refresh-token",
    createdAt: "2026-07-23T00:00:00.000Z",
    ...overrides,
  };
}

describe("sessionStore (FE-MED-04)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("never writes accessToken to localStorage", () => {
    writeSessions([makeSession()]);

    const raw = localStorage.getItem("dockus_console_sessions");
    expect(raw).not.toContain("live-access-token");
  });

  it("still persists refreshToken, needed to rehydrate without a fresh login", () => {
    writeSessions([makeSession()]);

    const [stored] = readSessions();
    expect(stored.refreshToken).toBe("live-refresh-token");
    expect(stored.accessToken).toBe("");
  });

  it("sanitizes every saved session, not just the active one", () => {
    writeSessions([
      makeSession({ id: "a", accessToken: "token-a" }),
      makeSession({ id: "b", accessToken: "token-b" }),
    ]);

    const stored = readSessions();
    expect(stored.every((session) => session.accessToken === "")).toBe(true);
  });
});
