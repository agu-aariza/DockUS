import { toBuildRunResponseDto } from './build-run-response.dto';
import { BuildRunStatus } from '../../domain/entities/build-run.entity';
import type { BuildRun } from '../../domain/entities/build-run.entity';

describe('toBuildRunResponseDto', () => {
  it('preserves rich llm assessment fields used by the student frontend', () => {
    const run = {
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

    const dto = toBuildRunResponseDto(run);

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
});
