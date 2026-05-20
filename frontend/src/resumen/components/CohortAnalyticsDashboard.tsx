import { useEffect, useState } from "react";
import {
  RiPercentLine,
  RiFileList3Line,
  RiAlertLine,
  RiBarChartGroupedLine,
  RiLoader4Line,
  RiFolderOpenLine,
  RiInformationLine,
  RiShieldCheckLine,
} from "react-icons/ri";
import { projectsApi } from "../../shared/api/services";
import type { ProjectEntity, ProjectProgressSummary, ProjectQualityInsight } from "../../shared/types";

interface CohortAnalyticsDashboardProps {
  initialProjectId: string | null;
  projects: ProjectEntity[];
  onSelectProject?: (projectId: string) => void;
}

export function CohortAnalyticsDashboard({
  initialProjectId,
  projects,
  onSelectProject,
}: CohortAnalyticsDashboardProps): JSX.Element {
  const [selectedId, setSelectedId] = useState<string | null>(initialProjectId);
  const [summary, setSummary] = useState<ProjectProgressSummary | null>(null);
  const [insights, setInsights] = useState<ProjectQualityInsight[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync selectedId when initialProjectId changes
  useEffect(() => {
    if (initialProjectId) {
      setSelectedId(initialProjectId);
    } else if (projects.length > 0 && !selectedId) {
      setSelectedId(projects[0].id);
    }
  }, [initialProjectId, projects]);

  useEffect(() => {
    if (!selectedId) {
      setSummary(null);
      setInsights([]);
      return;
    }

    let active = true;
    async function loadStats() {
      setLoading(true);
      setError(null);
      try {
        const [sumRes, insRes] = await Promise.all([
          projectsApi.progressSummary(selectedId!).catch(() => null),
          projectsApi.getQualityInsights(selectedId!).catch(() => null),
        ]);

        if (!active) return;

        setSummary(sumRes);
        setInsights(insRes?.insights || []);
      } catch (err) {
        if (active) {
          setError("Error al cargar los datos analíticos del proyecto.");
          console.error(err);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadStats();
    return () => {
      active = false;
    };
  }, [selectedId]);

  const handleProjectChange = (id: string) => {
    setSelectedId(id);
    if (onSelectProject) {
      onSelectProject(id);
    }
  };

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-academic-surface-container/30 rounded-3xl border border-dashed border-academic-outline-variant/60 text-center">
        <RiFolderOpenLine className="text-4xl text-academic-outline-variant mb-2" />
        <p className="text-sm font-semibold text-academic-on-surface-variant">
          No hay proyectos activos para mostrar análisis de cohortes.
        </p>
      </div>
    );
  }

  // Calculate metrics based on real data
  const gradedStudents = summary?.perStudent.filter((s) => s.grade !== null) || [];
  const passCount = gradedStudents.filter((s) => s.grade! >= 5.0).length;

  const hasGrades = gradedStudents.length > 0;

  const passRateVal = hasGrades
    ? Math.round((passCount / gradedStudents.length) * 100)
    : summary && summary.deliveredAtLeastOnce > 0
      ? Math.round((summary.passedAllTests / summary.deliveredAtLeastOnce) * 100)
      : 0;

  const avgGradeVal = hasGrades
    ? (gradedStudents.reduce((sum, s) => sum + s.grade!, 0) / gradedStudents.length).toFixed(2)
    : null;

  const totalDeliveriesVal = summary?.perStudent.reduce((sum, s) => sum + s.deliveryCount, 0) || 0;
  const criticalBuildFailuresVal = summary?.perStudent.filter((s) => s.latestBuilderOutcome === "FAIL").length || 0;

  const metrics = [
    {
      label: hasGrades ? "Tasa de Aprobados" : "Tasa Éxito Tests",
      value: `${passRateVal}%`,
      icon: <RiPercentLine />,
      color: "text-emerald-600 bg-emerald-50 border-emerald-100",
    },
    {
      label: "Nota Media Global",
      value: avgGradeVal !== null ? avgGradeVal : "—",
      icon: <RiBarChartGroupedLine />,
      color: "text-brand-gold-dark bg-brand-gold/[0.04] border-brand-gold/20",
    },
    {
      label: "Total Entregas",
      value: String(totalDeliveriesVal),
      icon: <RiFileList3Line />,
      color: "text-brand-blue-dark bg-brand-blue/5 border-brand-blue/10",
    },
    {
      label: "Entregas con Test Fallido",
      value: String(criticalBuildFailuresVal),
      icon: <RiAlertLine />,
      color: "text-rose-600 bg-rose-50 border-rose-100",
    },
  ];

  // Distribute distribution buckets
  let distribution: Array<{ label: string; count: number; percent: number; color: string }> = [];
  if (summary) {
    if (hasGrades) {
      const totalGraded = gradedStudents.length;
      const sobresalientes = gradedStudents.filter((s) => s.grade! >= 9.0).length;
      const notables = gradedStudents.filter((s) => s.grade! >= 7.0 && s.grade! < 9.0).length;
      const aprobados = gradedStudents.filter((s) => s.grade! >= 5.0 && s.grade! < 7.0).length;
      const suspensos = gradedStudents.filter((s) => s.grade! < 5.0).length;

      distribution = [
        { label: "Sobresaliente [9.0 - 10.0]", count: sobresalientes, percent: totalGraded ? Math.round((sobresalientes / totalGraded) * 100) : 0, color: "bg-emerald-500" },
        { label: "Notable [7.0 - 8.9]", count: notables, percent: totalGraded ? Math.round((notables / totalGraded) * 100) : 0, color: "bg-brand-blue" },
        { label: "Aprobado [5.0 - 6.9]", count: aprobados, percent: totalGraded ? Math.round((aprobados / totalGraded) * 100) : 0, color: "bg-brand-gold" },
        { label: "Suspenso [0.0 - 4.9]", count: suspensos, percent: totalGraded ? Math.round((suspensos / totalGraded) * 100) : 0, color: "bg-rose-500" },
      ];
    } else {
      const totalStudents = summary.totalAssignments;
      distribution = [
        { label: "Pasan todos los tests", count: summary.passedAllTests, percent: totalStudents ? Math.round((summary.passedAllTests / totalStudents) * 100) : 0, color: "bg-emerald-500" },
        { label: "Entregas con tests fallidos", count: summary.deliveredAtLeastOnce - summary.passedAllTests, percent: totalStudents ? Math.round(((summary.deliveredAtLeastOnce - summary.passedAllTests) / totalStudents) * 100) : 0, color: "bg-rose-500" },
        { label: "Sin entregas aún", count: summary.neverDelivered, percent: totalStudents ? Math.round((summary.neverDelivered / totalStudents) * 100) : 0, color: "bg-academic-outline-variant" },
      ];
    }
  }

  return (
    <section className="space-y-6">
      {/* Project Selector & Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-academic-surface border border-academic-outline-variant/60 rounded-3xl p-4">
        <div className="flex items-center gap-2">
          <RiInformationLine className="text-brand-blue text-xl shrink-0" />
          <span className="text-xs font-bold text-academic-on-surface-variant">
            Visualizando métricas en tiempo real para:
          </span>
        </div>
        <select
          value={selectedId || ""}
          onChange={(e) => handleProjectChange(e.target.value)}
          className="w-full sm:w-72 rounded-xl border border-academic-outline/25 bg-white px-3 py-2 text-xs font-bold text-academic-on-surface focus:outline-none focus:ring-1 focus:ring-brand-blue"
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-brand-gold gap-2 bg-white rounded-3xl border border-academic-outline-variant/30 shadow-academic">
          <RiLoader4Line className="animate-spin text-3xl" />
          <span className="text-xs font-semibold text-academic-outline">
            Analizando cohorte del proyecto...
          </span>
        </div>
      ) : error ? (
        <div className="p-8 text-center text-rose-600 bg-rose-50 border border-rose-100 rounded-3xl font-semibold text-xs">
          {error}
        </div>
      ) : !summary ? (
        <div className="p-8 text-center text-academic-outline bg-academic-surface rounded-3xl border border-dashed text-xs">
          Selecciona un proyecto válido para cargar el resumen de cohorte.
        </div>
      ) : (
        <>
          {/* Top Cards Grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {metrics.map((m, idx) => (
              <article
                key={idx}
                className={`rounded-2xl border p-5 flex items-center justify-between bg-white shadow-academic ${m.color.split(" ").pop()}`}
              >
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-academic-outline">
                    {m.label}
                  </span>
                  <div className="mt-1 text-2xl font-black tracking-tight text-academic-on-surface">
                    {m.value}
                  </div>
                </div>
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl border text-xl ${m.color.split(" ").slice(0, 2).join(" ")}`}>
                  {m.icon}
                </div>
              </article>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Grade Distribution Histogram */}
            <article className="rounded-3xl border border-academic-outline-variant bg-white p-6 shadow-academic">
              <div className="mb-4">
                <h4 className="font-display font-bold text-base text-brand-maroon">
                  {hasGrades ? "Distribución de Calificaciones" : "Estado del Sandbox de Estudiantes"}
                </h4>
                <p className="text-xs text-academic-outline">
                  {hasGrades
                    ? "Muestra el número de alumnos por cada intervalo de notas en la cohorte activa."
                    : "Muestra el progreso técnico actual basado en los tests automatizados."}
                </p>
              </div>

              <div className="space-y-4">
                {distribution.map((d, idx) => (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold text-academic-on-surface-variant">
                      <span>{d.label}</span>
                      <span>
                        {d.count} alumnos ({d.percent}%)
                      </span>
                    </div>
                    <div className="h-3 w-full rounded-full bg-academic-surface border border-academic-outline-variant/60 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${d.color} transition-all duration-500`}
                        style={{ width: `${d.percent}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </article>

            {/* Technical Incidents & Failures */}
            <article className="rounded-3xl border border-academic-outline-variant bg-white p-6 shadow-academic">
              <div className="mb-4">
                <h4 className="font-display font-bold text-base text-brand-maroon">
                  Hallazgos de Calidad e Incidencias
                </h4>
                <p className="text-xs text-academic-outline">
                  Resumen de vulnerabilidades, deudas técnicas y fallos recurrentes detectados automáticamente.
                </p>
              </div>

              {insights.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 bg-academic-surface-container/20 rounded-2xl border border-dashed border-academic-outline-variant/30 text-center">
                  <RiShieldCheckLine className="text-3xl text-emerald-500 mb-2" />
                  <p className="text-xs font-semibold text-academic-on-surface-variant px-4">
                    ¡Excelente cohorte! No se han detectado incidencias de calidad ni vulnerabilidades de seguridad destacables.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar">
                  {insights.map((f, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded-xl border border-academic-outline-variant bg-academic-surface-container/20 p-3 hover:bg-academic-surface transition-colors"
                    >
                      <div className="min-w-0 pr-4">
                        <div className="text-xs font-bold text-academic-on-surface truncate">
                          {f.title}
                        </div>
                        <div className="text-[10px] font-mono text-academic-outline mt-0.5">
                          {f.category.toUpperCase()}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs font-semibold text-academic-on-surface-variant">
                          {f.studentCount} alumnos
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                            f.severity === "high"
                              ? "bg-rose-50 text-rose-700 border border-rose-100"
                              : f.severity === "medium"
                                ? "bg-brand-gold/10 text-brand-gold-dark border border-brand-gold/20"
                                : "bg-brand-blue/5 text-brand-blue border border-brand-blue/10"
                          }`}
                        >
                          {f.severity === "high" ? "alta" : f.severity === "medium" ? "media" : "baja"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </article>
          </div>
        </>
      )}
    </section>
  );
}
