import { DemoSeedService } from './demo-seed.service';

function buildService(config: Record<string, string | undefined>) {
  const usersRepository = {
    findOne: jest.fn().mockResolvedValue({ id: 'existing-teacher' }),
    save: jest.fn(),
    create: jest.fn(),
  };
  const projectsRepository = { save: jest.fn(), create: jest.fn() };
  const assignmentsRepository = { save: jest.fn(), create: jest.fn() };
  const deliveriesRepository = { save: jest.fn(), create: jest.fn() };
  const configService = { get: jest.fn((key: string) => config[key]) };
  const logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };

  const service = new DemoSeedService(
    usersRepository as never,
    projectsRepository as never,
    assignmentsRepository as never,
    deliveriesRepository as never,
    configService as never,
    logger as never,
    'api',
  );

  return { service, usersRepository, logger };
}

describe('DemoSeedService', () => {
  it('no siembra y registra un error cuando SEED_DEMO_DATA esta activo en produccion', async () => {
    const { service, usersRepository, logger } = buildService({
      SEED_DEMO_DATA: 'true',
      NODE_ENV: 'production',
    });

    await service.onApplicationBootstrap();

    expect(usersRepository.findOne).not.toHaveBeenCalled();
    expect(usersRepository.save).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('SEED_DEMO_DATA'),
      undefined,
      DemoSeedService.name,
    );
  });

  it('conserva el comportamiento actual fuera de produccion: intenta sembrar', async () => {
    const { service, usersRepository, logger } = buildService({
      SEED_DEMO_DATA: 'true',
      NODE_ENV: 'development',
    });

    await service.onApplicationBootstrap();

    // No se bloquea por el guardarraíl de produccion: el flujo llega al
    // chequeo de idempotencia existente (que aquí resuelve "ya existe").
    expect(usersRepository.findOne).toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('no hace nada si SEED_DEMO_DATA no esta activo, en ningun entorno', async () => {
    const { service, usersRepository } = buildService({
      SEED_DEMO_DATA: 'false',
      NODE_ENV: 'production',
    });

    await service.onApplicationBootstrap();

    expect(usersRepository.findOne).not.toHaveBeenCalled();
  });
});
