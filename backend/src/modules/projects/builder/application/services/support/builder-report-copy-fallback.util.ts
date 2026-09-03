import {
  BUILDER_REPORT_COPY_SCHEMA_VERSION,
  BuilderEvaluationContractV3,
  BuilderReportCopyContractV1,
} from '../../../domain/builder.types';

/** Plantilla determinista: reporting nunca puede impedir completar el run. */
export function buildReportCopyFallback(
  assessment: BuilderEvaluationContractV3,
): BuilderReportCopyContractV1 {
  const achieved = assessment.criteria.filter(
    (criterion) => criterion.status === 'ACHIEVED',
  );
  const gaps = assessment.criteria.filter(
    (criterion) =>
      criterion.status === 'PARTIAL' || criterion.status === 'NOT_ACHIEVED',
  );
  const blocking = assessment.findings.filter((finding) => finding.blocking);
  const firstAction =
    blocking[0]?.recommendation ??
    gaps[0]?.justification ??
    'Revisa la evidencia del informe y vuelve a ejecutar la práctica.';

  return {
    schemaVersion: BUILDER_REPORT_COPY_SCHEMA_VERSION,
    stage: 'reporting',
    studentNarrative: {
      headline:
        gaps.length === 0
          ? 'Has completado los criterios evaluados; ahora puedes consolidar la solución.'
          : 'Tu entrega ya tiene una base evaluable y un siguiente paso concreto.',
      achievements:
        achieved.length > 0
          ? achieved.map(
              (criterion) =>
                `${criterion.criterion}: ${criterion.justification}`,
            )
          : [
              'La entrega pudo analizarse y deja evidencia para orientar la siguiente iteración.',
            ],
      gaps: gaps.map(
        (criterion) => `${criterion.criterion}: ${criterion.justification}`,
      ),
      conceptBridges: assessment.findings
        .slice(0, 3)
        .map((finding) => finding.explanation),
      nextSteps: Array.from(
        new Set([
          firstAction,
          ...assessment.findings
            .filter((finding) => finding.recommendation !== firstAction)
            .slice(0, 3)
            .map((finding) => finding.recommendation),
        ]),
      ),
    },
    teacherNarrative: {
      executiveSummary: assessment.rationale,
      strengths: achieved.map(
        (criterion) => `${criterion.criterion}: ${criterion.justification}`,
      ),
      concerns: [
        ...gaps.map(
          (criterion) => `${criterion.criterion}: ${criterion.justification}`,
        ),
        ...blocking.map((finding) => finding.explanation),
      ],
      followUp: [firstAction],
      reviewQuestions: assessment.reviewFlags.map(
        (flag) => `Revisar señal: ${flag}`,
      ),
    },
  };
}
