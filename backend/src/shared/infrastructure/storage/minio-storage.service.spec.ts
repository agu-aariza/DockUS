import { MinioStorageService } from './minio-storage.service';

/**
 * ESC-ALTO-09. La regla de caducidad la fija `mc ilm` como paso de despliegue
 * (la versión desplegada de MinIO rechaza la escritura desde el SDK); lo que el
 * backend aporta es la **comprobación** de que existe.
 *
 * Merece prueba porque el fallo que estas comprobaciones evitan ya ocurrió: la
 * versión anterior registraba «política aplicada» mientras filtraba por un
 * prefijo inexistente, de modo que no habría caducado nada.
 */
describe('MinioStorageService — verificación de la política de retención', () => {
  function build(options: { retentionDays?: number; send?: jest.Mock } = {}) {
    const configService = {
      get: jest.fn((key: string, fallback?: unknown) => {
        if (key === 'STORAGE_EVIDENCE_RETENTION_DAYS') {
          return options.retentionDays ?? 90;
        }
        if (key === 'MINIO_BUCKET_NAME') return 'dockus-storage';
        if (key === 'NODE_ENV') return 'development';
        return fallback;
      }),
    };

    const service = new MinioStorageService(configService as never);
    const send = options.send ?? jest.fn();
    (service as unknown as { s3Client: { send: jest.Mock } }).s3Client = {
      send,
    };

    const logger = {
      warn: jest.fn(),
      log: jest.fn(),
      error: jest.fn(),
    };
    (service as unknown as { logger: typeof logger }).logger = logger;

    const verify = (
      service as unknown as {
        verifyRetentionPolicy: (bucket: string) => Promise<void>;
      }
    ).verifyRetentionPolicy.bind(service);

    return { verify, logger, send };
  }

  const enabledRule = (prefix: string) => ({
    Status: 'Enabled',
    Expiration: { Days: 90 },
    Filter: { Prefix: prefix },
  });

  it('acepta una regla activa que cubre el prefijo de evidencia', async () => {
    const { verify, logger } = build({
      send: jest.fn().mockResolvedValue({ Rules: [enabledRule('runs/')] }),
    });

    await verify('dockus-storage');

    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('runs/'));
  });

  /** El fallo real que se coló durante una fase entera. */
  it('avisa si la regla apunta a un prefijo que no es el de la evidencia', async () => {
    const { verify, logger } = build({
      send: jest.fn().mockResolvedValue({ Rules: [enabledRule('evidence/')] }),
    });

    await verify('dockus-storage');

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('storage_retention_policy_missing'),
    );
  });

  it('avisa si la regla existe pero está deshabilitada', async () => {
    const { verify, logger } = build({
      send: jest.fn().mockResolvedValue({
        Rules: [{ ...enabledRule('runs/'), Status: 'Disabled' }],
      }),
    });

    await verify('dockus-storage');

    expect(logger.warn).toHaveBeenCalled();
  });

  it('avisa, con el comando a ejecutar, si el bucket no tiene ninguna regla', async () => {
    const { verify, logger } = build({
      send: jest
        .fn()
        .mockRejectedValue(new Error('NoSuchLifecycleConfiguration')),
    });

    await verify('dockus-storage');

    // Se parsea en vez de buscar sobre la cadena: el aviso es JSON y las
    // comillas del comando van escapadas dentro de él.
    const aviso = JSON.parse(logger.warn.mock.calls[0][0] as string) as {
      accion: string;
      prefix: string;
    };

    // Sin el comando, el aviso obliga a ir a buscar la documentación.
    expect(aviso.accion).toContain('mc ilm rule add');
    expect(aviso.accion).toContain('--prefix "runs/"');
    expect(aviso.accion).toContain('--expire-days 90');
    expect(aviso.prefix).toBe('runs/');
  });

  it('no rompe el arranque si la consulta falla por otra causa', async () => {
    const { verify, logger } = build({
      send: jest.fn().mockRejectedValue(new Error('connection refused')),
    });

    await expect(verify('dockus-storage')).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalled();
  });

  it('con retención desactivada no consulta nada', async () => {
    const { verify, logger, send } = build({ retentionDays: 0 });

    await verify('dockus-storage');

    expect(send).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
