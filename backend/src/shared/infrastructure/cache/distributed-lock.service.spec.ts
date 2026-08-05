import { DistributedLockService } from './distributed-lock.service';

describe('DistributedLockService — exclusión mutua de construcción', () => {
  function buildService(
    overrides: {
      setIfAbsent?: jest.Mock;
      releaseIfMatches?: jest.Mock;
    } = {},
  ) {
    const redis = {
      setIfAbsent: overrides.setIfAbsent ?? jest.fn().mockResolvedValue(true),
      releaseIfMatches:
        overrides.releaseIfMatches ?? jest.fn().mockResolvedValue(true),
    };
    return {
      service: new DistributedLockService(redis as never),
      redis,
    };
  }

  it('ejecuta la sección crítica y libera el cerrojo al terminar', async () => {
    const { service, redis } = buildService();
    const critical = jest.fn().mockResolvedValue('hecho');

    const outcome = await service.withLock(
      'img:abc',
      { ttlMs: 1000 },
      critical,
    );

    expect(outcome).toEqual({ result: 'hecho', acquired: true });
    expect(critical).toHaveBeenCalledTimes(1);
    expect(redis.releaseIfMatches).toHaveBeenCalledTimes(1);
  });

  it('espacia la clave para no colisionar con otras claves de Redis', async () => {
    const { service, redis } = buildService();

    await service.withLock('img:abc', { ttlMs: 1000 }, () =>
      Promise.resolve(null),
    );

    expect(redis.setIfAbsent).toHaveBeenCalledWith(
      'lock:img:abc',
      expect.any(String),
      1000,
    );
  });

  it('libera con un testigo propio y distinto en cada adquisición', async () => {
    const { service, redis } = buildService();

    await service.withLock('k', { ttlMs: 1000 }, () => Promise.resolve(null));
    await service.withLock('k', { ttlMs: 1000 }, () => Promise.resolve(null));

    const primerTestigo = redis.setIfAbsent.mock.calls[0][1] as string;
    const segundoTestigo = redis.setIfAbsent.mock.calls[1][1] as string;

    // Testigos iguales permitirían que un titular liberase el cerrojo de otro.
    expect(primerTestigo).not.toBe(segundoTestigo);
    expect(redis.releaseIfMatches.mock.calls[0][1]).toBe(primerTestigo);
  });

  it('libera el cerrojo aunque la sección crítica falle', async () => {
    const { service, redis } = buildService();

    await expect(
      service.withLock('k', { ttlMs: 1000 }, () =>
        Promise.reject(new Error('build fallido')),
      ),
    ).rejects.toThrow('build fallido');

    // Sin esto, un build fallido bloquearía el tag durante todo el TTL.
    expect(redis.releaseIfMatches).toHaveBeenCalledTimes(1);
  });

  /**
   * El cerrojo optimiza; no es una dependencia de corrección. Bloquear todas
   * las evaluaciones porque Redis no responde sería peor que el problema.
   */
  it('con Redis caído ejecuta igualmente, señalando que no hubo exclusión', async () => {
    const { service, redis } = buildService({
      setIfAbsent: jest.fn().mockRejectedValue(new Error('redis caido')),
    });
    const critical = jest.fn().mockResolvedValue('hecho');

    const outcome = await service.withLock('k', { ttlMs: 1000 }, critical);

    expect(outcome).toEqual({ result: 'hecho', acquired: false });
    expect(critical).toHaveBeenCalledTimes(1);
    // Nunca se tuvo el cerrojo: liberarlo borraría el del titular legítimo.
    expect(redis.releaseIfMatches).not.toHaveBeenCalled();
  });

  it('agotada la espera ejecuta sin cerrojo en vez de fallar', async () => {
    const { service, redis } = buildService({
      setIfAbsent: jest.fn().mockResolvedValue(false),
    });
    const critical = jest.fn().mockResolvedValue('hecho');

    const outcome = await service.withLock(
      'k',
      { ttlMs: 1000, waitTimeoutMs: 30, retryIntervalMs: 10 },
      critical,
    );

    expect(outcome.acquired).toBe(false);
    expect(critical).toHaveBeenCalledTimes(1);
    expect(redis.releaseIfMatches).not.toHaveBeenCalled();
  });

  it('reintenta durante la espera y entra en cuanto el titular libera', async () => {
    const setIfAbsent = jest
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValue(true);
    const { service } = buildService({ setIfAbsent });

    const outcome = await service.withLock(
      'k',
      { ttlMs: 1000, waitTimeoutMs: 500, retryIntervalMs: 5 },
      () => Promise.resolve('hecho'),
    );

    expect(outcome.acquired).toBe(true);
    expect(setIfAbsent.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('un fallo al liberar no oculta el resultado de la sección crítica', async () => {
    const { service } = buildService({
      releaseIfMatches: jest.fn().mockRejectedValue(new Error('redis caido')),
    });

    // El cerrojo acabará venciendo por TTL; lo que no puede es perderse el
    // trabajo ya realizado.
    await expect(
      service.withLock('k', { ttlMs: 1000 }, () => Promise.resolve('hecho')),
    ).resolves.toEqual({ result: 'hecho', acquired: true });
  });
});
