import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { deliveriesApi, projectsApi } from "../shared/api/services";
import { CodePreviewModal } from "../shared/components/CodePreviewModal";
import {
  RiAwardLine,
  RiCheckboxCircleLine,
  RiCloseLine,
  RiCodeSSlashLine,
  RiDownload2Line,
  RiEyeLine,
  RiFileCodeLine,
  RiFilter3Line,
  RiHistoryLine,
  RiLoader4Line,
  RiSearchLine,
  RiStackLine,
  RiTeamLine,
  RiTimeLine,
  RiUserLine,
  RiUserSharedLine,
} from "react-icons/ri";
import type {
  BuilderOutcome,
  DeliveryEntity,
  DeliveryStatus,
  ProjectEntity,
  ProjectGradebookRow,
  ProjectProgressSummary,
  SessionRecord,
} from "../shared/types";
import { useToast } from "../shared/toast/ToastContext";
import { getErrorMessage } from "../shared/utils/errors";

interface ProgressDashboardProps {
  session: SessionRecord | null;
  projectOptions?: ProjectEntity[];
  selectedProjectId?: string;
  embedded?: boolean;
}

interface GroupOption {
  id: string;
  label: string;
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  IN_REVIEW: "In Review",
  EVALUATED: "Evaluated",
};

const STATUS_STYLE: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700 border-slate-200",
  SUBMITTED: "bg-brand-blue/5 text-brand-blue-dark border-brand-blue/10",
  IN_REVIEW: "bg-amber-50 text-amber-700 border-amber-200",
  EVALUATED: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const OUTCOME_STYLE: Record<string, string> = {
  PASS: "bg-emerald-50 text-emerald-700 border-emerald-200",
  FAIL: "bg-rose-50 text-rose-700 border-rose-200",
  PARTIAL: "bg-amber-50 text-amber-700 border-amber-200",
  UNKNOWN: "bg-slate-100 text-slate-700 border-slate-200",
};

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className={`text-xl ${color}`}>{icon}</div>
      <div className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
        {value}
      </div>
      <div className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
        {label}
      </div>
    </div>
  );
}

function toGroupOptions(rows: ProjectGradebookRow[]): GroupOption[] {
  const map = new Map<string, string>();
  rows.forEach((row) => {
    row.groupIds.forEach((groupId, index) => {
      if (!map.has(groupId)) {
        map.set(groupId, row.groupLabels[index] ?? groupId);
      }
    });
  });

  return [...map.entries()]
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function ProgressDashboard({
  session,
  projectOptions = [],
  selectedProjectId = "",
  embedded = false,
}: ProgressDashboardProps): JSX.Element {
  const { pushToast } = useToast();
  const [projectId, setProjectId] = useState(selectedProjectId);
  const [summary, setSummary] = useState<ProjectProgressSummary | null>(null);
  const [gradebook, setGradebook] = useState<ProjectGradebookRow[]>([]);
  const [availableGroups, setAvailableGroups] = useState<GroupOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<DeliveryStatus | "ALL">("ALL");
  const [outcomeFilter, setOutcomeFilter] = useState<BuilderOutcome | "ALL">("ALL");
  const [lateOnly, setLateOnly] = useState(false);
  const [groupFilter, setGroupFilter] = useState<string>("ALL");
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [previewFiles, setPreviewFiles] = useState<Array<{ path: string; content: string }>>([]);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyDeliveries, setHistoryDeliveries] = useState<DeliveryEntity[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [selectedStudentName, setSelectedStudentName] = useState("");

  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    if (selectedProjectId) {
      setProjectId(selectedProjectId);
      setGroupFilter("ALL");
    }
  }, [selectedProjectId]);

  const handlePreview = async (deliveryId: string) => {
    setIsLoadingPreview(true);
    setIsPreviewModalOpen(true);
    try {
      const files = await deliveriesApi.preview(deliveryId);
      setPreviewFiles(files);
    } catch (error) {
      pushToast({
        title: "Error previsualizando",
        description: getErrorMessage(error),
        tone: "error",
      });
      setIsPreviewModalOpen(false);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleViewHistory = async (assignmentId: string, studentName: string) => {
    setIsLoadingHistory(true);
    setIsHistoryModalOpen(true);
    setSelectedStudentName(studentName);
    try {
      const result = await deliveriesApi.list({ assignmentId });
      setHistoryDeliveries(result.data);
    } catch (error) {
      pushToast({
        title: "Error cargando historial",
        description: getErrorMessage(error),
        tone: "error",
      });
      setIsHistoryModalOpen(false);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const fetchDashboard = async (
    targetProjectId: string,
    targetGroupId = groupFilter,
  ) => {
    if (!targetProjectId.trim() || !session) {
      return;
    }

    setLoading(true);
    try {
      const groupId = targetGroupId === "ALL" ? undefined : targetGroupId;
      const [summaryData, gradebookData] = await Promise.all([
        projectsApi.progressSummary(targetProjectId.trim(), { groupId }),
        projectsApi.gradebook(targetProjectId.trim(), { groupId }),
      ]);
      setSummary(summaryData);
      setGradebook(gradebookData);
      if (groupId === undefined || availableGroups.length === 0) {
        setAvailableGroups(toGroupOptions(gradebookData));
      }
    } catch (error) {
      pushToast({
        title: "Seguimiento",
        description: getErrorMessage(error),
        tone: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!embedded || !selectedProjectId || !session) {
      return;
    }

    void fetchDashboard(selectedProjectId.trim(), groupFilter);
  }, [embedded, groupFilter, selectedProjectId, session]);

  const filteredRows = useMemo(() => {
    const normalizedSearch = deferredSearch.trim().toLowerCase();
    return gradebook.filter((row) => {
      if (statusFilter !== "ALL" && row.latestStatus !== statusFilter) {
        return false;
      }
      if (outcomeFilter !== "ALL" && row.latestBuilderOutcome !== outcomeFilter) {
        return false;
      }
      if (lateOnly && !row.isLate) {
        return false;
      }
      if (normalizedSearch) {
        const matches = [row.studentName, row.studentEmail]
          .filter(Boolean)
          .some((val) => val.toLowerCase().includes(normalizedSearch));
        if (!matches) return false;
      }
      return true;
    });
  }, [deferredSearch, gradebook, lateOnly, outcomeFilter, statusFilter]);
  const deferredRows = useDeferredValue(filteredRows);

  const total = summary?.totalAssignments ?? 0;
  const delivered = summary?.deliveredAtLeastOnce ?? 0;
  const rate = total > 0 ? Math.round((delivered / total) * 100) : 0;

  const handleLoad = async () => {
    await fetchDashboard(projectId.trim(), groupFilter);
  };

  const handleGroupChange = async (nextGroupId: string) => {
    setGroupFilter(nextGroupId);
    if (projectId.trim() && session) {
      await fetchDashboard(projectId.trim(), nextGroupId);
    }
  };

  const exportCsv = async () => {
    if (!projectId.trim()) return;
    setExporting(true);
    try {
      const blob = await projectsApi.exportGradebook(projectId.trim(), {
        deliveryStatus: statusFilter === "ALL" ? undefined : statusFilter,
        builderOutcome: outcomeFilter === "ALL" ? undefined : outcomeFilter,
        lateOnly,
        groupId: groupFilter === "ALL" ? undefined : groupFilter,
      });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `gradebook-${projectId.slice(0, 8)}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
      pushToast({
        title: "Gradebook exportado",
        description: "El CSV del seguimiento ya está listo.",
        tone: "success",
      });
    } catch (error) {
      pushToast({
        title: "No se pudo exportar",
        description: getErrorMessage(error),
        tone: "error",
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-8">
      {!embedded ? (
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
            <div className="flex-1">
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Proyecto a monitorizar
              </label>
              <select
                className="input-field bg-white"
                value={projectId}
                onChange={(event) => {
                  setProjectId(event.target.value);
                  setGroupFilter("ALL");
                }}
              >
                <option value="">Selecciona un proyecto...</option>
                {projectOptions.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.title}
                  </option>
                ))}
              </select>
            </div>
            <button
              className="btn-primary"
              onClick={() => void handleLoad()}
              disabled={loading || !projectId.trim()}
            >
              {loading ? <RiLoader4Line className="animate-spin" /> : null}
              {loading ? "Cargando seguimiento..." : "Cargar seguimiento"}
            </button>
          </div>
        </div>
      ) : null}

      {summary ? (
        <div className="space-y-8 animate-fade-in">
          <div className="grid grid-cols-2 gap-6 xl:grid-cols-4">
            <StatCard
              label="Alumnos"
              value={summary.totalAssignments}
              icon={<RiUserSharedLine />}
              color="text-slate-400"
            />
            <StatCard
              label="Han entregado"
              value={summary.deliveredAtLeastOnce}
              icon={<RiCheckboxCircleLine />}
              color="text-brand-blue"
            />
            <StatCard
              label="Con PASS"
              value={summary.passedAllTests}
              icon={<RiAwardLine />}
              color="text-emerald-500"
            />
            <StatCard
              label="Pendientes"
              value={summary.neverDelivered}
              icon={<RiTimeLine />}
              color="text-rose-400"
            />
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-slate-900">
                  Participación global
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Porcentaje de alumnos que ya registraron al menos una entrega.
                </p>
              </div>
              <span className="text-3xl font-black text-brand-blue">{rate}%</span>
            </div>
            <div className="mt-5 h-3 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full bg-brand-blue transition-all duration-1000 ease-out"
                style={{ width: `${rate}%` }}
              />
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-slate-900">
                Estados de entrega
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Distribución por último estado conocido dentro del filtro de grupo.
              </p>
              <div className="mt-5 flex h-4 overflow-hidden rounded-full bg-slate-100">
                {[
                  { key: "pending", value: summary.statusTotals.pending, color: "bg-slate-400" },
                  { key: "submitted", value: summary.statusTotals.submitted, color: "bg-brand-blue" },
                  { key: "inReview", value: summary.statusTotals.inReview, color: "bg-amber-500" },
                  { key: "evaluated", value: summary.statusTotals.evaluated, color: "bg-emerald-500" },
                ].map((segment) => (
                  <div
                    key={segment.key}
                    className={segment.color}
                    style={{
                      width: total > 0 ? `${(segment.value / total) * 100}%` : "0%",
                    }}
                  />
                ))}
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3 text-sm text-slate-600">
                <div>Pendientes: <strong>{summary.statusTotals.pending}</strong></div>
                <div>Entregadas: <strong>{summary.statusTotals.submitted}</strong></div>
                <div>En revisión: <strong>{summary.statusTotals.inReview}</strong></div>
                <div>Evaluadas: <strong>{summary.statusTotals.evaluated}</strong></div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-slate-900">
                Resultado del builder
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Último outcome automático registrado por alumno.
              </p>
              <div className="mt-5 flex h-4 overflow-hidden rounded-full bg-slate-100">
                {(["PASS", "PARTIAL", "FAIL", "UNKNOWN"] as BuilderOutcome[]).map((outcome) => (
                  <div
                    key={outcome}
                    className={
                      outcome === "PASS"
                        ? "bg-emerald-500"
                        : outcome === "PARTIAL"
                          ? "bg-amber-500"
                          : outcome === "FAIL"
                            ? "bg-rose-500"
                            : "bg-slate-400"
                    }
                    style={{
                      width: total > 0 ? `${(summary.outcomeTotals[outcome] / total) * 100}%` : "0%",
                    }}
                  />
                ))}
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3 text-sm text-slate-600">
                <div>PASS: <strong>{summary.outcomeTotals.PASS}</strong></div>
                <div>PARTIAL: <strong>{summary.outcomeTotals.PARTIAL}</strong></div>
                <div>FAIL: <strong>{summary.outcomeTotals.FAIL}</strong></div>
                <div>UNKNOWN: <strong>{summary.outcomeTotals.UNKNOWN}</strong></div>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-4 border-b border-slate-100 p-6 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-slate-900">
                  Gradebook del proyecto
                </h3>
                <p className="mt-2 text-sm text-slate-500">
                  {deferredRows.length} alumno(s) visibles tras aplicar filtros.
                </p>
              </div>
              <button
                className="btn-secondary"
                onClick={() => void exportCsv()}
                disabled={exporting}
              >
                <RiDownload2Line />
                {exporting ? "Exportando..." : "Exportar CSV"}
              </button>
            </div>

            <div className="grid gap-4 border-b border-slate-100 bg-slate-50 p-6 lg:grid-cols-6">
              <div className="lg:col-span-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                <RiFilter3Line />
                Filtros operativos
              </div>
              <div className="lg:col-span-2 relative">
                <RiSearchLine className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  className="input-field pl-10 bg-white"
                  placeholder="Busca por nombre o correo..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <select
                className="input-field bg-white"
                value={groupFilter}
                onChange={(event) => void handleGroupChange(event.target.value)}
              >
                <option value="ALL">Todos los grupos</option>
                {availableGroups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.label}
                  </option>
                ))}
              </select>
              <select
                className="input-field bg-white"
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as DeliveryStatus | "ALL")
                }
              >
                <option value="ALL">Todos los estados</option>
                <option value="SUBMITTED">Entregadas</option>
                <option value="IN_REVIEW">En revisión</option>
                <option value="EVALUATED">Evaluadas</option>
                <option value="DRAFT">Borrador</option>
              </select>
              <select
                className="input-field bg-white"
                value={outcomeFilter}
                onChange={(event) =>
                  setOutcomeFilter(event.target.value as BuilderOutcome | "ALL")
                }
              >
                <option value="ALL">Todos los outcomes</option>
                <option value="PASS">PASS</option>
                <option value="PARTIAL">PARTIAL</option>
                <option value="FAIL">FAIL</option>
                <option value="UNKNOWN">UNKNOWN</option>
              </select>
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={lateOnly}
                  onChange={(event) => setLateOnly(event.target.checked)}
                />
                Solo tardías
              </label>
              <div className="flex items-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
                <RiTeamLine className="mr-2 text-base" />
                {groupFilter === "ALL"
                  ? "Vista completa del proyecto"
                  : `${availableGroups.find((group) => group.id === groupFilter)?.label ?? "Grupo filtrado"}`}
              </div>
            </div>

            {deferredRows.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-slate-500">
                No hay filas de gradebook para los filtros seleccionados.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-slate-200 bg-white text-xs uppercase tracking-[0.16em] text-slate-500">
                      <th className="px-4 py-3 font-medium">Alumno</th>
                      <th className="px-4 py-3 font-medium">Grupos</th>
                      <th className="px-4 py-3 font-medium">Estado</th>
                      <th className="px-4 py-3 font-medium">Builder</th>
                      <th className="px-4 py-3 font-medium">Nota</th>
                      <th className="px-4 py-3 font-medium">Intentos</th>
                      <th className="px-4 py-3 font-medium text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {deferredRows.map((row) => (
                      <tr key={row.assignmentId} className="transition hover:bg-slate-50">
                        <td className="px-4 py-4">
                          <div className="font-medium text-slate-950">{row.studentName}</div>
                          <div className="mt-1 text-sm text-slate-500">{row.studentEmail}</div>
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-600">
                          {row.groupLabels.length > 0 ? row.groupLabels.join(" · ") : "Sin grupo"}
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[row.latestStatus ?? "DRAFT"] ?? STATUS_STYLE.DRAFT}`}>
                            {STATUS_LABEL[row.latestStatus ?? "DRAFT"] ?? "Pending"}
                          </span>
                          {row.isLate ? (
                            <div className="mt-2 text-xs font-medium text-amber-700">
                              Fuera de plazo
                            </div>
                          ) : null}
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${OUTCOME_STYLE[row.latestBuilderOutcome ?? "UNKNOWN"]}`}>
                            {row.latestBuilderOutcome ?? "UNKNOWN"}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-600">
                          <div className="font-semibold text-slate-900">
                            {row.grade !== null ? row.grade.toFixed(2) : "Pendiente"}
                          </div>
                          <div className="mt-1 line-clamp-2 text-xs text-slate-500">
                            {row.graderNotes || "Sin observaciones manuales"}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-600">
                          <div>{row.deliveryCount} enviadas</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {row.remainingDeliveries} restantes
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-600">
                          {new Date(row.lastActivityAt).toLocaleString("es-ES")}
                        </td>
                        <td className="px-4 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              className="btn-secondary h-9 w-9 p-0 justify-center"
                              title="Ver código de la última entrega"
                              onClick={() => row.latestDeliveryId && handlePreview(row.latestDeliveryId)}
                              disabled={!row.latestDeliveryId}
                            >
                              <RiCodeSSlashLine />
                            </button>
                            <button
                              className="btn-secondary h-9 w-9 p-0 justify-center"
                              title="Ver historial de entregas"
                              onClick={() => handleViewHistory(row.assignmentId, row.studentName)}
                            >
                              <RiHistoryLine />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        !embedded && (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">
            Selecciona un proyecto para cargar métricas, distribución y gradebook.
          </div>
        )
      )}

      {/* Modal de Historial de Entregas */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl animate-in zoom-in-95 duration-200">
            <header className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h3 className="text-xl font-bold text-slate-950">Historial de Entregas</h3>
                <p className="text-sm text-slate-500">Explorando versiones enviadas por {selectedStudentName}</p>
              </div>
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 transition-colors"
              >
                <RiCloseLine className="text-2xl" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-6">
              {isLoadingHistory ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <RiLoader4Line className="text-4xl text-brand-blue animate-spin" />
                  <span className="text-sm text-slate-500 font-medium">Cargando versiones...</span>
                </div>
              ) : historyDeliveries.length === 0 ? (
                <div className="text-center py-10">
                  <RiStackLine className="mx-auto text-4xl text-slate-300 mb-2" />
                  <p className="text-sm text-slate-500">No hay entregas registradas para este alumno.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {historyDeliveries.map((d) => (
                    <div key={d.id} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/50 p-4 transition-all hover:border-slate-200 hover:bg-white hover:shadow-sm">
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 font-bold text-sm">
                          v{d.version}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STATUS_STYLE[d.status]}`}>
                              {STATUS_LABEL[d.status]}
                            </span>
                            {d.isLate && (
                              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                                Fuera de plazo
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-xs text-slate-500">
                            {new Date(d.createdAt).toLocaleString("es-ES")}
                          </p>
                        </div>
                      </div>
                      <button
                        className="btn-secondary h-10 px-4 gap-2"
                        onClick={() => handlePreview(d.id)}
                      >
                        <RiCodeSSlashLine />
                        Ver código
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <CodePreviewModal
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        title="Explorador de Entrega"
        subtitle="Previsualizando código enviado por el alumno"
        isLoading={isLoadingPreview}
        files={previewFiles}
      />
    </div>
  );
}
