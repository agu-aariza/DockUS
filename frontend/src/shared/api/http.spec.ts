import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const requestUse = vi.fn();
const responseUse = vi.fn();

const httpInstanceMock: any = vi.fn((config: unknown) =>
  Promise.resolve({ config }),
);
httpInstanceMock.interceptors = {
  request: { use: requestUse },
  response: { use: responseUse },
};

const postMock = vi.fn();

vi.mock("axios", () => {
  const axiosMock = {
    create: vi.fn(() => httpInstanceMock),
    post: (...args: unknown[]) => postMock(...args),
    isAxiosError: (error: unknown): boolean =>
      typeof error === "object" && error !== null && "isAxiosError" in error,
  };
  return { default: axiosMock, ...axiosMock };
});

function buildAuthError(url: string) {
  return {
    isAxiosError: true,
    config: { url, headers: {} as Record<string, string> },
    response: { status: 401, data: {} },
    message: "Request failed with status code 401",
  };
}

describe("http refresh-token interceptor", () => {
  let setAccessToken: (typeof import("./http"))["setAccessToken"];
  let setRefreshToken: (typeof import("./http"))["setRefreshToken"];
  let errorHandler: (error: unknown) => Promise<unknown>;

  beforeEach(async () => {
    vi.resetModules();
    requestUse.mockClear();
    responseUse.mockClear();
    postMock.mockReset();
    httpInstanceMock.mockClear();

    const httpModule = await import("./http");
    setAccessToken = httpModule.setAccessToken;
    setRefreshToken = httpModule.setRefreshToken;
    setRefreshToken("valid-refresh-token");
    setAccessToken("stale-access-token");

    errorHandler = responseUse.mock.calls[0][1];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects (does not hang) requests queued behind a refresh that ends up failing", async () => {
    postMock.mockRejectedValue(new Error("refresh token expired"));

    // Ambas peticiones fallan con 401 mientras un unico refresh esta en
    // vuelo: la primera dispara el refresh, la segunda debe encolarse.
    const firstRequestFailure = errorHandler(buildAuthError("/projects"));
    const secondRequestFailure = errorHandler(buildAuthError("/deliveries"));

    // Antes de la correccion, `secondRequestFailure` nunca se resolvia ni
    // rechazaba: quedaba colgada para siempre. Si el fix no esta aplicado,
    // esta asercion agota el timeout de vitest y el test falla.
    await expect(firstRequestFailure).rejects.toBeDefined();
    await expect(secondRequestFailure).rejects.toBeDefined();
  });

  it("resolves queued requests with the new token when refresh succeeds", async () => {
    postMock.mockResolvedValue({
      data: { accessToken: "fresh-access-token", refreshToken: "fresh-refresh-token" },
    });

    const firstRequestRetry = errorHandler(buildAuthError("/projects"));
    const secondRequestRetry = errorHandler(buildAuthError("/deliveries"));

    await expect(firstRequestRetry).resolves.toBeDefined();
    await expect(secondRequestRetry).resolves.toBeDefined();

    const secondCallConfig = httpInstanceMock.mock.calls.at(-1)?.[0];
    expect(secondCallConfig.headers.Authorization).toBe(
      "Bearer fresh-access-token",
    );
  });

  it("calls the refresh endpoint with an explicit timeout", async () => {
    postMock.mockResolvedValue({
      data: { accessToken: "a", refreshToken: "b" },
    });

    await errorHandler(buildAuthError("/projects"));

    expect(postMock).toHaveBeenCalledWith(
      expect.stringContaining("/auth/refresh"),
      expect.objectContaining({ refreshToken: "valid-refresh-token" }),
      expect.objectContaining({ timeout: expect.any(Number) }),
    );
  });

  it("recovers on its own from a rehydrated session with no accessToken (sessionStore no longer persists it)", async () => {
    // Simula un reload: el accessToken se rehidrata vacío (sessionStore.ts ya
    // no lo persiste), pero el refreshToken sí sobrevivió. La primera
    // petición autenticada llega sin token, el backend responde 401, y este
    // mismo interceptor debe refrescar y reintentar sin ruta especial.
    setAccessToken("");
    postMock.mockResolvedValue({
      data: { accessToken: "fresh-access-token", refreshToken: "fresh-refresh-token" },
    });

    await expect(errorHandler(buildAuthError("/projects"))).resolves.toBeDefined();
    expect(postMock).toHaveBeenCalledWith(
      expect.stringContaining("/auth/refresh"),
      expect.objectContaining({ refreshToken: "valid-refresh-token" }),
      expect.anything(),
    );
  });
});
