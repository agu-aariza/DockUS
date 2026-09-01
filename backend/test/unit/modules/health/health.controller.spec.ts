import { HttpException, HttpStatus } from '@nestjs/common';
import { HealthController } from '@app/modules/health/health.controller';
import { HealthService } from '@app/modules/health/health.service';

describe('HealthController', () => {
  it('throws 503 when readiness reports a degraded dependency', async () => {
    const readiness = {
      status: 'error' as const,
      timestamp: '2026-05-08T10:00:00.000Z',
      checks: {
        database: { status: 'up' as const, latencyMs: 3 },
        redis: { status: 'up' as const, latencyMs: 2 },
        docker: { status: 'up' as const, latencyMs: 5 },
        bedrock: {
          status: 'down' as const,
          latencyMs: 7,
          info: 'UnrecognizedClientException: credentials not configured.',
        },
      },
    };
    const controller = new HealthController({
      getReadiness: jest.fn().mockResolvedValue(readiness),
    } as unknown as HealthService);

    await expect(controller.getReadiness()).rejects.toBeInstanceOf(
      HttpException,
    );
    await expect(controller.getReadiness()).rejects.toMatchObject({
      response: readiness,
      status: HttpStatus.SERVICE_UNAVAILABLE,
    });
  });
});
/**
 * Pruebas del endpoint de salud y de su respuesta estable para clientes y sondas de infraestructura.
 */
