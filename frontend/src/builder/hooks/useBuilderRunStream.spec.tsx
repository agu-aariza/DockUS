import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { useBuilderRunStream } from "./useBuilderRunStream";
import { builderApi } from "../api/builderApi";
import type { SessionRecord } from "../../features/auth/types";

const session: SessionRecord = {
  id: "session-1",
  label: "Test",
  userId: "user-1",
  email: "test@example.com",
  role: "TEACHER",
  accessToken: "token-123",
  refreshToken: "refresh-123",
  createdAt: new Date().toISOString(),
};

function TestComponent({
  runId,
  session,
}: {
  runId: string;
  session: SessionRecord | null;
}) {
  const result = useBuilderRunStream(runId, session);
  return (
    <div>
      <span data-testid="stream-state">{result.streamState}</span>
      <span data-testid="events-count">{result.events.length}</span>
    </div>
  );
}

describe("useBuilderRunStream", () => {
  const originalFetch = global.fetch;
  const originalAbortController = global.AbortController;

  beforeEach(() => {
    vi.spyOn(builderApi, "listEvents").mockResolvedValue({
      events: [],
      latestSequence: 0,
      hasMore: false,
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    global.AbortController = originalAbortController;
    vi.restoreAllMocks();
  });

  it("libera el reader y cancela el stream al desmontar", async () => {
    const mockReader = {
      read: vi.fn().mockResolvedValue({ done: true }),
      cancel: vi.fn().mockResolvedValue(undefined),
      releaseLock: vi.fn(),
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      body: {
        getReader: vi.fn().mockReturnValue(mockReader),
      },
    });
    global.fetch = mockFetch;

    const { unmount } = render(
      <TestComponent runId="run-1" session={session} />,
    );

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

    unmount();

    expect(mockReader.cancel).toHaveBeenCalled();
    expect(mockReader.releaseLock).toHaveBeenCalled();
  });

  it("aborta el controlador y limpia el timeout de reconexion al desmontar", async () => {
    const mockReader = {
      read: vi.fn().mockImplementation(
        () =>
          new Promise(() => {
            // Nunca resuelve; simula stream activo.
          }),
      ),
      cancel: vi.fn().mockResolvedValue(undefined),
      releaseLock: vi.fn(),
    };

    const abortSpy = vi.fn();
    class MockAbortController {
      signal = { aborted: false };
      abort = abortSpy;
    }

    vi.stubGlobal(
      "AbortController",
      MockAbortController as unknown as typeof AbortController,
    );

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      body: {
        getReader: vi.fn().mockReturnValue(mockReader),
      },
    });
    global.fetch = mockFetch;

    const { unmount } = render(
      <TestComponent runId="run-1" session={session} />,
    );

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

    unmount();

    expect(abortSpy).toHaveBeenCalled();
    expect(mockReader.cancel).toHaveBeenCalled();
    expect(mockReader.releaseLock).toHaveBeenCalled();
  });

  it("no inicia conexion cuando falta runId o sesion", () => {
    const mockFetch = vi.fn();
    global.fetch = mockFetch;

    const { rerender } = render(
      <TestComponent runId="" session={session} />,
    );
    expect(mockFetch).not.toHaveBeenCalled();

    rerender(<TestComponent runId="run-1" session={null} />);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("propaga el AbortSignal del efecto a la recuperacion del historico", async () => {
    const listEventsSpy = vi.spyOn(builderApi, "listEvents");
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: {
        getReader: () => ({
          read: vi.fn().mockResolvedValue({ done: true }),
          cancel: vi.fn().mockResolvedValue(undefined),
          releaseLock: vi.fn(),
        }),
      },
    });

    render(<TestComponent runId="run-1" session={session} />);

    await waitFor(() => expect(listEventsSpy).toHaveBeenCalled());

    const signal = listEventsSpy.mock.calls[0][0].signal;
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(signal?.aborted).toBe(false);
  });

  it("no emite estado del run anterior si el historico resuelve tras desmontar", async () => {
    // El closure obsoleto: listEvents queda pendiente, el efecto se limpia y la
    // promesa resuelve despues. Sin la comprobacion de `disposed`, escribia
    // "connecting" del run que ya no se observa.
    let resolveBacklog: (value: unknown) => void = () => undefined;
    vi.spyOn(builderApi, "listEvents").mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveBacklog = resolve;
        }) as never,
    );

    const mockFetch = vi.fn();
    global.fetch = mockFetch;

    const { unmount, getByTestId } = render(
      <TestComponent runId="run-1" session={session} />,
    );

    unmount();
    resolveBacklog({ events: [], latestSequence: 0, hasMore: false });
    await Promise.resolve();

    // La peticion de stream nunca llega a lanzarse tras el desmontaje.
    expect(mockFetch).not.toHaveBeenCalled();
    expect(() => getByTestId("stream-state")).toThrow();
  });
});
