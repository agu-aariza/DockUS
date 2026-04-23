import { useEffect, useState } from "react";
import { projectsApi } from "../shared/api/services";
import type {
  ProjectEntity,
  ProjectProgressSummary,
  SessionRecord,
} from "../shared/types";
import { getErrorMessage } from "../shared/utils/errors";
import styles from "./ProgressDashboard.module.css";

interface ProgressDashboardProps {
  session: SessionRecord | null;
  projectOptions?: ProjectEntity[];
  selectedProjectId?: string;
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Borrador",
  SUBMITTED: "Enviada",
  IN_REVIEW: "En revisión",
  EVALUATED: "Evaluada",
};

const STATUS_COLOR: Record<string, string> = {
  DRAFT: "#64748b",
  SUBMITTED: "#6366f1",
  IN_REVIEW: "#f59e0b",
  EVALUATED: "#22c55e",
};

function StatCard({
  icon,
  value,
  label,
  accent,
}: {
  icon: string;
  value: number;
  label: string;
  accent: string;
}) {
  return (
    <div className={styles.statCard} style={{ borderTopColor: accent }}>
      <span className={styles.statIcon}>{icon}</span>
      <div className={styles.statValue}>{value}</div>
      <div className={styles.statLabel}>{label}</div>
    </div>
  );
}

export function ProgressDashboard({
  session,
  projectOptions = [],
  selectedProjectId = "",
}: ProgressDashboardProps): JSX.Element {
  const [projectId, setProjectId] = useState(selectedProjectId);
  const [summary, setSummary] = useState<ProjectProgressSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const canUse = Boolean(session);

  useEffect(() => {
    if (selectedProjectId) {
      setProjectId(selectedProjectId);
    }
  }, [selectedProjectId]);

  const handleLoad = async () => {
    if (!projectId.trim() || !canUse) return;
    setLoading(true);
    setMessage("");
    try {
      const data = await projectsApi.progressSummary(projectId.trim());
      setSummary(data);
    } catch (err) {
      setMessage(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const delivered = summary?.deliveredAtLeastOnce ?? 0;
  const total = summary?.totalAssignments ?? 0;
  const rate = total > 0 ? Math.round((delivered / total) * 100) : 0;

  return (
    <section className={styles.container}>
      <header className={styles.header}>
        <h2 className={styles.title}>Dashboard de progreso</h2>
        <p className={styles.subtitle}>
          Resumen de entregas por proyecto para el profesor
        </p>
      </header>

      <div className={styles.searchBar}>
        {projectOptions.length > 0 ? (
          <select
            id="progress-project-id"
            className={styles.input}
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
          >
            <option value="">Selecciona un proyecto</option>
            {projectOptions.map((project) => (
              <option key={project.id} value={project.id}>
                {project.title}
              </option>
            ))}
          </select>
        ) : (
          <input
            id="progress-project-id"
            className={styles.input}
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            placeholder="UUID del proyecto…"
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleLoad();
            }}
          />
        )}
        <button
          id="progress-load-btn"
          className={styles.loadBtn}
          onClick={() => void handleLoad()}
          disabled={!canUse || loading || !projectId.trim()}
        >
          {loading ? "Cargando…" : "Cargar resumen"}
        </button>
      </div>

      {message && <p className={styles.error}>{message}</p>}

      {summary && (
        <div className={styles.content}>
          <div className={styles.statRow}>
            <StatCard
              icon="Al"
              value={summary.totalAssignments}
              label="Alumnos asignados"
              accent="#6366f1"
            />
            <StatCard
              icon="En"
              value={summary.deliveredAtLeastOnce}
              label="Entregaron ≥1 vez"
              accent="#22c55e"
            />
            <StatCard
              icon="Ok"
              value={summary.passedAllTests}
              label="Con entrega evaluada"
              accent="#0ea5e9"
            />
            <StatCard
              icon="0"
              value={summary.neverDelivered}
              label="Sin ninguna entrega"
              accent="#ef4444"
            />
          </div>

          <div className={styles.section}>
            <div className={styles.barLabel}>
              <span>Participación</span>
              <span className={styles.barPct}>{rate}%</span>
            </div>
            <div className={styles.barTrack}>
              <div
                className={styles.barFill}
                style={{ width: `${rate}%` }}
              />
            </div>
          </div>

          <div className={styles.section}>
            <h3 className={styles.tableTitle}>Detalle por alumno</h3>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Entregas</th>
                    <th>Último estado</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.perStudent.map((s) => (
                    <tr key={s.studentId}>
                      <td className={styles.emailCell}>{s.studentEmail}</td>
                      <td className={styles.countCell}>{s.deliveryCount}</td>
                      <td>
                        {s.latestStatus ? (
                          <span
                            className={styles.statusBadge}
                            style={{
                              background: `${STATUS_COLOR[s.latestStatus] ?? "#64748b"}22`,
                              borderColor: `${STATUS_COLOR[s.latestStatus] ?? "#64748b"}66`,
                              color: STATUS_COLOR[s.latestStatus] ?? "#94a3b8",
                            }}
                          >
                            {STATUS_LABEL[s.latestStatus] ?? s.latestStatus}
                          </span>
                        ) : (
                          <span className={styles.noDelivery}>Sin entregas</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
