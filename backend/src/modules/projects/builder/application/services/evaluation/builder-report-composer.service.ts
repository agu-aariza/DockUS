import { Injectable } from '@nestjs/common';
import {
  BuilderEvaluationContractV2,
  BuilderCodeQualityContractV2,
  CodeQualityFinding,
  BuilderReportEntity,
  BuilderCoachingPassReadiness,
  BuilderOutcome,
  BuilderTechnicalFeedbackReport,
} from '../../../domain/builder.types';

@Injectable()
export class BuilderReportComposer {
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

    return {
      overallOutcome: this.resolveReportOutcome(assessment, coaching),
      llmRecommendations: coaching.nextAttemptChecklist.slice(0, 3),
      technicalFeedback,
      coaching,
    };
  }

  private toTechnicalFeedbackReport(
    findings: BuilderCodeQualityContractV2,
  ): BuilderTechnicalFeedbackReport {
    return {
      security: findings.security,
      architecture: findings.architecture,
      quality: findings.quality,
      rubricCompliance: findings.rubricCompliance,
    };
  }

  private composeCoaching(
    assessment: BuilderEvaluationContractV2,
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
      ...(assessment.evaluativeState !== 'E1' ? pedagogicalItems : []),
      ...this.buildBlockingLimitFindings(assessment.evaluationLimits ?? []),
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
        conceptExplanation: 'El sistema automatico no pudo confirmar que tu entrega cumple los requisitos minimos de la rubrica.',
      });
    }

    const shouldImprove = this.dedupeFindings(
      this.flattenTechnicalFeedback(technicalFeedback).filter(
        (finding) =>
          !this.isStrengthFinding(finding) &&
          !mustFix.some((mustFixItem) => this.sameFinding(mustFixItem, finding)),
      ),
    );

    return {
      passReadiness:
        mustFix.length > 0 ? 'BLOCKED' : 'READY_WITH_SUGGESTIONS',
      mustFix,
      shouldImprove,
      strengths,
      nextAttemptChecklist: this.buildChecklist([
        ...mustFix,
        ...shouldImprove,
      ]),
    };
  }

  private resolveReportOutcome(
    assessment: BuilderEvaluationContractV2,
    coaching: { passReadiness: BuilderCoachingPassReadiness },
  ): BuilderOutcome {
    if (coaching.passReadiness === 'BLOCKED') {
      return assessment.evaluativeState === 'E2' ? 'PARTIAL' : 'FAIL';
    }

    if (assessment.evaluativeState === 'E2') {
      return 'PARTIAL';
    }

    if (assessment.evaluativeState === 'E3' || assessment.evaluativeState === 'E4') {
      return 'FAIL';
    }

    if (assessment.evaluativeState === 'E1') {
      return 'PASS';
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
    const normalizedTitle = finding.title
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .trim();
    return normalizedTitle.startsWith('BUENA PRACTICA:');
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
        conceptExplanation: 'Este limite impide al sistema automatico validar tu entrega. Resuelvelo antes de reenviar.',
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
      if (checklist.length >= 5) {
        break;
      }
    }

    return checklist;
  }

  private extractRecommendation(detail: string): string {
    const match = /Recomendaci[oó]n:\s*(.+)$/iu.exec(detail);
    if (match?.[1]) {
      return match[1].trim();
    }

    const firstSentence = detail
      .split('.')
      .map((part) => part.trim())
      .find(Boolean);
    return firstSentence ?? detail.trim();
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
}
