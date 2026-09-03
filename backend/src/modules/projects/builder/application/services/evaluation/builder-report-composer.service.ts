/**
 * @fileoverview Motor Builder de evaluación asíncrona (builder-report-composer.service).
 *
 * @module builder-report-composer.service
 */

import { Injectable } from '@nestjs/common';
import {
  BuilderEvaluationContractV2,
  BuilderEvaluationContractV3,
  BuilderReportCopyContractV1,
  BuilderCodeQualityContractV2,
  CodeQualityFinding,
  BuilderReportEntity,
  BuilderCoachingPassReadiness,
  BuilderOutcome,
  BuilderTechnicalFeedbackReport,
  BuilderPedagogicalNarrativeItem,
  BuilderTeacherHighlights,
  PedagogicalNarrativeKind,
  RubricCriterion,
  EVALUATIVE_STATE_SENTENCES,
  BUILDER_REPORT_SCHEMA_VERSION,
  RubricGradeItem,
} from '../../../domain/builder.types';
import {
  extractRecommendation,
  isStrengthFinding,
} from '../../../domain/code-quality-finding.util';

@Injectable()
export class BuilderReportComposer {
  /**
   * Empareja cada entrada del gradeBreakdown devuelto por el LLM con el criterio
   * ponderado configurado en el proyecto (por nombre, normalizado) y le adjunta
   * su peso (%) y descripción, para que el informe del alumno muestre la rúbrica
   * tal como la definió el profesor. No altera puntuaciones ni justificaciones.
   *
   * Movido desde `BuilderPipelineOrchestrator`: es lógica de
   * dominio de evaluación, no de composición del pipeline.
   */
  enrichGradeBreakdownWithRubric(
    assessment: BuilderEvaluationContractV2 | BuilderEvaluationContractV3,
    rubricCriteria: RubricCriterion[] | null,
  ): void {
    if (!rubricCriteria || rubricCriteria.length === 0) {
      return;
    }
    if (!Array.isArray(assessment.gradeBreakdown)) {
      return;
    }

    const normalize = (value: string): string => value.trim().toLowerCase();
    const criterionByName = new Map(
      rubricCriteria.map((criterion) => [normalize(criterion.name), criterion]),
    );

    const enrich = <T extends RubricGradeItem>(items: T[]): T[] =>
      items.map((item) => {
        const match = criterionByName.get(normalize(item.criterion));
        if (!match) return item;
        return {
          ...item,
          weight: match.weight,
          description: match.description,
        };
      });
    if (assessment.schemaVersion === 'builder-evaluation/v3') {
      assessment.criteria = enrich(assessment.criteria);
      assessment.gradeBreakdown = assessment.criteria;
      return;
    }
    assessment.gradeBreakdown = enrich(assessment.gradeBreakdown);
  }

  composeReportV3(
    assessment: BuilderEvaluationContractV3,
    copy: BuilderReportCopyContractV1,
    qualityFindings: BuilderCodeQualityContractV2,
    pedagogicalItems: CodeQualityFinding[],
    reporting: { usedFallback: boolean; errorCode: string | null },
  ): BuilderReportEntity {
    const technicalFeedback = this.toTechnicalFeedbackReport(qualityFindings);
    const coaching = this.composeCoaching(
      assessment,
      technicalFeedback,
      pedagogicalItems,
    );
    return {
      schemaVersion: BUILDER_REPORT_SCHEMA_VERSION,
      evaluation: assessment,
      copy,
      reporting: {
        ...reporting,
        generatedAt: new Date().toISOString(),
      },
      overallOutcome: this.resolveReportOutcome(assessment, coaching),
      llmRecommendations: copy.studentNarrative.nextSteps.slice(0, 3),
      technicalFeedback,
      coaching,
      learningObjective: this.inferLearningObjective(assessment.criteria),
      professionalVerdict: this.buildProfessionalVerdict(assessment, coaching),
      pedagogicalNarrative: [
        ...copy.studentNarrative.achievements.map((content) => ({
          kind: 'success' as const,
          content,
        })),
        ...copy.studentNarrative.gaps.map((content) => ({
          kind: 'gap' as const,
          content,
        })),
        ...copy.studentNarrative.conceptBridges.map((content) => ({
          kind: 'bridge' as const,
          content,
        })),
        ...copy.studentNarrative.nextSteps.map((content) => ({
          kind: 'action' as const,
          content,
        })),
      ],
      teacherHighlights: {
        strengths: copy.teacherNarrative.strengths,
        concerns: copy.teacherNarrative.concerns,
        followUp: copy.teacherNarrative.followUp,
      },
      // No se persiste Markdown: los exports se generan desde la proyección
      // autorizada y nunca desde el documento canónico.
    };
  }

  composeReport(
    assessment: BuilderEvaluationContractV2,
    qualityFindings: BuilderCodeQualityContractV2,
    pedagogicalItems: CodeQualityFinding[],
  ): BuilderReportEntity {
    const technicalFeedback = this.toTechnicalFeedbackReport(qualityFindings);
    const coaching = this.composeCoaching(
      assessment,
      technicalFeedback,
      pedagogicalItems,
    );
    const pedagogicalNarrative = this.parsePedagogicalNarrative(
      assessment.studentSummary,
    );
    const teacherHighlights = this.parseTeacherHighlights(
      assessment.teacherSummary,
    );
    const professionalVerdict = this.buildProfessionalVerdict(
      assessment,
      coaching,
    );

    const report: BuilderReportEntity = {
      overallOutcome: this.resolveReportOutcome(assessment, coaching),
      llmRecommendations: coaching.nextAttemptChecklist.slice(0, 3),
      technicalFeedback,
      coaching,
      learningObjective: this.inferLearningObjective(assessment.gradeBreakdown),
      professionalVerdict,
      pedagogicalNarrative,
      teacherHighlights,
    };

    report.printableMarkdown = this.buildPrintableMarkdown(report, assessment);

    return report;
  }

  private toTechnicalFeedbackReport(
    findings: BuilderCodeQualityContractV2,
  ): BuilderTechnicalFeedbackReport {
    // Las listas de coaching (mustFix/shouldImprove/strengths) sí se deduplican,
    // pero estas se copiaban verbatim: el modelo repite con frecuencia el mismo
    // hallazgo en dos categorías, y el docente lo veía duplicado en el informe
    // técnico mientras el resumen pedagógico lo mostraba una sola vez.
    // La deduplicación es por categoría, no global: un hallazgo que aplique
    // a seguridad y a arquitectura es legítimo en ambas.
    return {
      security: this.dedupeFindings(findings.security),
      architecture: this.dedupeFindings(findings.architecture),
      quality: this.dedupeFindings(findings.quality),
      rubricCompliance: this.dedupeFindings(findings.rubricCompliance),
    };
  }

  private composeCoaching(
    assessment: BuilderEvaluationContractV2 | BuilderEvaluationContractV3,
    technicalFeedback: BuilderTechnicalFeedbackReport,
    pedagogicalItems: CodeQualityFinding[],
  ): {
    passReadiness: BuilderCoachingPassReadiness;
    mustFix: CodeQualityFinding[];
    shouldImprove: CodeQualityFinding[];
    strengths: CodeQualityFinding[];
    nextAttemptChecklist: string[];
  } {
    const strengths = this.dedupeFindings(
      this.flattenTechnicalFeedback(technicalFeedback).filter((finding) =>
        this.isStrengthFinding(finding),
      ),
    );

    const mustFix = this.dedupeFindings([
      ...technicalFeedback.security.filter(
        (finding) =>
          finding.severity === 'high' && !this.isStrengthFinding(finding),
      ),
      ...technicalFeedback.architecture.filter(
        (finding) =>
          finding.severity === 'high' && !this.isStrengthFinding(finding),
      ),
      ...technicalFeedback.quality.filter(
        (finding) =>
          finding.severity === 'high' && !this.isStrengthFinding(finding),
      ),
      ...technicalFeedback.rubricCompliance.filter(
        (finding) =>
          finding.severity === 'high' && !this.isStrengthFinding(finding),
      ),
      // Los items pedagógicos entran como bloqueo salvo que sean elogios: un
      // "BUENA PRÁCTICA" nunca es algo que el alumno deba corregir.
      ...(assessment.evaluativeState !== 'E1'
        ? pedagogicalItems.filter((item) => !this.isStrengthFinding(item))
        : []),
      ...this.buildBlockingLimitFindings(assessment.evaluationLimits),
    ]);

    if (mustFix.length === 0 && assessment.evaluativeState !== 'E1') {
      mustFix.push({
        title: 'La entrega no se pudo validar por completo',
        detail:
          `Observacion: ${assessment.rationale} ` +
          'Impacto: el sistema no pudo confirmar que la practica cumple lo esencial. ' +
          'Recomendacion: corrige la causa principal indicada en el informe y vuelve a ejecutar la entrega.',
        severity: 'high',
        codeSnippet: '',
        level: 'basico',
        conceptExplanation:
          'El sistema automatico no pudo confirmar que tu entrega cumple los requisitos minimos de la rubrica.',
      });
    }

    const shouldImprove = this.dedupeFindings(
      this.flattenTechnicalFeedback(technicalFeedback).filter(
        (finding) =>
          !this.isStrengthFinding(finding) &&
          !mustFix.some((mustFixItem) =>
            this.sameFinding(mustFixItem, finding),
          ),
      ),
    );

    return {
      passReadiness: mustFix.length > 0 ? 'BLOCKED' : 'READY_WITH_SUGGESTIONS',
      mustFix,
      shouldImprove,
      strengths,
      // El checklist es "qué hago antes de reenviar", no un índice del informe:
      // se alimenta solo de lo bloqueante. Cuando no hay nada que bloquee, las
      // mejoras opcionales ocupan su lugar para que la lista no quede vacía.
      nextAttemptChecklist: this.buildChecklist(
        mustFix.length > 0 ? mustFix : shouldImprove,
      ),
    };
  }

  private resolveReportOutcome(
    assessment: BuilderEvaluationContractV2 | BuilderEvaluationContractV3,
    coaching: { passReadiness: BuilderCoachingPassReadiness },
  ): BuilderOutcome {
    if (assessment.evaluativeState === 'E1') {
      return 'PASS';
    }

    if (coaching.passReadiness === 'BLOCKED') {
      return assessment.evaluativeState === 'E2' ? 'PARTIAL' : 'FAIL';
    }

    if (assessment.evaluativeState === 'E2') {
      return 'PARTIAL';
    }

    if (
      assessment.evaluativeState === 'E3' ||
      assessment.evaluativeState === 'E4'
    ) {
      return 'FAIL';
    }

    return 'UNKNOWN';
  }

  private flattenTechnicalFeedback(
    technicalFeedback: BuilderTechnicalFeedbackReport,
  ): CodeQualityFinding[] {
    return [
      ...technicalFeedback.security,
      ...technicalFeedback.architecture,
      ...technicalFeedback.quality,
      ...technicalFeedback.rubricCompliance,
    ];
  }

  private isStrengthFinding(finding: CodeQualityFinding): boolean {
    return isStrengthFinding(finding);
  }

  private buildBlockingLimitFindings(limits: string[]): CodeQualityFinding[] {
    return limits
      .filter((limit) => this.isBlockingEvaluationLimit(limit))
      .map((limit) => ({
        title: 'Limite de validacion que debes resolver',
        detail:
          `Observacion: ${limit} ` +
          'Impacto: el sistema no pudo confirmar el comportamiento esperado. ' +
          'Recomendacion: corrige el bloqueo operativo o funcional antes de reenviar.',
        severity: 'high' as const,
        codeSnippet: '',
        level: 'basico' as const,
        conceptExplanation:
          'Este limite impide al sistema automatico validar tu entrega. Resuelvelo antes de reenviar.',
      }));
  }

  private isBlockingEvaluationLimit(limit: string): boolean {
    return /fall|error|bloque|no se pudo|no pudo|inval|syntax|segfault|denied|missing|not found/iu.test(
      limit,
    );
  }

  private buildChecklist(findings: CodeQualityFinding[]): string[] {
    const checklist: string[] = [];

    for (const finding of findings) {
      const recommendation = this.extractRecommendation(finding.detail);
      const location =
        finding.file && finding.line
          ? ` (${finding.file}:${finding.line})`
          : finding.file
            ? ` (${finding.file})`
            : '';
      const entry = `${finding.title}: ${recommendation}${location}`;
      if (!checklist.includes(entry)) {
        checklist.push(entry);
      }
      // Tres pasos son accionables; cinco se leen como una lista de deberes y
      // el alumno no sabe por dónde empezar.
      if (checklist.length >= 3) {
        break;
      }
    }

    return checklist;
  }

  private extractRecommendation(detail: string): string {
    return extractRecommendation(detail);
  }

  private dedupeFindings(findings: CodeQualityFinding[]): CodeQualityFinding[] {
    const seen = new Set<string>();
    const deduped: CodeQualityFinding[] = [];

    for (const finding of findings) {
      const key = this.findingKey(finding);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      deduped.push(finding);
    }

    return deduped;
  }

  private sameFinding(
    left: CodeQualityFinding,
    right: CodeQualityFinding,
  ): boolean {
    return this.findingKey(left) === this.findingKey(right);
  }

  private findingKey(finding: CodeQualityFinding): string {
    return [
      finding.title,
      finding.detail,
      finding.file ?? '',
      finding.line ?? '',
    ].join('|');
  }

  private parsePedagogicalNarrative(
    studentSummary: string | undefined,
  ): BuilderPedagogicalNarrativeItem[] {
    if (!studentSummary?.trim()) {
      return [];
    }

    const markers: Array<[PedagogicalNarrativeKind, RegExp]> = [
      ['success', /^(?:##?\s*|\*\*)?(?:Logro|Fortaleza|Lo que hiciste bien)/iu],
      [
        'gap',
        /^(?:##?\s*|\*\*)?(?:Diagn[oó]stico|Problema|Qu[eé] fall[oó]|Error)/iu,
      ],
      [
        'bridge',
        /^(?:##?\s*|\*\*)?(?:Puente|Conexi[oó]n|Concepto|Aprendizaje)/iu,
      ],
      [
        'action',
        /^(?:##?\s*|\*\*)?(?:Pr[oó]ximo paso|Acci[oó]n|Qu[eé] hacer|Plan)/iu,
      ],
    ];

    const lines = studentSummary.split('\n').map((line) => line.trim());
    const parsed: Array<{ kind: PedagogicalNarrativeKind; content: string }> =
      [];
    let current: { kind: PedagogicalNarrativeKind; buffer: string[] } | null =
      null;

    for (const line of lines) {
      const match = markers.find(([, regex]) => regex.test(line));
      if (match) {
        if (current) {
          parsed.push({
            kind: current.kind,
            content: current.buffer.join(' ').trim(),
          });
        }
        current = { kind: match[0], buffer: [] };
        continue;
      }
      if (current && line) {
        current.buffer.push(line);
      }
    }

    if (current?.buffer.length) {
      parsed.push({
        kind: current.kind,
        content: current.buffer.join(' ').trim(),
      });
    }

    if (parsed.length > 0) {
      return parsed;
    }

    return this.fallbackPedagogicalNarrative(studentSummary);
  }

  private fallbackPedagogicalNarrative(
    studentSummary: string,
  ): BuilderPedagogicalNarrativeItem[] {
    const sentences = studentSummary
      .split(/(?<=[.!?])\s+/u)
      .map((s) => s.trim())
      .filter(Boolean);

    const items: BuilderPedagogicalNarrativeItem[] = [];

    if (sentences.length > 0) {
      items.push({ kind: 'success', content: sentences[0] });
    }

    const gapIndicators =
      /\b(falta|error|incorrecto|no cumple|debes corregir|problema|falla|bug)\b/iu;
    const bridgeIndicators =
      /\b(concepto|principio|aprendizaje|conectar|entender|comprender|patr[oó]n)\b/iu;
    const actionIndicators =
      /\b(prueba|intenta|cambia|revisa|implementa|a[nñ]ade|usa|corrige)\b/iu;

    const gaps: string[] = [];
    const bridges: string[] = [];
    const actions: string[] = [];

    for (let i = 1; i < sentences.length; i++) {
      const sentence = sentences[i];
      if (actionIndicators.test(sentence) && i >= sentences.length - 2) {
        actions.push(sentence);
      } else if (bridgeIndicators.test(sentence)) {
        bridges.push(sentence);
      } else if (gapIndicators.test(sentence)) {
        gaps.push(sentence);
      } else if (i >= sentences.length - 1) {
        actions.push(sentence);
      } else {
        gaps.push(sentence);
      }
    }

    if (gaps.length) {
      items.push({ kind: 'gap', content: gaps.join(' ') });
    }
    if (bridges.length) {
      items.push({ kind: 'bridge', content: bridges.join(' ') });
    }
    if (actions.length) {
      items.push({ kind: 'action', content: actions.join(' ') });
    }

    return items;
  }

  private parseTeacherHighlights(
    teacherSummary: string | undefined,
  ): BuilderTeacherHighlights {
    const empty: BuilderTeacherHighlights = {
      strengths: [],
      concerns: [],
      followUp: [],
    };

    if (!teacherSummary?.trim()) {
      return empty;
    }

    const markers: Array<keyof BuilderTeacherHighlights> = [
      'strengths',
      'concerns',
      'followUp',
    ];
    const sectionRegex: Record<string, RegExp> = {
      strengths: /^(?:##?\s*|\*\*)?(?:Fortalezas|Puntos fuertes|Logros)/iu,
      concerns:
        /^(?:##?\s*|\*\*)?(?:Preocupaciones|Incidencias|Problemas|Hallazgos)/iu,
      followUp:
        /^(?:##?\s*|\*\*)?(?:Seguimiento|Pr[oó]ximos pasos|Recomendaciones)/iu,
    };

    const lines = teacherSummary.split('\n').map((line) => line.trim());
    const sections: Record<string, string[]> = {
      strengths: [],
      concerns: [],
      followUp: [],
    };
    let current: keyof BuilderTeacherHighlights | null = null;

    for (const line of lines) {
      const match = markers.find((m) => sectionRegex[m].test(line));
      if (match) {
        current = match;
        continue;
      }
      if (current && line) {
        sections[current].push(line);
      }
    }

    const result: BuilderTeacherHighlights = {
      strengths: sections.strengths,
      concerns: sections.concerns,
      followUp: sections.followUp,
    };

    if (
      result.strengths.length === 0 &&
      result.concerns.length === 0 &&
      result.followUp.length === 0
    ) {
      return this.fallbackTeacherHighlights(teacherSummary);
    }

    return result;
  }

  private fallbackTeacherHighlights(
    teacherSummary: string,
  ): BuilderTeacherHighlights {
    const sentences = teacherSummary
      .split(/(?<=[.!?])\s+/u)
      .map((s) => s.trim())
      .filter(Boolean);

    const strengths: string[] = [];
    const concerns: string[] = [];
    const followUp: string[] = [];

    const strengthIndicators =
      /\b(limpia|sin errores|correctamente|cumple|bien|apropiado|adecuado|logra|positivo|fortaleza)\b/iu;
    const concernIndicators =
      /\b(error|falla|no cumple|no coincide|incorrecto|problema|falta|bloque|debe corregir)\b/iu;

    for (const sentence of sentences) {
      if (strengthIndicators.test(sentence)) {
        strengths.push(sentence);
      } else if (concernIndicators.test(sentence)) {
        concerns.push(sentence);
      } else {
        followUp.push(sentence);
      }
    }

    return { strengths, concerns, followUp };
  }

  private buildProfessionalVerdict(
    assessment: BuilderEvaluationContractV2 | BuilderEvaluationContractV3,
    coaching: { passReadiness: BuilderCoachingPassReadiness },
  ): string {
    const outcome =
      coaching.passReadiness === 'BLOCKED'
        ? 'No apto'
        : 'Apto con observaciones';
    const grade =
      assessment.recommendedGrade !== undefined
        ? `Nota recomendada: ${assessment.recommendedGrade}. `
        : '';
    const stateSentence =
      EVALUATIVE_STATE_SENTENCES[assessment.evaluativeState];
    const state = stateSentence ? `${stateSentence} ` : '';
    const rationale = assessment.rationale;
    return `${outcome}. ${grade}${state}${rationale}`;
  }

  private inferLearningObjective(
    gradeBreakdown: Array<{ criterion: string }> | undefined,
  ): string | undefined {
    if (!gradeBreakdown?.length) {
      return undefined;
    }
    const criteria = gradeBreakdown.map((item) => item.criterion).join(', ');
    return `Demostrar comprensión y aplicación de: ${criteria}.`;
  }

  private buildPrintableMarkdown(
    report: BuilderReportEntity,
    assessment: BuilderEvaluationContractV2,
  ): string {
    const lines: string[] = [
      '# Informe de evaluación',
      '',
      `**Resultado:** ${report.overallOutcome ?? 'Desconocido'}`,
      `**Veredicto profesional:** ${report.professionalVerdict ?? '—'}`,
      '',
      '## Objetivo de aprendizaje',
      '',
      report.learningObjective ?? 'No especificado.',
      '',
      '## Narrativa pedagógica',
      '',
    ];

    for (const item of report.pedagogicalNarrative ?? []) {
      const label =
        item.kind === 'success'
          ? 'Logro'
          : item.kind === 'gap'
            ? 'Brecha'
            : item.kind === 'bridge'
              ? 'Puente de aprendizaje'
              : 'Acción recomendada';
      lines.push(`### ${label}`, '', item.content, '');
    }

    lines.push(
      '## Desglose de criterios',
      '',
      ...assessment.gradeBreakdown.map(
        (item) =>
          `- **${item.criterion}:** ${item.awarded}/${item.maxPoints} puntos — ${item.justification}`,
      ),
      '',
      '## Resumen para docentes',
      '',
      assessment.teacherSummary,
      '',
    );

    return lines.join('\n');
  }
}
