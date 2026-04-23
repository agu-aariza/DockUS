import type {
  BuilderReportEntity,
  BuildRunEntity,
  TechnicalFeedbackItem,
} from "../shared/types";
import styles from "./DeliveryReportView.module.css";

interface DeliveryReportViewProps {
  run: BuildRunEntity;
  deliveryVersion?: number;
}

function parseReport(report: BuilderReportEntity | null | undefined): BuilderReportEntity {
  return report ?? {};
}

const OUTCOME_CONFIG = {
  PASS: { label: "APTO", className: styles.pass },
  FAIL: { label: "NO APTO", className: styles.fail },
  PARTIAL: { label: "PARCIAL", className: styles.partial },
  UNKNOWN: { label: "SIN EVALUAR", className: styles.unknown },
};

const SEVERITY_LABELS: Record<string, string> = {
  high: "Alta",
  medium: "Media",
  low: "Baja",
};

function FeedbackAxis({
  title,
  items,
}: {
  title: string;
  items: TechnicalFeedbackItem[];
}): JSX.Element {
  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>{title}</h3>
      {items.length === 0 ? (
        <p className={styles.emptyState}>Sin hallazgos relevantes en este eje.</p>
      ) : (
        <div className={styles.feedbackList}>
          {items.map((item, index) => (
            <article key={`${title}-${index}`} className={styles.feedbackCard}>
              <div className={styles.feedbackHeader}>
                <strong>{item.title}</strong>
                <span className={`${styles.severityBadge} ${styles[`sev_${item.severity}`]}`}>
                  {SEVERITY_LABELS[item.severity] ?? item.severity}
                </span>
              </div>
              <p className={styles.feedbackDetail}>{item.detail}</p>
              {item.file ? (
                <div className={styles.feedbackLocation}>
                  {item.file}
                  {item.line ? `:${item.line}` : ""}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export function DeliveryReportView({
  run,
  deliveryVersion,
}: DeliveryReportViewProps): JSX.Element {
  const report = parseReport(run.report);
  const outcome =
    report.overallOutcome ??
    (run.status === "SUCCESS"
      ? "PASS"
      : run.status === "FAILED"
        ? "FAIL"
        : "UNKNOWN");
  const outcomeConfig = OUTCOME_CONFIG[outcome] ?? OUTCOME_CONFIG.UNKNOWN;
  const finishedAt = run.finishedAt
    ? new Date(run.finishedAt).toLocaleString("es-ES")
    : "—";
  const selfHealing = report.selfHealing;
  const technicalFeedback = report.technicalFeedback ?? {
    security: [],
    architecture: [],
    quality: [],
  };

  return (
    <div className={styles.report}>
      <div className={`${styles.banner} ${outcomeConfig.className}`}>
        <div>
          <div className={styles.bannerLabel}>{outcomeConfig.label}</div>
          <div className={styles.bannerMeta}>
            {deliveryVersion ? `Entrega v${deliveryVersion} · ` : ""}
            {finishedAt}
            {run.failureReason ? ` · ${run.failureReason}` : ""}
          </div>
        </div>
      </div>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Resumen del run</h3>
        <div className={styles.summaryGrid}>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>Tipo</span>
            <strong>{run.llmAssessment?.structuralType ?? "—"}</strong>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>Estado evaluativo</span>
            <strong>{run.llmAssessment?.evaluativeState ?? "—"}</strong>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>Confianza</span>
            <strong>{run.llmAssessment?.confidence ?? "—"}</strong>
          </div>
        </div>
      </section>

      {selfHealing ? (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Autocorrección aplicada</h3>
          <div className={styles.selfHealingBox}>
            <div className={styles.selfHealingStatus}>
              <span
                className={`${styles.healPill} ${
                  selfHealing.recovered ? styles.healRecovered : styles.healPending
                }`}
              >
                {selfHealing.recovered ? "Recuperado" : selfHealing.attempted ? "Intentado" : "No necesario"}
              </span>
              <span className={styles.selfHealingAttempts}>
                {selfHealing.attemptsUsed} intento{selfHealing.attemptsUsed === 1 ? "" : "s"}
              </span>
            </div>
            <p className={styles.selfHealingSummary}>{selfHealing.summary}</p>
          </div>
        </section>
      ) : null}

      {report.llmRecommendations && report.llmRecommendations.length > 0 ? (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Recomendaciones</h3>
          <ul className={styles.recList}>
            {report.llmRecommendations.map((recommendation, index) => (
              <li key={index}>{recommendation}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <FeedbackAxis title="Seguridad" items={technicalFeedback.security} />
      <FeedbackAxis title="Arquitectura" items={technicalFeedback.architecture} />
      <FeedbackAxis title="Calidad" items={technicalFeedback.quality} />

      {run.warnings.length > 0 ? (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Avisos del pipeline</h3>
          <ul className={styles.warnList}>
            {run.warnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {report.readableText ? (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Informe textual</h3>
          <pre className={styles.readableText}>{report.readableText}</pre>
        </section>
      ) : null}
    </div>
  );
}
