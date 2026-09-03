import { BuilderReportProjectionService } from '@app/modules/projects/builder/application/services/evaluation/builder-report-projection.service';
import { BuildRunStatus } from '@app/modules/projects/builder/domain/entities/build-run.entity';
import type { IBuildRunRepository } from '@app/modules/projects/builder/domain/repositories/build-run.repository.interface';
import type { AuthenticatedUser } from '@app/modules/auth/interfaces/authenticated-user.interface';
import { UserRole } from '@app/modules/users/entities/user.entity';
import { ForbiddenException } from '@nestjs/common';

const student: AuthenticatedUser = {
  userId: 'student-1',
  email: 'student@example.com',
  role: UserRole.STUDENT,
};
const teacher: AuthenticatedUser = {
  userId: 'teacher-1',
  email: 'teacher@example.com',
  role: UserRole.TEACHER,
};

function evaluation(
  criterionAwarded = 8,
  blockers: Array<{ id: string; title: string }> = [],
) {
  return {
    schemaVersion: 'builder-evaluation/v3',
    stage: 'evaluation',
    confidence: 'high',
    recommendedGrade: criterionAwarded,
    limitations: ['Solo se ejecutaron tests públicos.'],
    reviewFlags: ['CHECK_EDGE_CASE'],
    criteria: [
      {
        id: 'criterion-functionality',
        criterion: 'Funcionalidad',
        maxPoints: 10,
        awarded: criterionAwarded,
        status: criterionAwarded >= 10 ? 'ACHIEVED' : 'PARTIAL',
        justification: 'Cumple el caso principal.',
        evidenceIds: ['evidence-public', 'evidence-hidden'],
      },
    ],
    gradeBreakdown: [],
    evidence: [
      {
        id: 'evidence-public',
        kind: 'execution',
        summary: 'Suite pública',
        detail: '4/4 tests correctos.',
        visibility: 'student',
      },
      {
        id: 'evidence-hidden',
        kind: 'execution',
        summary: 'Test docente oculto',
        detail: 'EXPECTED_VALUE_42',
        visibility: 'teacher',
      },
    ],
    findings: blockers.map((item) => ({
      ...item,
      severity: 'high',
      explanation: `Detalle de ${item.title}`,
      recommendation: `Corrige ${item.title}`,
      blocking: true,
      evidenceIds: ['evidence-public'],
    })),
  };
}

function copy() {
  return {
    schemaVersion: 'builder-report-copy/v1',
    stage: 'reporting',
    studentNarrative: {
      headline: 'Buen avance.',
      achievements: ['El flujo principal funciona.'],
      gaps: ['Falta un caso límite.'],
      conceptBridges: ['Usa una guarda temprana.'],
      nextSteps: ['Añade el caso límite.'],
    },
    teacherNarrative: {
      executiveSummary: 'TEACHER-NARRATIVE-ONLY',
      strengths: ['Estructura clara.'],
      concerns: ['Cobertura incompleta.'],
      followUp: ['Validar el caso límite.'],
      reviewQuestions: ['¿Qué ocurre con entrada vacía?'],
    },
  };
}

function run(
  options: {
    id?: string;
    version?: number;
    officialGrade?: number | null;
    awarded?: number;
    blockers?: Array<{ id: string; title: string }>;
  } = {},
) {
  const assessed = evaluation(options.awarded, options.blockers);
  return {
    id: options.id ?? 'run-current',
    deliveryId: `delivery-${options.version ?? 2}`,
    status: BuildRunStatus.SUCCESS,
    warnings: ['Aviso público.', 'teacher test SECRET-WARNING'],
    promptVersion: 'prompt-v3',
    finishedAt: new Date('2026-09-02T10:00:00.000Z'),
    updatedAt: new Date('2026-09-02T10:00:00.000Z'),
    delivery: {
      id: `delivery-${options.version ?? 2}`,
      version: options.version ?? 2,
      grade: options.officialGrade ?? null,
      assignmentId: 'assignment-1',
      assignment: { id: 'assignment-1' },
    },
    llmAssessment: assessed,
    report: {
      schemaVersion: 'builder-report/v3',
      overallOutcome: 'PASS',
      evaluation: assessed,
      copy: copy(),
      reporting: {
        generatedAt: '2026-09-02T10:00:00.000Z',
        usedFallback: false,
      },
    },
  } as any;
}

describe('BuilderReportProjectionService', () => {
  const repository = {
    findByIdWithDeliveryContext: jest.fn(),
    findLatestSuccessfulBeforeDeliveryVersion: jest.fn(),
  } as unknown as jest.Mocked<IBuildRunRepository>;
  let service: BuilderReportProjectionService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BuilderReportProjectionService(repository);
  });

  it('prevents a student from requesting the teacher projection', async () => {
    await expect(
      service.project(run(), student, 'teacher'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.findByIdWithDeliveryContext).not.toHaveBeenCalled();
  });

  it('returns an allowlisted student view with the official grade', async () => {
    const current = run({ officialGrade: 7.5 });
    current.report.copy.studentNarrative.achievements = [
      'La respuesta exacta es EXPECTED_VALUE_42.',
    ];
    repository.findByIdWithDeliveryContext.mockResolvedValue(current);
    repository.findLatestSuccessfulBeforeDeliveryVersion.mockResolvedValue(
      null,
    );

    const view = await service.project(current, student);
    const serialized = JSON.stringify(view);
    const markdown = service.toMarkdown(view);

    expect(view.audience).toBe('student');
    if (view.audience !== 'student') throw new Error('expected student view');
    expect(view.grade).toEqual({ value: 7.5, status: 'OFFICIAL' });
    expect(view.evidence).toEqual([
      expect.objectContaining({
        kind: 'execution',
        summary: 'Resultado verificado del run',
        detail: 'La ejecución finalizó con resultado PASS.',
      }),
    ]);
    expect(view.rubric[0].evidenceIds).toEqual([]);
    expect(view.advanced.warnings).toEqual(['Aviso público.']);
    expect(serialized).not.toContain('TEACHER-NARRATIVE-ONLY');
    expect(serialized).not.toContain('CHECK_EDGE_CASE');
    expect(serialized).not.toContain('EXPECTED_VALUE_42');
    expect(markdown).not.toContain('TEACHER-NARRATIVE-ONLY');
    expect(markdown).not.toContain('CHECK_EDGE_CASE');
    expect(markdown).not.toContain('EXPECTED_VALUE_42');
  });

  it('keeps provisional and official grades visible only in the teacher view', async () => {
    const current = run({ officialGrade: 7.5, awarded: 8 });
    repository.findByIdWithDeliveryContext.mockResolvedValue(current);
    repository.findLatestSuccessfulBeforeDeliveryVersion.mockResolvedValue(
      null,
    );

    const view = await service.project(current, teacher);

    expect(view.audience).toBe('teacher');
    if (view.audience !== 'teacher') throw new Error('expected teacher view');
    expect(view.grade).toEqual({ provisional: 8, official: 7.5, delta: -0.5 });
    expect(view.reviewFlags).toEqual(['CHECK_EDGE_CASE']);
    expect(view.studentPreview.grade).toEqual({
      value: 7.5,
      status: 'OFFICIAL',
    });
  });

  it('compares criteria and resolved, persistent and new blockers', async () => {
    const current = run({
      awarded: 8,
      blockers: [
        { id: 'persistent-current', title: 'Bloqueo persistente' },
        { id: 'new-current', title: 'Bloqueo nuevo' },
      ],
    });
    const previous = run({
      id: 'run-previous',
      version: 1,
      awarded: 6,
      blockers: [
        { id: 'resolved-old', title: 'Bloqueo resuelto' },
        { id: 'persistent-old', title: 'Bloqueo persistente' },
      ],
    });
    repository.findByIdWithDeliveryContext.mockResolvedValue(current);
    repository.findLatestSuccessfulBeforeDeliveryVersion.mockResolvedValue(
      previous,
    );

    const view = await service.project(current, teacher);

    expect(view.comparison).toEqual({
      baselineRunId: 'run-previous',
      baselineDeliveryVersion: 1,
      improvedCriteria: ['Funcionalidad'],
      regressedCriteria: [],
      resolvedBlockers: ['Bloqueo resuelto'],
      persistentBlockers: ['Bloqueo persistente'],
      newBlockers: ['Bloqueo nuevo'],
    });
  });

  it('returns an explicit first-attempt comparison reason', async () => {
    const first = run({ version: 1 });
    repository.findByIdWithDeliveryContext.mockResolvedValue(first);

    const view = await service.project(first, student);

    expect(view.comparison).toEqual({ reason: 'FIRST_ATTEMPT' });
    expect(
      repository.findLatestSuccessfulBeforeDeliveryVersion,
    ).not.toHaveBeenCalled();
  });
});
