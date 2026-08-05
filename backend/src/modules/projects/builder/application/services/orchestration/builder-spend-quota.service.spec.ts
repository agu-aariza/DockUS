import { ForbiddenException } from '@nestjs/common';
import { BuilderSpendQuotaService } from './builder-spend-quota.service';

describe('BuilderSpendQuotaService — cuota de gasto', () => {
  function build(quotaUsd: number, spentUsd = 0) {
    const buildRunsRepository = {
      sumExecutionCostUsdByProject: jest.fn().mockResolvedValue(spentUsd),
    };
    const configService = {
      get: jest.fn(() => quotaUsd),
    };

    return {
      service: new BuilderSpendQuotaService(
        buildRunsRepository as never,
        configService as never,
      ),
      buildRunsRepository,
    };
  }

  it('con cuota 0 no consulta siquiera el gasto', async () => {
    const { service, buildRunsRepository } = build(0);

    await expect(
      service.assertProjectWithinQuota('proyecto'),
    ).resolves.toBeUndefined();
    // Desactivada debe salir sin coste: es el comportamiento histórico.
    expect(
      buildRunsRepository.sumExecutionCostUsdByProject,
    ).not.toHaveBeenCalled();
  });

  it('deja pasar mientras quede margen', async () => {
    const { service } = build(10, 4.5);

    await expect(
      service.assertProjectWithinQuota('proyecto'),
    ).resolves.toBeUndefined();
  });

  it('rechaza al alcanzar el tope, no solo al superarlo', async () => {
    const { service } = build(10, 10);

    await expect(service.assertProjectWithinQuota('proyecto')).rejects.toThrow(
      ForbiddenException,
    );
  });

  /**
   * Un rechazo que no diga cuánto se lleva gastado es indistinguible de una
   * avería y manda al docente a abrir una incidencia en vez de a revisar su
   * configuración.
   */
  it('nombra el gasto y el tope en el mensaje', async () => {
    const { service } = build(10, 12.345);

    await expect(service.assertProjectWithinQuota('proyecto')).rejects.toThrow(
      /12\.35 USD de 10\.00 USD/,
    );
  });

  it('suma en la base de datos, no trayéndose los runs a memoria (delega en el puerto)', async () => {
    const { service, buildRunsRepository } = build(10, 3);

    const spent = await service.getProjectSpendUsd('proyecto');

    // Repetir aquí el defecto de traería los runs de un curso
    // entero para sumar una columna; ahora la agregación vive en
    // BuildRunRepository.sumExecutionCostUsdByProject.
    expect(
      buildRunsRepository.sumExecutionCostUsdByProject,
    ).toHaveBeenCalledWith('proyecto');
    expect(spent).toBe(3);
  });

  it('trata un proyecto sin ejecuciones como gasto cero', async () => {
    const { service, buildRunsRepository } = build(10);
    buildRunsRepository.sumExecutionCostUsdByProject.mockResolvedValue(0);

    await expect(service.getProjectSpendUsd('proyecto')).resolves.toBe(0);
  });
});
