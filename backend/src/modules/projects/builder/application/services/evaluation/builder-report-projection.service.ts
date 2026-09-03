import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  BuildRunReportSummary,
  BuilderReportView,
  ReportComparisonView,
  ReportCriterionView,
  ReportEvidenceView,
  ReportFindingView,
  StudentReportView,
  TeacherReportView,
} from '@educodeai/contracts';
import type { AuthenticatedUser } from '../../../../../auth/interfaces/authenticated-user.interface';
import { UserRole } from '../../../../../users/entities/user.entity';
import {
  BUILDER_REPORT_COPY_SCHEMA_VERSION,
  BUILDER_REPORT_SCHEMA_VERSION,
  BuilderEvaluationContractV2,
  BuilderEvaluationContractV3,
  BuilderReportCopyContractV1,
  BuilderReportEntity,
  CodeQualityFinding,
} from '../../../domain/builder.types';
import {
  BuildRun,
  BuildRunStatus,
} from '../../../domain/entities/build-run.entity';
import { BUILD_RUN_REPOSITORY } from '../../../domain/repositories/build-run.repository.interface';
import type { IBuildRunRepository } from '../../../domain/repositories/build-run.repository.interface';
import { buildReportCopyFallback } from '../support/builder-report-copy-fallback.util';

type Audience = 'student' | 'teacher';

@Injectable()
export class BuilderReportProjectionService {
  constructor(
    @Inject(BUILD_RUN_REPOSITORY)
    private readonly buildRunsRepository: IBuildRunRepository,
  ) {}

  async project(
    run: BuildRun,
    actor: AuthenticatedUser,
    requestedAudience?: Audience,
  ): Promise<BuilderReportView> {
    const staff =
      actor.role === UserRole.ADMIN || actor.role === UserRole.TEACHER;
    const audience = requestedAudience ?? (staff ? 'teacher' : 'student');
    if (!staff && audience === 'teacher') {
      throw new ForbiddenException(
        'Los alumnos solo pueden consultar y exportar su propia vista del informe.',
      );
    }

    const context = await this.buildRunsRepository.findByIdWithDeliveryContext(
      run.id,
    );
    if (!context?.delivery?.assignment || !context.report) {
      throw new NotFoundException(
        'El informe de este run aún no está disponible.',
      );
    }

    const canonical = adaptCanonicalReport(context);
    const comparison = await this.buildComparison(context, canonical);
    const student = this.buildStudentView(context, canonical, comparison);
    if (audience === 'student') return student;
    return this.buildTeacherView(context, canonical, comparison, student);
  }

  toMarkdown(view: BuilderReportView): string {
    const lines = [
      '# Informe de evaluación',
      '',
      `**Audiencia:** ${view.audience === 'student' ? 'Alumno' : 'Profesorado'}`,
      `**Resultado:** ${view.outcome}`,
      '',
    ];
    if (view.audience === 'student') {
      lines.push(
        `**Nota ${view.grade.status === 'OFFICIAL' ? 'oficial' : 'provisional'}:** ${formatGrade(view.grade.value)}`,
        '',
        '## Qué hacer ahora',
        '',
        ...view.nextSteps.map((item) => `- ${item}`),
        '',
        '## Evidencia',
        '',
        ...view.evidence.map(
          (item) => `- **${item.summary}**: ${item.detail ?? ''}`,
        ),
      );
    } else {
      lines.push(
        `**Nota propuesta por IA:** ${formatGrade(view.grade.provisional)}`,
        `**Nota oficial:** ${formatGrade(view.grade.official)}`,
        `**Confianza:** ${view.confidence}`,
        '',
        '## Síntesis docente',
        '',
        view.narrative.executiveSummary,
        '',
        '## Señales de revisión',
        '',
        ...(view.reviewFlags.length
          ? view.reviewFlags.map((item) => `- ${item}`)
          : ['- Sin señales adicionales.']),
      );
    }
    lines.push(
      '',
      '## Rúbrica',
      '',
      ...view.rubric.map(
        (item) =>
          `- **${item.name}:** ${item.awarded}/${item.maxPoints}. ${item.explanation}`,
      ),
      '',
      '## Limitaciones',
      '',
      ...(view.limitations.length
        ? view.limitations.map((item) => `- ${item}`)
        : ['- Sin limitaciones registradas.']),
      '',
    );
    return lines.join('\n');
  }

  private buildStudentView(
    run: BuildRun,
    canonical: CanonicalReport,
    comparison: ReportComparisonView,
  ): StudentReportView {
    const official = run.delivery.grade;
    const sensitiveFragments = collectSensitiveFragments(canonical);
    const findings = canonical.findings
      .filter((finding) => finding.evidenceIds.length === 0)
      .filter((finding) => isStudentSafe(finding.title, finding.explanation))
      .map((finding) => sanitizeFinding(finding, sensitiveFragments));
    // El detalle de evidencia redactado por modelos permanece en la vista
    // docente. El alumno recibe una evidencia mínima derivada de estado propio.
    const evidence = [
      {
        id: stableId('student_evidence', `${run.id}:${canonical.outcome}`, 0),
        kind: 'execution',
        summary: 'Resultado verificado del run',
        detail: `La ejecución finalizó con resultado ${canonical.outcome}.`,
      } satisfies ReportEvidenceView,
    ];
    const sanitizedNextSteps = canonical.copy.studentNarrative.nextSteps
      .map((item) => sanitizeStudentText(item, sensitiveFragments))
      .filter(Boolean);
    const nextSteps = sanitizedNextSteps.length
      ? sanitizedNextSteps
      : [
          'Revisa los criterios de la rúbrica y consulta tus dudas con el profesor.',
        ];

    return {
      schemaVersion: BUILDER_REPORT_SCHEMA_VERSION,
      audience: 'student',
      buildRunId: run.id,
      deliveryId: run.deliveryId,
      deliveryVersion: run.delivery.version,
      generatedAt: canonical.generatedAt,
      outcome: canonical.outcome,
      grade: {
        value: official ?? canonical.evaluation.recommendedGrade ?? null,
        status: official === null ? 'PROVISIONAL' : 'OFFICIAL',
      },
      narrative: {
        headline:
          sanitizeStudentText(
            canonical.copy.studentNarrative.headline,
            sensitiveFragments,
          ) || 'Tu informe está listo para revisar.',
        achievements: canonical.copy.studentNarrative.achievements
          .map((item) => sanitizeStudentText(item, sensitiveFragments))
          .filter(Boolean),
        gaps: canonical.copy.studentNarrative.gaps
          .map((item) => sanitizeStudentText(item, sensitiveFragments))
          .filter(Boolean),
        conceptBridges: canonical.copy.studentNarrative.conceptBridges
          .map((item) => sanitizeStudentText(item, sensitiveFragments))
          .filter(Boolean),
        nextSteps,
      },
      rubric: canonical.criteria.map((criterion) => ({
        ...toCriterionView(criterion),
        explanation:
          criterion.evidenceIds.length === 0
            ? sanitizeStudentText(criterion.justification, sensitiveFragments)
            : criterionStatusExplanation(criterion.status),
        evidenceIds: [],
      })),
      evidence,
      blockers: findings.filter((finding) => finding.blocking),
      nextSteps,
      limitations: canonical.evaluation.limitations
        .filter((item) => isStudentSafe(item))
        .map((item) => sanitizeStudentText(item, sensitiveFragments)),
      comparison,
      advanced: {
        findings,
        warnings: run.warnings
          .filter((item) => isStudentSafe(item))
          .map((item) => sanitizeStudentText(item, sensitiveFragments)),
      },
    };
  }

  private buildTeacherView(
    run: BuildRun,
    canonical: CanonicalReport,
    comparison: ReportComparisonView,
    studentPreview: StudentReportView,
  ): TeacherReportView {
    const provisional = canonical.evaluation.recommendedGrade ?? null;
    const official = run.delivery.grade;
    return {
      schemaVersion: BUILDER_REPORT_SCHEMA_VERSION,
      audience: 'teacher',
      buildRunId: run.id,
      deliveryId: run.deliveryId,
      deliveryVersion: run.delivery.version,
      generatedAt: canonical.generatedAt,
      outcome: canonical.outcome,
      grade: {
        provisional,
        official,
        delta:
          provisional !== null && official !== null
            ? round(official - provisional)
            : null,
      },
      confidence: canonical.evaluation.confidence,
      narrative: canonical.copy.teacherNarrative,
      rubric: canonical.criteria.map(toCriterionView),
      evidence: canonical.evidence.map((item) => ({
        id: item.id,
        kind: item.kind,
        summary: item.summary,
        detail: item.detail,
      })),
      findings: canonical.findings,
      limitations: canonical.evaluation.limitations,
      reviewFlags: canonical.evaluation.reviewFlags,
      comparison,
      studentPreview,
      audit: {
        evaluationSchemaVersion: canonical.evaluation.schemaVersion,
        reportCopySchemaVersion: canonical.copy.schemaVersion,
        usedNarrativeFallback: canonical.usedFallback,
        promptVersion: run.promptVersion,
      },
    };
  }

  private async buildComparison(
    run: BuildRun,
    current: CanonicalReport,
  ): Promise<ReportComparisonView> {
    if (run.delivery.version <= 1) return { reason: 'FIRST_ATTEMPT' };
    const previous =
      await this.buildRunsRepository.findLatestSuccessfulBeforeDeliveryVersion(
        run.delivery.assignmentId,
        run.delivery.version,
      );
    if (!previous?.report) return { reason: 'NO_COMPLETED_PREVIOUS_RUN' };
    const previousReport = previous.report as BuilderReportEntity;
    if (previousReport.schemaVersion !== BUILDER_REPORT_SCHEMA_VERSION) {
      return { reason: 'LEGACY_REPORT_NOT_COMPARABLE' };
    }
    const baseline = adaptCanonicalReport(previous);
    const before = new Map(
      baseline.criteria.map((item) => [normalizeKey(item.criterion), item]),
    );
    const improvedCriteria: string[] = [];
    const regressedCriteria: string[] = [];
    for (const criterion of current.criteria) {
      const previousCriterion = before.get(normalizeKey(criterion.criterion));
      if (!previousCriterion) continue;
      const delta = criterion.awarded - previousCriterion.awarded;
      if (delta > 0.01) improvedCriteria.push(criterion.criterion);
      if (delta < -0.01) regressedCriteria.push(criterion.criterion);
    }
    const oldBlockers = new Map(
      baseline.findings
        .filter((item) => item.blocking)
        .map((item) => [normalizeKey(item.title), item.title]),
    );
    const newBlockers = new Map(
      current.findings
        .filter((item) => item.blocking)
        .map((item) => [normalizeKey(item.title), item.title]),
    );
    return {
      baselineRunId: previous.id,
      baselineDeliveryVersion: previous.delivery.version,
      improvedCriteria,
      regressedCriteria,
      resolvedBlockers: [...oldBlockers]
        .filter(([key]) => !newBlockers.has(key))
        .map(([, title]) => title),
      persistentBlockers: [...newBlockers]
        .filter(([key]) => oldBlockers.has(key))
        .map(([, title]) => title),
      newBlockers: [...newBlockers]
        .filter(([key]) => !oldBlockers.has(key))
        .map(([, title]) => title),
    };
  }
}

export function buildRunReportSummary(run: BuildRun): BuildRunReportSummary {
  const report = run.report as BuilderReportEntity | null;
  const assessment = run.llmAssessment as
    BuilderEvaluationContractV2 | BuilderEvaluationContractV3 | null;
  return {
    schemaVersion: BUILDER_REPORT_SCHEMA_VERSION,
    overallOutcome: report?.overallOutcome ?? 'UNKNOWN',
    passReadiness: report?.coaching?.passReadiness ?? 'BLOCKED',
    provisionalGrade: assessment?.recommendedGrade ?? null,
    hasReport: Boolean(run.report && run.status === BuildRunStatus.SUCCESS),
  };
}

interface CanonicalReport {
  evaluation: BuilderEvaluationContractV3;
  copy: BuilderReportCopyContractV1;
  criteria: BuilderEvaluationContractV3['criteria'];
  evidence: BuilderEvaluationContractV3['evidence'];
  findings: ReportFindingView[];
  outcome: StudentReportView['outcome'];
  generatedAt: string;
  usedFallback: boolean;
}

function adaptCanonicalReport(run: BuildRun): CanonicalReport {
  const report = run.report as BuilderReportEntity;
  if (
    report.schemaVersion === BUILDER_REPORT_SCHEMA_VERSION &&
    report.evaluation
  ) {
    const evaluation = report.evaluation;
    const copy = report.copy ?? buildReportCopyFallback(evaluation);
    return {
      evaluation,
      copy,
      criteria: evaluation.criteria,
      evidence: evaluation.evidence,
      findings: [
        ...evaluation.findings.map((finding) => ({
          id: finding.id,
          category: 'evaluation' as const,
          severity: finding.severity,
          title: finding.title,
          explanation: finding.explanation,
          recommendation: finding.recommendation,
          blocking: finding.blocking,
          evidenceIds: finding.evidenceIds,
          file: finding.file ?? null,
          line: finding.line ?? null,
        })),
        ...qualityFindings(report),
      ],
      outcome: report.overallOutcome ?? 'UNKNOWN',
      generatedAt:
        report.reporting?.generatedAt ??
        run.finishedAt?.toISOString() ??
        run.updatedAt.toISOString(),
      usedFallback: report.reporting?.usedFallback ?? !report.copy,
    };
  }

  // Adaptador de lectura v2: no reescribe jsonb ni intenta regenerar copy.
  const legacy = run.llmAssessment as BuilderEvaluationContractV2;
  const criteria = (legacy?.gradeBreakdown ?? []).map((item, index) => ({
    ...item,
    id: stableId('criterion', item.criterion, index),
    status:
      item.maxPoints <= 0
        ? ('NOT_ASSESSED' as const)
        : item.awarded >= item.maxPoints
          ? ('ACHIEVED' as const)
          : item.awarded <= 0
            ? ('NOT_ACHIEVED' as const)
            : ('PARTIAL' as const),
    evidenceIds: [] as string[],
  }));
  const evidence = (legacy?.observedEvidence ?? []).map((detail, index) => ({
    id: stableId('evidence', detail, index),
    kind: 'execution' as const,
    summary: `Evidencia ${index + 1}`,
    detail,
    visibility: 'teacher' as const,
  }));
  const evaluation: BuilderEvaluationContractV3 = {
    ...legacy,
    schemaVersion: 'builder-evaluation/v3',
    criteria,
    gradeBreakdown: criteria,
    evidence,
    findings: [],
    limitations: legacy?.evaluationLimits ?? [],
    reviewFlags: ['LEGACY_V2_ADAPTED'],
  };
  const copy: BuilderReportCopyContractV1 = {
    schemaVersion: BUILDER_REPORT_COPY_SCHEMA_VERSION,
    stage: 'reporting',
    studentNarrative: legacyStudentNarrative(legacy, report),
    teacherNarrative: {
      executiveSummary:
        legacy?.teacherSummary ?? legacy?.rationale ?? 'Informe histórico.',
      strengths: report.teacherHighlights?.strengths ?? [],
      concerns: report.teacherHighlights?.concerns ?? [],
      followUp: report.teacherHighlights?.followUp ?? [
        'Revisión docente recomendada.',
      ],
      reviewQuestions: [],
    },
  };
  return {
    evaluation,
    copy,
    criteria,
    evidence,
    findings: qualityFindings(report),
    outcome: report.overallOutcome ?? 'UNKNOWN',
    generatedAt: run.finishedAt?.toISOString() ?? run.updatedAt.toISOString(),
    usedFallback: true,
  };
}

function legacyStudentNarrative(
  assessment: BuilderEvaluationContractV2,
  report: BuilderReportEntity,
): BuilderReportCopyContractV1['studentNarrative'] {
  const items = report.pedagogicalNarrative ?? [];
  return {
    headline: assessment?.studentSummary ?? 'Informe histórico adaptado.',
    achievements: items
      .filter((item) => item.kind === 'success')
      .map((item) => item.content),
    gaps: items
      .filter((item) => item.kind === 'gap')
      .map((item) => item.content),
    conceptBridges: items
      .filter((item) => item.kind === 'bridge')
      .map((item) => item.content),
    nextSteps:
      items.filter((item) => item.kind === 'action').map((item) => item.content)
        .length > 0
        ? items
            .filter((item) => item.kind === 'action')
            .map((item) => item.content)
        : (report.llmRecommendations ?? ['Revisa el informe con tu profesor.']),
  };
}

function qualityFindings(report: BuilderReportEntity): ReportFindingView[] {
  const technical = report.technicalFeedback;
  if (!technical) return [];
  return (
    Object.entries(technical) as Array<
      [
        Exclude<ReportFindingView['category'], 'evaluation'>,
        CodeQualityFinding[],
      ]
    >
  ).flatMap(([category, findings]) =>
    findings.map((finding, index) => ({
      id: stableId('quality', `${category}:${finding.title}`, index),
      category,
      severity: finding.severity,
      title: finding.title,
      explanation: finding.detail,
      recommendation: recommendationFrom(finding),
      blocking:
        finding.severity === 'high' &&
        !finding.title.startsWith('BUENA PRÁCTICA:'),
      evidenceIds: [],
      file: finding.file ?? null,
      line: finding.line ?? null,
      codeSnippet: finding.codeSnippet,
    })),
  );
}

function recommendationFrom(finding: CodeQualityFinding): string {
  const match = finding.detail.match(/Recomendación:\s*([\s\S]+)$/iu);
  return match?.[1]?.trim() || finding.conceptExplanation || finding.detail;
}

function toCriterionView(
  criterion: BuilderEvaluationContractV3['criteria'][number],
): ReportCriterionView {
  return {
    id: criterion.id,
    name: criterion.criterion,
    maxPoints: criterion.maxPoints,
    awarded: criterion.awarded,
    status: criterion.status,
    explanation: criterion.justification,
    evidenceIds: criterion.evidenceIds,
    weight: criterion.weight,
    description: criterion.description,
  };
}

function sanitizeFinding(
  finding: ReportFindingView,
  sensitiveFragments: string[],
): ReportFindingView {
  return {
    ...finding,
    title: sanitizeStudentText(finding.title, sensitiveFragments),
    explanation: sanitizeStudentText(finding.explanation, sensitiveFragments),
    recommendation: sanitizeStudentText(
      finding.recommendation,
      sensitiveFragments,
    ),
    codeSnippet: finding.codeSnippet
      ? sanitizeStudentText(finding.codeSnippet, sensitiveFragments)
      : undefined,
  };
}

function isStudentSafe(...values: string[]): boolean {
  return !values.some((value) =>
    /(?:hidden|oculto|oracle|oráculo|teacher[ _-]?test|test docente|secret)/iu.test(
      value,
    ),
  );
}

function sanitizeStudentText(
  value: string,
  sensitiveFragments: string[] = [],
): string {
  return value
    .split(/\r?\n/u)
    .filter(
      (line) =>
        isStudentSafe(line) &&
        !sensitiveFragments.some(
          (fragment) =>
            fragment.length >= 4 &&
            line.toLocaleLowerCase('es-ES').includes(fragment),
        ),
    )
    .join('\n')
    .trim();
}

function collectSensitiveFragments(canonical: CanonicalReport): string[] {
  return Array.from(
    new Set(
      [
        canonical.evaluation.rationale,
        ...canonical.evaluation.reviewFlags,
        ...canonical.evidence
          .filter((item) => item.visibility === 'teacher')
          .flatMap((item) => [item.summary, item.detail]),
        canonical.copy.teacherNarrative.executiveSummary,
        ...canonical.copy.teacherNarrative.concerns,
        ...canonical.copy.teacherNarrative.followUp,
        ...canonical.copy.teacherNarrative.reviewQuestions,
      ]
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim().toLocaleLowerCase('es-ES'))
        .filter(Boolean),
    ),
  );
}

function criterionStatusExplanation(
  status: BuilderEvaluationContractV3['criteria'][number]['status'],
): string {
  switch (status) {
    case 'ACHIEVED':
      return 'El criterio se considera alcanzado con la evidencia disponible.';
    case 'PARTIAL':
      return 'El criterio está parcialmente alcanzado; revisa los próximos pasos.';
    case 'NOT_ACHIEVED':
      return 'El criterio todavía no se considera alcanzado.';
    default:
      return 'No hubo evidencia suficiente para valorar este criterio.';
  }
}

function stableId(prefix: string, value: string, index: number): string {
  let hash = 2166136261;
  const normalized = `${prefix}:${index}:${normalizeKey(value)}`;
  for (let cursor = 0; cursor < normalized.length; cursor += 1) {
    hash ^= normalized.charCodeAt(cursor);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}_${(hash >>> 0).toString(36)}`;
}

function normalizeKey(value: string): string {
  return value.trim().toLocaleLowerCase('es-ES').replace(/\s+/gu, ' ');
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatGrade(value: number | null): string {
  return value === null ? 'Pendiente' : value.toFixed(2);
}
