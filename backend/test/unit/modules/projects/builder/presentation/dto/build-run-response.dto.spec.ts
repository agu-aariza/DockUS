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
  it('preserves rich llm assessment fields used by the student frontend', () => {
    const dto = toBuildRunResponseDto(buildRunFixture(), UserRole.TEACHER);

    expect(dto.llmAssessment).toMatchObject({
      evaluativeState: 'E2',
      studentSummary: 'Resumen para alumno',
      teacherSummary: 'Resumen para docente',
    });
    expect((dto.llmAssessment as any).gradeBreakdown).toHaveLength(1);
    expect((dto.report as any).coaching.mustFix[0]).toMatchObject({
      title: 'Falta main.py',
      codeSnippet: 'print("hola")',
      conceptExplanation: 'El entrypoint permite arrancar el programa.',
    });
  });

  it('redacts llmAssessment and teacherHighlights for STUDENT role', () => {
    const dto = toBuildRunResponseDto(buildRunFixture(), UserRole.STUDENT);

    expect(dto.llmAssessment).toBeUndefined();
    expect(dto.report).toBeDefined();
    expect((dto.report as any).teacherHighlights).toBeUndefined();
    expect((dto.report as any).coaching.mustFix[0]).toMatchObject({
      title: 'Falta main.py',
    });
  });

  it('keeps full payload for ADMIN role', () => {
    const dto = toBuildRunResponseDto(buildRunFixture(), UserRole.ADMIN);

    expect(dto.llmAssessment).toMatchObject({
      teacherSummary: 'Resumen para docente',
    });
    expect((dto.report as any).teacherHighlights).toEqual([
      'Sospecha de copia en la funcion principal',
    ]);
  });

  it('fails closed when actor role is omitted', () => {
    const dto = toBuildRunResponseDto(buildRunFixture());

    expect(dto.llmAssessment).toBeUndefined();
    expect((dto.report as any).teacherHighlights).toBeUndefined();
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
