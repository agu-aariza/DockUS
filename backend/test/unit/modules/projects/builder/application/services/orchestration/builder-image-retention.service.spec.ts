import { BuilderImageRetentionService } from '@app/modules/projects/builder/application/services/orchestration/builder-image-retention.service';
import { ProcessRole } from '@app/process-role.module';

describe('BuilderImageRetentionService — poda de imágenes de entorno', () => {
  function buildService(
    config: { cleanupImages?: boolean; imageTtlMs?: number } = {},
    pruneImpl?: jest.Mock,
    processRole: ProcessRole = 'worker',
  ) {
    const dockerImageService = {
      pruneEnvironmentImages: pruneImpl ?? jest.fn(() => Promise.resolve(3)),
    };
    const service = new BuilderImageRetentionService(
      dockerImageService as never,
      {
        cleanupImages: config.cleanupImages ?? true,
        imageTtlMs: config.imageTtlMs ?? 1_800_000,
      } as never,
      processRole,
    );
    return { service, dockerImageService };
  }

  it('no poda desde el proceso de la API', async () => {
    // La API puede apuntar a otro demonio: podaría un inventario ajeno.
    const { service, dockerImageService } = buildService({}, undefined, 'api');

    await service.pruneStaleEnvironmentImages();

    expect(dockerImageService.pruneEnvironmentImages).not.toHaveBeenCalled();
  });

  it('poda desde el worker, convirtiendo el TTL a horas', async () => {
    const { service, dockerImageService } = buildService({
      imageTtlMs: 7_200_000,
    });

    await service.pruneStaleEnvironmentImages();

    expect(dockerImageService.pruneEnvironmentImages).toHaveBeenCalledWith(
      expect.objectContaining({ olderThanHours: 2 }),
    );
  });

  it('respeta la desactivación por configuración', async () => {
    const { service, dockerImageService } = buildService({
      cleanupImages: false,
    });

    await service.pruneStaleEnvironmentImages();

    expect(dockerImageService.pruneEnvironmentImages).not.toHaveBeenCalled();
  });

  it('un fallo de poda no tumba el worker', async () => {
    const { service } = buildService(
      {},
      jest.fn(() => Promise.reject(new Error('daemon caido'))),
    );

    // Degrada al estado previo —el disco sigue creciendo— pero deja registro.
    await expect(
      service.pruneStaleEnvironmentImages(),
    ).resolves.toBeUndefined();
  });
});
