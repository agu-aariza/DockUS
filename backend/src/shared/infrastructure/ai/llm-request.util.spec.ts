import { mapHttpStatusToLlmError, postJson } from './llm-request.util';

describe('postJson', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    global.fetch = originalFetch;
  });

  function jsonResponse(status: number, body: unknown): Response {
    return {
      ok: status >= 200 && status < 300,
      status,
      text: () => Promise.resolve(JSON.stringify(body)),
      json: () => Promise.resolve(body),
    } as unknown as Response;
  }

  it('HIGH-03: reintenta con backoff ante un 429 transitorio y devuelve el resultado del segundo intento', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(429, { error: 'rate limited' }))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    global.fetch = fetchMock;

    const resultPromise = postJson(
      'test-provider',
      'https://example.test/api',
      {},
      {},
      5000,
    );
    await jest.advanceTimersByTimeAsync(2000);

    await expect(resultPromise).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('HIGH-03: reintenta ante un 503 y agota los intentos si el fallo persiste', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(jsonResponse(503, { error: 'unavailable' }));
    global.fetch = fetchMock;

    const resultPromise = postJson(
      'test-provider',
      'https://example.test/api',
      {},
      {},
      5000,
      3,
    );
    resultPromise.catch(() => undefined);
    await jest.advanceTimersByTimeAsync(10000);

    await expect(resultPromise).rejects.toMatchObject({
      code: 'http_error',
      httpStatus: 503,
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('HIGH-03: no reintenta ante un 401 (credenciales invalidas): falla en el primer intento', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(jsonResponse(401, { error: 'unauthorized' }));
    global.fetch = fetchMock;

    const resultPromise = postJson(
      'test-provider',
      'https://example.test/api',
      {},
      {},
      5000,
    );
    resultPromise.catch(() => undefined);
    await jest.advanceTimersByTimeAsync(10000);

    await expect(resultPromise).rejects.toMatchObject({
      code: 'http_error',
      httpStatus: 401,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('mapHttpStatusToLlmError', () => {
  it('clasifica 429 como throttling (reintentable)', () => {
    const error = mapHttpStatusToLlmError('provider', 429, 'rate limited');
    expect(error.code).toBe('throttling');
  });

  it('clasifica 401 como http_error no reintentable a nivel de codigo', () => {
    const error = mapHttpStatusToLlmError('provider', 401, 'unauthorized');
    expect(error.code).toBe('http_error');
    expect(error.httpStatus).toBe(401);
  });
});
