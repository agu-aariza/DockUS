/**
 * @fileoverview Vista y componentes del motor Builder de evaluación (QualityInsightsDashboard).
 *
 * @module QualityInsightsDashboard
 */

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  RiArrowRightUpLine,
  RiBarChartFill,
  RiCodeBoxFill,
  RiErrorWarningFill,
  RiFileTextLine,
  RiFolderChartLine,
  RiLayoutMasonryFill,
  RiShieldFlashFill,
  RiTeamFill,
  RiUserLine,
} from "react-icons/ri";

import { projectsApi } from "../../shared/api/services";
import { queryKeys } from "../../shared/query/queryKeys";
import { Card } from "../../shared/components/ui/Layout";
import { Skeleton } from "../../shared/components/Skeleton";
import { StatusBadge, type StatusTone } from "../../shared/components/ui/StatusBadge";
import type { TeacherDeliveryDetailTab } from "../../deliveries/teacherReviewNavigation";
import type { ProjectQualityInsightsResponse, ProjectStudentQualityInsightsResponse } from "../../features/projects/types";
import type { QualityInsightCategory } from "../../features/builder/types";

interface QualityInsightsStudentOption {
  studentId: string;
  studentName: string;
  studentEmail: string;
}

interface QualityInsightsDashboardApi {
  getQualityInsights: (
    projectId: string,
  ) => Promise<ProjectQualityInsightsResponse>;
  getQualityInsightsByCategory: (
    projectId: string,
    category: QualityInsightCategory,
  ) => Promise<ProjectQualityInsightsResponse>;
  getQualityInsightsForStudent: (
    projectId: string,
    studentId: string,
  ) => Promise<ProjectStudentQualityInsightsResponse>;
}

interface QualityInsightsDashboardProps {
  projectId: string;
  students: QualityInsightsStudentOption[];
  api?: QualityInsightsDashboardApi;
  reviewTargets?: Record<
    string,
    {
      assignmentId: string;
      deliveryId: string;
    }
  >;
  onOpenStudentReview?: (
    studentId: string,
    tab?: TeacherDeliveryDetailTab,
  ) => void;
}

const CATEGORY_OPTIONS: Array<"all" | QualityInsightCategory> = [
  "all",
  "security",
  "architecture",
  "quality",
  "rubricCompliance",
];

const CATEGORY_LABELS: Record<"all" | QualityInsightCategory, string> = {
  all: "Todo",
  security: "Seguridad",
  architecture: "Arquitectura",
  quality: "Calidad",
  rubricCompliance: "Rubrica",
};

const defaultApi: QualityInsightsDashboardApi = {
  getQualityInsights: (projectId) => projectsApi.getQualityInsights(projectId),
  getQualityInsightsByCategory: (projectId, category) =>
    projectsApi.getQualityInsightsByCategory(projectId, category),
  getQualityInsightsForStudent: (projectId, studentId) =>
    projectsApi.getQualityInsightsForStudent(projectId, studentId),
};

function getCategoryIcon(category: QualityInsightCategory) {
  switch (category) {
    case "security":
      return <RiShieldFlashFill className="text-rose-500" />;
    case "architecture":
      return <RiLayoutMasonryFill className="text-primary" />;
    case "quality":
      return <RiCodeBoxFill className="text-success-500" />;
    default:
      return <RiErrorWarningFill className="text-warning" />;
  }
}

function getBadgeVariant(studentCount: number, totalStudents: number): StatusTone {
  if (totalStudents <= 0) {
    return "success";
  }

  if (studentCount > totalStudents / 2) {
    return "danger";
  }

  if (studentCount > totalStudents / 4) {
    return "warning";
  }

  return "success";
}

export function QualityInsightsDashboard({
  projectId,
  students,
  api = defaultApi,
  reviewTargets = {},
  onOpenStudentReview,
}: QualityInsightsDashboardProps) {
  const [category, setCategory] = useState<"all" | QualityInsightCategory>("all");
  const [selectedStudentId, setSelectedStudentId] = useState("");

  useEffect(() => {
    if (!students.length) {
      setSelectedStudentId("");
      return;
    }

    setSelectedStudentId((current) =>
      students.some((student) => student.studentId === current)
        ? current
        : students[0]?.studentId ?? "",
    );
  }, [students]);

  const summaryQuery = useQuery({
    queryKey:
      category === "all"
        ? queryKeys.projects.qualityInsights(projectId)
        : queryKeys.projects.qualityInsightsByCategory(projectId, category),
    queryFn: () =>
      category === "all"
        ? api.getQualityInsights(projectId)
        : api.getQualityInsightsByCategory(projectId, category),
    enabled: !!projectId.trim(),
  });
  const summary = summaryQuery.data ?? null;
  // Guardado con !!projectId.trim(): una query enabled:false se queda en
  // "pending" para siempre, y el original mostraba loading:false (no
  // skeleton) cuando aún no hay proyecto.
  const loading = !!projectId.trim() && summaryQuery.isPending;

  useEffect(() => {
    if (summaryQuery.isError) console.error("quality insights summary", summaryQuery.error);
  }, [summaryQuery.isError, summaryQuery.error]);

  const studentDetailsQuery = useQuery({
    queryKey: queryKeys.projects.qualityInsightsForStudent(projectId, selectedStudentId),
    queryFn: () => api.getQualityInsightsForStudent(projectId, selectedStudentId),
    enabled: !!projectId.trim() && !!selectedStudentId,
  });
  const studentDetails = studentDetailsQuery.data ?? null;
  const studentLoading =
    !!projectId.trim() && !!selectedStudentId && studentDetailsQuery.isPending;

  useEffect(() => {
    if (studentDetailsQuery.isError) console.error("quality insights student", studentDetailsQuery.error);
  }, [studentDetailsQuery.isError, studentDetailsQuery.error]);

  const selectedStudent = useMemo(
    () => students.find((student) => student.studentId === selectedStudentId) ?? null,
    [selectedStudentId, students],
  );
  const selectedStudentReviewTarget = selectedStudentId
    ? reviewTargets[selectedStudentId] ?? null
    : null;

  const detectionTotals = useMemo(() => {
    const totals: Record<QualityInsightCategory, number> = {
      security: 0,
      architecture: 0,
      quality: 0,
      rubricCompliance: 0,
    };

    summary?.insights.forEach((insight) => {
      totals[insight.category] += insight.studentCount;
    });

    return totals;
  }, [summary]);

  const studentFindingTotals = useMemo(() => {
    if (!studentDetails) {
      return {
        security: 0,
        architecture: 0,
        quality: 0,
        rubricCompliance: 0,
      };
    }

    return {
      security: studentDetails.findings.security.length,
      architecture: studentDetails.findings.architecture.length,
      quality: studentDetails.findings.quality.length,
      rubricCompliance: studentDetails.findings.rubricCompliance.length,
    };
  }, [studentDetails]);

  if (loading) {
    // Mismo grid de dos tarjetas rounded-3xl que el contenido cargado, en vez
    // de un spinner centrado, para que el dashboard no cambie de forma al
    // llegar los datos (FE-MED-03).
    return (
      <div
        className="grid grid-cols-1 gap-6 xl:grid-cols-[1.25fr_1fr]"
        aria-busy="true"
        aria-label="Analizando patrones de calidad del proyecto"
      >
        <div className="rounded-3xl bg-slate-900 p-8 shadow-xl">
          {/* Tarjeta oscura fija (sin dark:): el shimmer se compone a mano en
              vez de reusar <Skeleton>, cuyo bg-slate-200/80 por defecto
              quedaría invisible sobre bg-slate-900. */}
          <div className="shimmer h-3 w-32 rounded bg-slate-700/60" />
          <div className="shimmer mt-6 h-12 w-40 rounded bg-slate-700/60" />
          <div className="shimmer mt-4 h-3 w-full rounded bg-slate-700/60" />
          <div className="shimmer mt-2 h-3 w-2/3 rounded bg-slate-700/60" />
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <Skeleton type="text" className="h-4 w-48" />
          <div className="mt-6 space-y-4">
            <Skeleton type="text" className="h-3 w-full" />
            <Skeleton type="text" className="h-3 w-full" />
            <Skeleton type="text" className="h-3 w-2/3" />
          </div>
        </div>
      </div>
    );
  }

  if (!summary || summary.totalStudentsAnalyzed === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center text-sm text-slate-500">
        Aun no hay hallazgos de calidad agregados para este proyecto.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.25fr_1fr]">
        <div className="relative overflow-hidden rounded-3xl bg-slate-900 p-8 text-white shadow-xl">
          <div className="absolute -right-8 -top-8 text-9xl opacity-10">
            <RiTeamFill />
          </div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Resumen de Calidad
          </div>
          <div className="mt-6 flex items-baseline gap-2">
            <span className="text-6xl font-bold tracking-tight leading-none">
              {summary.totalStudentsAnalyzed}
            </span>
            <span className="text-xl font-bold text-slate-400">
              alumnos analizados
            </span>
          </div>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-400">
            Patrones agregados a partir de los últimos hallazgos LLM persistidos
            por alumno en este proyecto.
          </p>
        </div>

        <div className="rounded-3xl border border-app-border bg-app-surface p-8 shadow-sm">
          <div className="mb-6 flex items-center gap-2">
            <RiBarChartFill className="text-accent text-xl" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-app-text-muted">
              Distribución de Hallazgos
            </span>
          </div>
          <div className="space-y-4">
            {(CATEGORY_OPTIONS.filter(
              (option): option is QualityInsightCategory => option !== "all",
            )).map((currentCategory) => {
              const count = detectionTotals[currentCategory];
              const percentage =
                summary.totalStudentsAnalyzed > 0
                  ? Math.round((count / summary.totalStudentsAnalyzed) * 100)
                  : 0;

              return (
                <div key={currentCategory} className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-app-text">
                    <span>{CATEGORY_LABELS[currentCategory]}</span>
                    <span className="data-figure text-app-text-secondary">
                      {count} ({percentage}%)
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-app-bg-subtle">
                    <div
                      className="h-full bg-accent transition-all duration-300"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {CATEGORY_OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setCategory(option)}
            className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${
              category === option
                ? "bg-accent text-white shadow-sm"
                : "bg-app-surface text-app-text-secondary ring-1 ring-app-border hover:text-app-text hover:bg-app-bg-subtle"
            }`}
          >
            {CATEGORY_LABELS[option]}
          </button>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        <Card title="Patrones Detectados en Clase" className="overflow-hidden rounded-3xl">
          <div className="divide-y divide-app-border">
            {summary.insights.length === 0 ? (
              <div className="py-12 text-center italic text-app-text-muted">
                No se han detectado patrones significativos para este filtro.
              </div>
            ) : (
              summary.insights.slice(0, 10).map((insight, index) => (
                <div
                  key={`${insight.title}-${index}`}
                  className="group flex items-center justify-between rounded-2xl px-2 py-5 transition-colors hover:bg-app-bg-subtle/50"
                >
                  <div className="flex items-center gap-5">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-app-bg-subtle transition-colors duration-150 motion-reduce:transition-none group-hover:bg-primary/10 group-hover:text-primary">
                      {getCategoryIcon(insight.category)}
                    </div>
                    <div>
                      <div className="text-base font-bold text-app-text transition-colors group-hover:text-primary">
                        {insight.title}
                      </div>
                      <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-app-text-muted">
                        {CATEGORY_LABELS[insight.category]} · {insight.severity}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="flex flex-col items-end">
                      <span className="text-2xl font-bold leading-none tracking-tighter text-app-text">
                        {insight.studentCount}
                      </span>
                      <span className="mt-1 text-[10px] font-bold uppercase tracking-wider text-app-text-muted">
                        Alumnos
                      </span>
                    </div>
                    <div className="h-10 w-px bg-app-border" />
                    <div className="min-w-[4.5rem] text-right">
                      <StatusBadge
                        tone={getBadgeVariant(
                          insight.studentCount,
                          summary.totalStudentsAnalyzed,
                        )}
                      >
                        {Math.round(
                          (insight.studentCount / summary.totalStudentsAnalyzed) *
                            100,
                        )}
                        %
                      </StatusBadge>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card
          title="Detalle por Alumno"
          className="overflow-hidden rounded-3xl border border-app-border"
        >
          <div className="space-y-5">
            <div className="space-y-2">
              <label
                htmlFor="quality-insights-student-select"
                className="text-[10px] font-semibold uppercase tracking-wider text-app-text-muted"
              >
                Alumno
              </label>
              <select
                id="quality-insights-student-select"
                className="input-field bg-app-surface text-app-text border-app-border"
                value={selectedStudentId}
                onChange={(event) => setSelectedStudentId(event.target.value)}
                disabled={!students.length}
              >
                {!students.length ? (
                  <option value="">Sin alumnos</option>
                ) : null}
                {students.map((student) => (
                  <option key={student.studentId} value={student.studentId}>
                    {student.studentName} · {student.studentEmail}
                  </option>
                ))}
              </select>
            </div>

            {selectedStudent ? (
              <div className="rounded-2xl bg-app-bg-subtle p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-app-surface text-app-text-secondary shadow-sm">
                    <RiUserLine />
                  </div>
                  <div>
                    <div className="font-bold text-app-text">
                      {selectedStudent.studentName}
                    </div>
                    <div className="text-sm text-app-text-secondary">
                      {selectedStudent.studentEmail}
                    </div>
                  </div>
                </div>
                {selectedStudentReviewTarget && onOpenStudentReview ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 rounded-full border border-app-border bg-app-surface px-3 py-2 text-xs font-semibold uppercase tracking-wider text-app-text-secondary transition hover:border-primary/30 hover:text-primary"
                      onClick={() => onOpenStudentReview(selectedStudent.studentId, "report")}
                    >
                      <RiFileTextLine />
                      Informe técnico
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 rounded-full border border-app-border bg-app-surface px-3 py-2 text-xs font-semibold uppercase tracking-wider text-app-text-secondary transition hover:border-accent/30 hover:text-accent"
                      onClick={() => onOpenStudentReview(selectedStudent.studentId, "grading")}
                    >
                      <RiFolderChartLine />
                      Revisión docente
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}

            {studentLoading ? (
              // Misma cuadrícula 2x2 de categorías que el contenido cargado
              // (FE-MED-03).
              <div className="space-y-4" aria-busy="true" aria-label="Cargando hallazgos individuales">
                <div className="grid grid-cols-2 gap-3">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="rounded-2xl border border-app-border bg-app-surface p-3">
                      <Skeleton type="text" className="h-2.5 w-16" />
                      <Skeleton type="text" className="mt-2 h-6 w-10" />
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <Skeleton key={index} type="rounded" className="h-12 w-full" />
                  ))}
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  {(CATEGORY_OPTIONS.filter(
                    (option): option is QualityInsightCategory => option !== "all",
                  )).map((currentCategory) => (
                    <div
                      key={currentCategory}
                      className="rounded-2xl border border-app-border bg-app-surface p-3"
                    >
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-app-text-muted">
                        {CATEGORY_LABELS[currentCategory]}
                      </div>
                      <div className="mt-2 text-2xl font-bold tracking-tight text-app-text">
                        {studentFindingTotals[currentCategory]}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-4">
                  {(CATEGORY_OPTIONS.filter(
                    (option): option is QualityInsightCategory => option !== "all",
                  )).map((currentCategory) => {
                    const findings = studentDetails?.findings[currentCategory] ?? [];

                    return (
                      <div key={currentCategory} className="space-y-3">
                        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                          {getCategoryIcon(currentCategory)}
                          {CATEGORY_LABELS[currentCategory]}
                        </div>
                        {findings.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-400">
                            Sin hallazgos en esta categoria.
                          </div>
                        ) : (
                          findings.slice(0, 3).map((finding, index) => (
                            <div
                              key={`${currentCategory}-${finding.title}-${index}`}
                              className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                            >
                              <div className="flex items-center justify-between gap-4">
                                <div className="font-semibold text-slate-900">
                                  {finding.title}
                                </div>
                                <StatusBadge
                                  tone={
                                    finding.severity === "high"
                                      ? "danger"
                                      : finding.severity === "medium"
                                        ? "warning"
                                        : "success"
                                  }
                                >
                                  {finding.severity}
                                </StatusBadge>
                              </div>
                              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                                {finding.detail}
                              </p>
                              {finding.file || typeof finding.line === "number" ? (
                                <div className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                                  {[finding.file, finding.line ? `linea ${finding.line}` : null]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </div>
                              ) : null}
                            </div>
                          ))
                        )}
                      </div>
                    );
                  })}
                </div>
                {selectedStudentReviewTarget && onOpenStudentReview ? (
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-700 transition hover:border-primary/30 hover:text-primary"
                    onClick={() => onOpenStudentReview(selectedStudentId, "report")}
                  >
                    <RiArrowRightUpLine />
                    Abrir revisión exacta de la entrega
                  </button>
                ) : null}
              </>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
