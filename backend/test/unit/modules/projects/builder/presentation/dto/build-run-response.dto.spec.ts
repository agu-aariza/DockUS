import { toBuildRunResponseDto } from '@app/modules/projects/builder/presentation/dto/build-run-response.dto';
import { BuildRunStatus } from '@app/modules/projects/builder/domain/entities/build-run.entity';
import type { BuildRun } from '@app/modules/projects/builder/domain/entities/build-run.entity';
import { UserRole } from '@app/modules/users/entities/user.entity';

function buildRunFixture(): BuildRun {
  return {
    id: 'run-1',
    deliveryId: 'delivery-1',
    triggeredById: 'teacher-1',
    status: BuildRunStatus.SUCCESS,
    latestEventSequence: '12',
    llmAssessment: {
      evaluativeState: 'E2',
      studentSummary: 'Resumen para alumno',
      teacherSummary: 'Resumen para docente',
      gradeBreakdown: [
        {
          criterion: 'Salida correcta',
          maxPoints: 5,
          awarded: 3,
          justification: 'Fallo menor de formato.',
        },
      ],
      runtime: {
        family: 'python',
        version: '3.12',
        supported: true,
        reason: null,
      },
    },
    report: {
      teacherHighlights: ['Sospecha de copia en la funcion principal'],
      coaching: {
        passReadiness: 'BLOCKED',
        mustFix: [
          {
            title: 'Falta main.py',
            detail: 'Incluye el entrypoint correcto.',
            severity: 'high',
            codeSnippet: 'print("hola")',
            level: 'basico',
            conceptExplanation: 'El entrypoint permite arrancar el programa.',
          },
        ],
        shouldImprove: [],
        strengths: [],
        nextAttemptChecklist: ['Anade main.py'],
      },
    },
    failureReason: null,
    warnings: [],
    startedAt: new Date('2026-05-11T10:00:00.000Z'),
    finishedAt: new Date('2026-05-11T10:01:00.000Z'),
    createdAt: new Date('2026-05-11T10:00:00.000Z'),
    updatedAt: new Date('2026-05-11T10:01:00.000Z'),
  } as unknown as BuildRun;
}

describe('toBuildRunResponseDto', () => {
  it('preserves the full assessment for staff and returns only a report summary', () => {
    const dto = toBuildRunResponseDto(buildRunFixture(), UserRole.TEACHER);

    expect(dto.llmAssessment).toMatchObject({
      evaluativeState: 'E2',
      studentSummary: 'Resumen para alumno',
      teacherSummary: 'Resumen para docente',
    });
    expect((dto.llmAssessment as any).gradeBreakdown).toHaveLength(1);
    expect(dto.reportSummary).toMatchObject({
      hasReport: true,
      passReadiness: 'BLOCKED',
    });
    expect((dto as any).report).toBeUndefined();
  });

  it('never returns the canonical report or llmAssessment to a student', () => {
    const run = buildRunFixture();
    run.failureReason = 'teacher test failed: EXPECTED_VALUE_42';
    run.warnings = [
      'Aviso público.',
      'LLM prompt contiene el oráculo EXPECTED_VALUE_42',
    ];
    const dto = toBuildRunResponseDto(run, UserRole.STUDENT);

    expect(dto.llmAssessment).toBeUndefined();
    expect((dto as any).report).toBeUndefined();
    expect(dto.reportSummary.hasReport).toBe(true);
    expect(dto.warnings).toEqual(['Aviso público.']);
    expect(dto.failureReason).not.toContain('EXPECTED_VALUE_42');
  });

  it('keeps full payload for ADMIN role', () => {
    const dto = toBuildRunResponseDto(buildRunFixture(), UserRole.ADMIN);

    expect(dto.llmAssessment).toMatchObject({
      teacherSummary: 'Resumen para docente',
    });
    expect((dto as any).report).toBeUndefined();
  });

  it('fails closed when actor role is omitted', () => {
    const dto = toBuildRunResponseDto(buildRunFixture());

    expect(dto.llmAssessment).toBeUndefined();
    expect((dto as any).report).toBeUndefined();
  });

  it('does not mutate the original report object when redacting', () => {
    const run = buildRunFixture();
    toBuildRunResponseDto(run, UserRole.STUDENT);

    expect((run.report as any).teacherHighlights).toEqual([
      'Sospecha de copia en la funcion principal',
    ]);
  });
});
/**
 * Pruebas de serialización y validación del DTO público de respuesta de una ejecución.
 */
