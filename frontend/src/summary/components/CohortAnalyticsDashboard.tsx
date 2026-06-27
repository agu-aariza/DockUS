import { useEffect, useState } from "react";
import {
  RiPercentLine,
  RiFileList3Line,
  RiAlertLine,
  RiBarChartGroupedLine,
  RiLoader4Line,
  RiFolderOpenLine,
  RiShieldCheckLine,
} from "react-icons/ri";
import { projectsApi } from "../../shared/api/services";
import { MetricCard } from "../../shared/components/MetricCard";
import type { ProjectEntity, ProjectProgressSummary, ProjectQualityInsight } from "../../features/projects/types";

interface CohortAnalyticsDashboardProps {
  initialProjectId: string | null;
  projects: ProjectEntity[];
  onSelectProject?: (_projectId: string) => void;
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

  useEffect(() => {
    if (initialProjectId) {
      setSelectedId(initialProjectId);
    } else if (projects.length > 0 && !selectedId) {
      setSelectedId(projects[0].id);
    }
  }, [initialProjectId, projects, selectedId]);

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
    onSelectProject?.(id);
  };

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
        <RiFolderOpenLine className="mb-2 text-3xl text-slate-400" />
        <p className="text-sm font-medium text-slate-600">
          No hay proyectos activos para mostrar análisis de cohortes.
        </p>
      </div>
    );
  }

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
      variant: 'success' as const,
      helper: hasGrades ? `${passCount} de ${gradedStudents.length} alumnos` : `${summary?.passedAllTests ?? 0} éxitos`,
    },
    {
      label: "Nota Media Global",
      value: avgGradeVal !== null ? avgGradeVal : "—",
      icon: <RiBarChartGroupedLine />,
      variant: 'info' as const,
      helper: hasGrades ? "Promedio calificado" : "Sin notas disponibles",
    },
    {
      label: "Total Entregas",
      value: String(totalDeliveriesVal),
      icon: <RiFileList3Line />,
      variant: 'default' as const,
      helper: "Entregas registradas",
    },
    {
      label: "Tests Fallidos",
      value: String(criticalBuildFailuresVal),
      icon: <RiAlertLine />,
      variant: (criticalBuildFailuresVal > 0 ? 'warning' : 'default') as 'warning' | 'default',
      helper: "Última ejecución",
    },
  ];

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
        { label: "Notable [7.0 - 8.9]", count: notables, percent: totalGraded ? Math.round((notables / totalGraded) * 100) : 0, color: "bg-blue-500" },
        { label: "Aprobado [5.0 - 6.9]", count: aprobados, percent: totalGraded ? Math.round((aprobados / totalGraded) * 100) : 0, color: "bg-amber-500" },
        { label: "Suspenso [0.0 - 4.9]", count: suspensos, percent: totalGraded ? Math.round((suspensos / totalGraded) * 100) : 0, color: "bg-red-500" },
      ];
    } else {
      const totalStudents = summary.totalAssignments;
      distribution = [
        { label: "Pasan todos los tests", count: summary.passedAllTests, percent: totalStudents ? Math.round((summary.passedAllTests / totalStudents) * 100) : 0, color: "bg-emerald-500" },
        { label: "Tests fallidos", count: summary.deliveredAtLeastOnce - summary.passedAllTests, percent: totalStudents ? Math.round(((summary.deliveredAtLeastOnce - summary.passedAllTests) / totalStudents) * 100) : 0, color: "bg-red-500" },
        { label: "Sin entregas", count: summary.neverDelivered, percent: totalStudents ? Math.round((summary.neverDelivered / totalStudents) * 100) : 0, color: "bg-slate-300" },
      ];
    }
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 rounded-lg border border-app-border bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-xs font-medium text-slate-500">
          Métricas de cohorte para:
        </span>
        <select
          value={selectedId || ""}
          onChange={(e) => handleProjectChange(e.target.value)}
          className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 sm:w-72"
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-app-border bg-white py-12">
          <RiLoader4Line className="animate-spin text-2xl text-primary" />
          <span className="text-sm text-slate-500">Analizando cohorte...</span>
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center text-sm text-red-700">
          {error}
        </div>
      ) : !summary ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
          Selecciona un proyecto válido para cargar el resumen de cohorte.
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {metrics.map((m, idx) => (
              <MetricCard
                key={idx}
                label={m.label}
                value={m.value}
                icon={m.icon}
                variant={m.variant}
                helper={m.helper}
              />
            ))}
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <article className="rounded-lg border border-app-border bg-white p-4">
              <h4 className="text-sm font-semibold text-slate-900">
                {hasGrades ? "Distribución de Calificaciones" : "Estado de Entregas"}
              </h4>
              <p className="text-xs text-slate-500">
                {hasGrades
                  ? "Alumnos por intervalo de notas en la cohorte activa."
                  : "Progreso técnico basado en tests automatizados."}
              </p>
              <div className="mt-4 space-y-3">
                {distribution.map((d, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-medium text-slate-700">
                      <span>{d.label}</span>
                      <span className="text-slate-500">{d.count} ({d.percent}%)</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full ${d.color} transition-all duration-500`}
                        style={{ width: `${d.percent}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-lg border border-app-border bg-white p-4">
              <h4 className="text-sm font-semibold text-slate-900">Hallazgos de Calidad</h4>
              <p className="text-xs text-slate-500">
                Incidencias detectadas automáticamente en el proyecto.
              </p>
              {insights.length === 0 ? (
                <div className="mt-4 flex flex-col items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-50 py-8 text-center">
                  <RiShieldCheckLine className="mb-2 text-2xl text-emerald-500" />
                  <p className="px-4 text-xs font-medium text-slate-600">
                    No se han detectado incidencias de calidad destacables.
                  </p>
                </div>
              ) : (
                <div className="mt-4 max-h-[220px] space-y-2 overflow-y-auto pr-1 custom-scrollbar">
                  {insights.map((f, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded-md border border-app-border bg-slate-50 p-3 transition-colors hover:bg-slate-100"
                    >
                      <div className="min-w-0 pr-4">
                        <div className="truncate text-xs font-semibold text-slate-900">
                          {f.title}
                        </div>
                        <div className="text-[10px] uppercase tracking-wider text-slate-400">
                          {f.category}
                        </div>
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
