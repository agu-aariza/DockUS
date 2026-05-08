import { useEffect, useMemo, useState } from "react";
import {
  RiBarChartFill,
  RiCodeBoxFill,
  RiErrorWarningFill,
  RiLayoutMasonryFill,
  RiLoader4Line,
  RiShieldFlashFill,
  RiTeamFill,
  RiUserLine,
} from "react-icons/ri";

import { projectsApi } from "../../shared/api/services";
import { Badge, Card } from "../../shared/components/ui/Layout";
import type {
  ProjectQualityInsightsResponse,
  ProjectStudentQualityInsightsResponse,
  QualityInsightCategory,
} from "../../shared/types";

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
      return <RiLayoutMasonryFill className="text-brand-blue" />;
    case "quality":
      return <RiCodeBoxFill className="text-emerald-500" />;
    default:
      return <RiErrorWarningFill className="text-brand-gold" />;
  }
}

function getBadgeVariant(studentCount: number, totalStudents: number) {
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
}: QualityInsightsDashboardProps) {
  const [category, setCategory] = useState<"all" | QualityInsightCategory>("all");
  const [summary, setSummary] = useState<ProjectQualityInsightsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [studentDetails, setStudentDetails] =
    useState<ProjectStudentQualityInsightsResponse | null>(null);
  const [studentLoading, setStudentLoading] = useState(false);

  useEffect(() => {
    if (!students.length) {
      setSelectedStudentId("");
      setStudentDetails(null);
      return;
    }

    setSelectedStudentId((current) =>
      students.some((student) => student.studentId === current)
        ? current
        : students[0]?.studentId ?? "",
    );
  }, [students]);

  useEffect(() => {
    if (!projectId.trim()) {
      setSummary(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const request =
      category === "all"
        ? api.getQualityInsights(projectId)
        : api.getQualityInsightsByCategory(projectId, category);

    request
      .then((data) => {
        if (!cancelled) {
          setSummary(data);
        }
      })
      .catch((error) => {
        console.error("quality insights summary", error);
        if (!cancelled) {
          setSummary(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [api, category, projectId]);

  useEffect(() => {
    if (!projectId.trim() || !selectedStudentId) {
      setStudentDetails(null);
      setStudentLoading(false);
      return;
    }

    let cancelled = false;
    setStudentLoading(true);

    api
      .getQualityInsightsForStudent(projectId, selectedStudentId)
      .then((data) => {
        if (!cancelled) {
          setStudentDetails(data);
        }
      })
      .catch((error) => {
        console.error("quality insights student", error);
        if (!cancelled) {
          setStudentDetails(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setStudentLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [api, projectId, selectedStudentId]);

  const selectedStudent = useMemo(
    () => students.find((student) => student.studentId === selectedStudentId) ?? null,
    [selectedStudentId, students],
  );

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
    return (
      <div className="flex items-center justify-center gap-3 rounded-3xl border border-slate-200 bg-white px-6 py-12 text-slate-500 shadow-sm">
        <RiLoader4Line className="animate-spin text-xl text-brand-blue" />
        Analizando patrones de calidad del proyecto...
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
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.25fr_1fr]">
        <div className="relative overflow-hidden rounded-3xl bg-slate-900 p-8 text-white shadow-xl">
          <div className="absolute -right-8 -top-8 text-9xl opacity-10">
            <RiTeamFill />
          </div>
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
            Resumen de Calidad
          </div>
          <div className="mt-6 flex items-baseline gap-2">
            <span className="text-6xl font-black tracking-tighter leading-none">
              {summary.totalStudentsAnalyzed}
            </span>
            <span className="text-xl font-bold text-slate-400">
              alumnos analizados
            </span>
          </div>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-400">
            Patrones agregados a partir de los ultimos hallazgos LLM persistidos
            por alumno en este proyecto.
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mb-6 flex items-center gap-2">
            <RiBarChartFill className="text-brand-maroon text-xl" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
              Distribucion de Hallazgos
            </span>
          </div>
          <div className="space-y-4">
            {(CATEGORY_OPTIONS.filter(
              (option): option is QualityInsightCategory => option !== "all",
            )).map((currentCategory) => {
              const count = detectionTotals[currentCategory];
              const percentage =
                summary.totalStudentsAnalyzed > 0
                  ? (count / Math.max(summary.totalStudentsAnalyzed, 1)) * 100
                  : 0;

              return (
                <div key={currentCategory} className="space-y-2">
                  <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <span>{CATEGORY_LABELS[currentCategory]}</span>
                    <span className="text-slate-900">{count} detecciones</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full transition-all duration-1000 ease-out ${
                        currentCategory === "security"
                          ? "bg-rose-500"
                          : currentCategory === "quality"
                            ? "bg-emerald-500"
                            : currentCategory === "architecture"
                              ? "bg-brand-blue"
                              : "bg-brand-gold"
                      }`}
                      style={{ width: `${Math.min(100, percentage)}%` }}
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
            className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.18em] transition-colors ${
              category === option
                ? "bg-brand-maroon text-white shadow-sm"
                : "bg-white text-slate-500 ring-1 ring-slate-200 hover:text-slate-900"
            }`}
          >
            {CATEGORY_LABELS[option]}
          </button>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        <Card title="Patrones Detectados en Clase" className="overflow-hidden rounded-3xl">
          <div className="divide-y divide-slate-100">
            {summary.insights.length === 0 ? (
              <div className="py-12 text-center italic text-slate-400">
                No se han detectado patrones significativos para este filtro.
              </div>
            ) : (
              summary.insights.slice(0, 10).map((insight, index) => (
                <div
                  key={`${insight.title}-${index}`}
                  className="group flex items-center justify-between rounded-2xl px-2 py-5 transition-colors hover:bg-slate-50/50"
                >
                  <div className="flex items-center gap-5">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 transition-all duration-300 group-hover:scale-110 group-hover:shadow-sm">
                      {getCategoryIcon(insight.category)}
                    </div>
                    <div>
                      <div className="text-base font-bold text-slate-900 transition-colors group-hover:text-brand-blue">
                        {insight.title}
                      </div>
                      <div className="mt-0.5 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                        {CATEGORY_LABELS[insight.category]} · {insight.severity}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="flex flex-col items-end">
                      <span className="text-2xl font-black leading-none tracking-tighter text-slate-900">
                        {insight.studentCount}
                      </span>
                      <span className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        Alumnos
                      </span>
                    </div>
                    <div className="h-10 w-px bg-slate-200" />
                    <div className="min-w-[4.5rem] text-right">
                      <Badge
                        variant={getBadgeVariant(
                          insight.studentCount,
                          summary.totalStudentsAnalyzed,
                        )}
                      >
                        {Math.round(
                          (insight.studentCount / summary.totalStudentsAnalyzed) *
                            100,
                        )}
                        %
                      </Badge>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card
          title="Detalle por Alumno"
          className="overflow-hidden rounded-3xl border border-slate-200"
        >
          <div className="space-y-5">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                Alumno
              </label>
              <select
                className="input-field bg-white"
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
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-slate-500 shadow-sm">
                    <RiUserLine />
                  </div>
                  <div>
                    <div className="font-bold text-slate-900">
                      {selectedStudent.studentName}
                    </div>
                    <div className="text-sm text-slate-500">
                      {selectedStudent.studentEmail}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {studentLoading ? (
              <div className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-5 text-sm text-slate-500">
                <RiLoader4Line className="animate-spin text-brand-blue" />
                Cargando hallazgos individuales...
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  {(CATEGORY_OPTIONS.filter(
                    (option): option is QualityInsightCategory => option !== "all",
                  )).map((currentCategory) => (
                    <div
                      key={currentCategory}
                      className="rounded-2xl border border-slate-200 bg-white p-3"
                    >
                      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                        {CATEGORY_LABELS[currentCategory]}
                      </div>
                      <div className="mt-2 text-2xl font-black tracking-tighter text-slate-900">
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
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
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
                                <Badge
                                  variant={
                                    finding.severity === "high"
                                      ? "danger"
                                      : finding.severity === "medium"
                                        ? "warning"
                                        : "success"
                                  }
                                >
                                  {finding.severity}
                                </Badge>
                              </div>
                              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                                {finding.detail}
                              </p>
                              {finding.file || typeof finding.line === "number" ? (
                                <div className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
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
              </>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
