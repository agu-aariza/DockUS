import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { DangerConfirmModal } from "../shared/components/DangerConfirmModal";
import { CodePreviewModal } from "../shared/components/CodePreviewModal";
import type {
  ProjectStatus,
  SessionRecord,
} from "../shared/types";
import { ProgressDashboard } from "./ProgressDashboard";
import { useProjectManagement } from "./hooks/useProjectManagement";
import { useWorkspace } from "../shared/workspace/WorkspaceContext";
import {
  RiAddLine,
  RiDeleteBinLine,
  RiArrowRightSLine,
  RiBarChart2Line,
  RiCalendarScheduleLine,
  RiTeamLine,
  RiRefreshLine,
  RiSearchLine,
  RiUserAddLine,
  RiTeamFill,
  RiUser3Fill,
  RiFileLine,
  RiCloseLine,
  RiMore2Fill,
  RiCheckFill,
  RiSparkling2Line,
  RiPieChart2Line,
  RiSettings4Line,
  RiTestTubeLine,
  RiDeleteBin6Line,
  RiGroupLine,
  RiDraftLine,
  RiFileCodeLine,
  RiUserFollowFill,
  RiInformationFill,
  RiFoldersLine,
  RiLayoutGridFill,
  RiLoader4Line,
  RiFolderAddLine,
  RiFileDownloadLine,
  RiEyeLine,
  RiTimeLine,
  RiStackFill,
  RiFolderChartLine,
  RiFolderUploadLine,
} from "react-icons/ri";
import { EmptyState } from "../shared/components/EmptyState";
import {
  ProjectAssignmentManager,
} from "./components/ProjectSubPanels";
import { formatBytes } from "../shared/utils/format";
import { useNoticeToasts } from "../shared/toast/useNoticeToasts";
import { MetricCard } from "../shared/components/MetricCard";
import { PageHeader } from "../shared/components/ui/PageHeader";
import { VisualPicker } from "../shared/components/ui/VisualPicker";
import { Button } from "../shared/components/ui/Button";
import { Tabs } from "../shared/components/ui/Tabs";

interface TeacherProjectsPanelProps {
  session: SessionRecord | null;
}

type SubTab = 'catalog' | 'assignments' | 'config' | 'monitoring';
type DetailMode = "selected-project" | "new-project";

const STATUS_LABEL: Record<ProjectStatus, string> = {
  DRAFT: "Borrador",
  ACTIVE: "Activo",
  ARCHIVED: "Archivado",
};

const STATUS_STYLE: Record<ProjectStatus, string> = {
  DRAFT: "border-academic-secondary/30 bg-academic-secondary/5 text-academic-secondary",
  ACTIVE: "border-academic-primary/30 bg-academic-primary/5 text-academic-primary",
  ARCHIVED: "border-academic-tertiary/30 bg-academic-tertiary/5 text-academic-tertiary",
};

function formatOptionalDate(value?: string | null): string {
  return value ? new Date(value).toLocaleString("es-ES") : "Sin definir";
}

function ProjectStatusPill({ status }: { status: ProjectStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 ui-label ${STATUS_STYLE[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

function ProjectOverview({
  project,
  assignmentCount,
  preparedStudentCount,
  onOpenAssignments,
  onOpenSettings,
  onOpenMonitoring,
  onRefreshAssignments,
  onFetchTestSuite,
  onDelete,
}: {
  project: NonNullable<ReturnType<typeof useProjectManagement>["selectedProject"]>;
  assignmentCount: number;
  preparedStudentCount: number;
  onOpenAssignments: () => void;
  onOpenSettings: () => void;
  onOpenMonitoring: () => void;
  onRefreshAssignments: () => void;
  onFetchTestSuite: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="space-y-6">
      {/* Las métricas y secciones principales del proyecto */}
      <section className="grid gap-5 lg:grid-cols-4">
        <MetricCard
          label="Asignados"
          value={assignmentCount}
          helper="Alumnos activos"
          icon={<RiTeamFill />}
          variant="info"
        />
        <MetricCard
          label="Preparados"
          value={preparedStudentCount}
          helper="Listos para asignar"
          icon={<RiSparkling2Line />}
          variant="default"
        />
        <MetricCard
          label="Apertura"
          value={formatOptionalDate(project.opensAt).split(',')[0]}
          helper="Inicio de entregas"
          icon={<RiCalendarScheduleLine />}
          variant="default"
        />
        <MetricCard
          label="Cierre"
          value={formatOptionalDate(project.closesAt).split(',')[0]}
          helper="Fin de entregas"
          icon={<RiTimeLine />}
          variant="warning"
        />
      </section>

      <article className="rounded-lg border border-academic-surface-variant bg-white p-8 shadow-academic lg:col-span-4">
        <div className="flex flex-col xl:flex-row gap-8">
          {/* Operational Actions */}
          <div className="flex-1 space-y-4">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h4 className="eyebrow">
                  Operaciones de Gestión
                </h4>
                <h3 className="mt-2 text-xl font-bold text-slate-900">Control Operativo</h3>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-2xl text-slate-300">
                <RiSettings4Line />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <button
                className="group/btn flex items-center gap-3 w-full p-4 rounded-2xl bg-slate-50 border border-slate-100 text-sm font-bold text-slate-700 hover:bg-white hover:border-brand-maroon/20 hover:text-brand-maroon hover:shadow-md transition-all"
                onClick={onRefreshAssignments}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white border border-slate-100 text-slate-400 group-hover/btn:text-brand-maroon group-hover/btn:border-brand-maroon/10 shadow-sm">
                  <RiRefreshLine className="text-lg" />
                </div>
                <span>Sincronizar asignaciones</span>
              </button>

              <button
                className="group/btn flex items-center gap-3 w-full p-4 rounded-2xl bg-slate-50 border border-slate-100 text-sm font-bold text-slate-700 hover:bg-white hover:border-brand-blue/20 hover:text-brand-blue hover:shadow-md transition-all"
                onClick={onFetchTestSuite}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white border border-slate-100 text-slate-400 group-hover/btn:text-brand-blue group-hover/btn:border-brand-blue/10 shadow-sm">
                  <RiTestTubeLine className="text-lg" />
                </div>
                <span>Recuperar suite docente</span>
              </button>

              <button
                className="group/btn flex items-center gap-3 w-full p-4 rounded-2xl bg-slate-50 border border-slate-100 text-sm font-bold text-slate-700 hover:bg-white hover:border-brand-blue/20 hover:text-brand-blue hover:shadow-md transition-all"
                onClick={onOpenMonitoring}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white border border-slate-100 text-slate-400 group-hover/btn:text-brand-blue group-hover/btn:border-brand-blue/10 shadow-sm">
                  <RiBarChart2Line className="text-lg" />
                </div>
                <span>Ver seguimiento</span>
              </button>
            </div>
          </div>

          {/* Right Side: Danger actions */}
          <div className="xl:w-[240px] shrink-0 xl:border-l xl:border-slate-100 xl:pl-8 flex items-end">
            <button
              className="group/btn flex items-center gap-3 w-full p-4 rounded-2xl bg-rose-50 border border-rose-100 text-sm font-bold text-rose-600 hover:bg-rose-600 hover:text-white hover:shadow-lg hover:shadow-rose-500/20 transition-all"
              onClick={onDelete}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-rose-500 shadow-sm group-hover/btn:bg-white/20 group-hover/btn:text-white transition-colors">
                <RiDeleteBin6Line className="text-lg" />
              </div>
              <span>Eliminar proyecto</span>
            </button>
          </div>
        </div>
      </article>
    </div>
  );
}

export function TeacherProjectsPanel({ session }: TeacherProjectsPanelProps): JSX.Element {
  const pc = useProjectManagement(session);
  const { selection, setProject, clearWorkspace } = useWorkspace();
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('catalog');
  const [detailMode, setDetailMode] = useState<DetailMode>("selected-project");
  const [isUploadingSuite, setIsUploadingSuite] = useState(false);
  const [assignmentSearch, setAssignmentSearch] = useState("");
  const [projectSearch, setProjectSearch] = useState("");
  const deferredProjectSearch = useDeferredValue(projectSearch);

  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [previewFiles, setPreviewFiles] = useState<Array<{ path: string, content: string }>>([]);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [selectedPreviewFile, setSelectedPreviewFile] = useState<number>(0);

  useNoticeToasts(
    [pc.projectNotice, pc.editorNotice, pc.assignmentNotice, pc.suiteNotice],
    "Proyectos",
  );

  useEffect(() => {
    if (selection.projectId && pc.projects?.data) {
      if (pc.selectedProjectId !== selection.projectId) {
        const exists = pc.projects.data.some(p => p.id === selection.projectId);
        if (exists) {
          pc.setSelectedProjectId(selection.projectId);
        }
      }
    }
  }, [selection.projectId, pc.projects?.data]);

  useEffect(() => {
    if (pc.selectedProject && pc.selectedProject.id !== selection.projectId) {
      setProject(pc.selectedProject.id, pc.selectedProject.title);
    }
    if (!pc.selectedProject && detailMode !== "new-project" && selection.projectId) {
      clearWorkspace();
    }
  }, [clearWorkspace, detailMode, pc.selectedProject, selection.projectId, setProject]);

  useEffect(() => {
    setAssignmentSearch("");
  }, [pc.selectedProjectId]);

  const projects = pc.projects?.data ?? [];
  const visibleProjects = useMemo(() => {
    const normalized = deferredProjectSearch.trim().toLowerCase();
    if (!normalized) {
      return projects;
    }

    return projects.filter((project) =>
      [project.title, project.contextAcademico, project.expectedType]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalized)),
    );
  }, [deferredProjectSearch, projects]);

  const preparedStudentCount =
    pc.selectedStudentIds.length +
    pc.bulkStudentEmails
      .split(/[\n,;]+/)
      .map((value) => value.trim())
      .filter(Boolean).length;
  const assignmentCount = pc.assignmentsResult?.filter((assignment) => !assignment.revokedAt).length ?? 0;

  const openNewProject = () => {
    pc.setCreateForm({
      title: "",
      contextAcademico: "",
      status: "DRAFT",
      maxDeliveriesPerStudent: "1",
      expectedType: "",
      rubricInstructions: "",
      opensAt: "",
      closesAt: "",
      assignedGroupIds: [],
      suiteFile: null,
    });
    pc.setSelectedProjectId("");
    clearWorkspace();
    setDetailMode("new-project");
    setActiveSubTab("config");
  };

  const openProject = (projectId: string, nextTab: SubTab = "catalog") => {
    pc.setSelectedProjectId(projectId);
    setDetailMode("selected-project");
    setActiveSubTab(nextTab);
  };

  const handleDownloadSuite = async () => {
    if (!pc.testSuiteResult || typeof pc.testSuiteResult === 'string' || !('id' in pc.testSuiteResult)) return;
    try {
      const { storageApi } = await import("../shared/api/services");
      const { downloadUrl } = await storageApi.createDownloadUrl(pc.testSuiteResult.id);

      // Creamos un link temporal para forzar la descarga con nombre
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', pc.testSuiteResult.logicalName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Error al descargar la suite:", error);
    }
  };

  const handleOpenPreview = async () => {
    if (!pc.selectedProjectId) return;
    setIsLoadingPreview(true);
    setIsPreviewModalOpen(true);
    try {
      const { projectsApi } = await import("../shared/api/services");
      const data = await projectsApi.previewTestSuite(pc.selectedProjectId);
      setPreviewFiles(data);
      if (data.length > 0) setSelectedPreviewFile(0);
    } catch (error) {
      console.error("Error al cargar preview:", error);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleFileChange = async (event: any) => {
    const file = event.target.files?.[0];
    if (!file || !pc.selectedProjectId) return;

    setIsUploadingSuite(true);
    try {
      await pc.handleUploadTestSuite(file);
    } finally {
      setIsUploadingSuite(false);
      if (event.target) event.target.value = "";
    }
  };

  const selectedCanvasProject =
    detailMode === "new-project" ? null : pc.selectedProject;

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Gestión de Proyectos"
        subtitle="Gestión estratégica de proyectos académicos: orquestación de asignaciones, seguimiento de progreso y auditoría de calidad."
        icon={<RiFoldersLine />}
        badge={projects.length.toString()}
        actions={
          <Button variant="primary" onClick={openNewProject}>
            <RiFolderAddLine /> Nuevo Proyecto
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="flex flex-col h-full rounded-lg border border-academic-surface-variant bg-white p-6 shadow-academic overflow-hidden">
          <div className="flex items-center justify-between gap-3 mb-6">
            <div>
              <p className="eyebrow !mb-1">Catálogo</p>
              <h3 className="text-xl font-bold tracking-tight text-slate-950">
                Proyectos
              </h3>
            </div>
            <span className="flex h-8 min-w-[2rem] items-center justify-center rounded-full bg-slate-900 px-2 text-[11px] font-bold text-white shadow-lg shadow-slate-900/10">
              {projects.length}
            </span>
          </div>

          <div className="space-y-4">
            <div className="group relative">
              <RiSearchLine className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg transition-colors group-focus-within:text-brand-maroon" />
              <input
                className="input-field pl-11 h-12 bg-slate-50 border-transparent focus:bg-white focus:border-brand-maroon/30 focus:ring-4 focus:ring-brand-maroon/5 transition-all"
                placeholder="Buscar proyecto..."
                value={projectSearch}
                onChange={(event) => setProjectSearch(event.target.value)}
              />
            </div>
            <Button
              variant="secondary"
              className="w-full justify-center"
              onClick={() => void pc.refreshProjects("Catálogo actualizado.")}
              disabled={pc.loadingProjects}
            >
              {pc.loadingProjects ? <RiLoader4Line className="animate-spin" /> : <RiRefreshLine />}
              Actualizar catálogo
            </Button>
          </div>

          <div className="mt-8 flex-1 overflow-y-auto space-y-3 pr-1 -mr-1 custom-scrollbar">
            {visibleProjects.length === 0 ? (
              <div className="rounded-[2rem] border-2 border-dashed border-slate-100 bg-slate-50/50 px-4 py-12 text-center">
                <RiFoldersLine className="mx-auto text-3xl text-slate-200 mb-3" />
                <p className="text-xs font-medium text-slate-400 italic">No se encontraron proyectos</p>
              </div>
            ) : (
              visibleProjects.map((project) => {
                const isSelected =
                  detailMode === "selected-project" &&
                  pc.selectedProjectId === project.id;

                return (
                  <button
                    key={project.id}
                    className={`group w-full rounded-lg border p-5 text-left transition-all duration-300 relative overflow-hidden ${isSelected
                      ? "border-academic-primary bg-academic-primary text-academic-on-primary shadow-academic-lg scale-[1.02] z-10"
                      : "border-academic-surface-variant bg-white hover:border-academic-outline hover:bg-academic-surface-container-lowest hover:shadow-academic active:scale-95"
                      }`}
                    onClick={() => openProject(project.id)}
                  >
                    {isSelected && (
                      <div className="absolute top-0 right-0 p-1 opacity-20">
                        <RiFoldersLine className="text-4xl -rotate-12 translate-x-2 -translate-y-2" />
                      </div>
                    )}

                    <div className="flex items-start justify-between gap-3 relative">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <RiFoldersLine className={isSelected ? "text-academic-secondary" : "text-academic-outline group-hover:text-academic-outline-variant"} />
                          <span className="line-clamp-1 text-sm font-bold tracking-tight">
                            {project.title}
                          </span>
                        </div>
                        <div className={`ui-label leading-relaxed line-clamp-1 ${isSelected ? "text-slate-400" : "text-slate-500"}`}>
                          {project.expectedType || "Sin stack definido"}
                        </div>
                      </div>
                      <RiArrowRightSLine className={`text-lg transition-transform ${isSelected ? "text-white/40 translate-x-1" : "text-slate-200 group-hover:text-slate-400"}`} />
                    </div>

                    <div className="mt-5 flex items-center justify-between relative">
                      <div className="flex items-center gap-3">
                        <span
                          className={`rounded-full px-3 py-1 ui-label ${isSelected
                            ? "bg-white/10 text-white/90 border border-white/10"
                            : STATUS_STYLE[project.status]
                            }`}
                        >
                          {STATUS_LABEL[project.status]}
                        </span>

                        {project.teachers && project.teachers.length > 0 && (
                          <div className="flex -space-x-1.5">
                            {project.teachers.slice(0, 3).map((teacher) => (
                              <div
                                key={teacher.id}
                                className={`h-5 w-5 rounded-full border-2 flex items-center justify-center text-[7px] font-bold uppercase transition-transform hover:scale-110 hover:z-20 ${isSelected ? 'border-slate-800 bg-slate-700 text-brand-blue-light' : 'border-white bg-brand-blue/5 text-brand-blue'
                                  }`}
                                title={`${teacher.firstName} ${teacher.lastName}`}
                              >
                                {teacher.firstName[0]}{teacher.lastName[0]}
                              </div>
                            ))}
                            {project.teachers.length > 3 && (
                              <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center text-[7px] font-bold ${isSelected ? 'border-slate-800 bg-slate-700 text-slate-400' : 'border-white bg-slate-50 text-slate-400'
                                }`}>
                                +{project.teachers.length - 3}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <RiTeamFill className={isSelected ? "text-white/20" : "text-slate-200"} />
                        <span
                          className={`ui-label ${isSelected ? "text-slate-500" : "text-slate-400"
                            }`}
                        >
                          {project.maxDeliveriesPerStudent} {project.maxDeliveriesPerStudent === 1 ? 'intento' : 'intentos'}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <section className="min-w-0 space-y-5">
          {detailMode === "new-project" ? (
            <div className="rounded-lg border border-academic-surface-variant bg-white p-8 shadow-academic">
              <div className="flex flex-col gap-3 border-b border-slate-100 pb-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="eyebrow">Definición de Proyecto</p>
                  <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                    Parametrización de Práctica Académica
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Define el contrato académico, la ventana temporal y el tipo esperado para que el builder y el seguimiento sean coherentes desde el primer momento.
                  </p>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setDetailMode("selected-project");
                    setActiveSubTab("catalog");
                  }}
                >
                  Volver al lienzo
                </Button>
              </div>

              <form className="mt-8 space-y-6" onSubmit={pc.handleCreate}>
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <div>
                    <label className="label-text">Título del proyecto</label>
                    <input
                      className="input-field"
                      required
                      value={pc.createForm.title}
                      onChange={(e) => pc.setCreateForm(prev => ({ ...prev, title: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="label-text">Estado</label>
                    <select
                      className="input-field"
                      value={pc.createForm.status}
                      onChange={(e) => pc.setCreateForm(prev => ({ ...prev, status: e.target.value as ProjectStatus }))}
                    >
                      <option value="DRAFT">DRAFT</option>
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="ARCHIVED">ARCHIVED</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="label-text">Contexto académico</label>
                  <textarea
                    className="input-field min-h-[140px]"
                    placeholder="Describe objetivos, entregables, criterios y notas operativas."
                    value={pc.createForm.contextAcademico}
                    onChange={(e) => pc.setCreateForm(prev => ({ ...prev, contextAcademico: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <div>
                    <label className="label-text">Intentos máximos por alumno</label>
                    <input
                      type="number"
                      min="1"
                      className="input-field"
                      value={pc.createForm.maxDeliveriesPerStudent}
                      onChange={(e) => pc.setCreateForm(prev => ({ ...prev, maxDeliveriesPerStudent: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="label-text">Tipo esperado</label>
                    <input
                      className="input-field"
                      placeholder="CLI, Flask, FastAPI, Django simple..."
                      value={pc.createForm.expectedType}
                      onChange={(e) => pc.setCreateForm(prev => ({ ...prev, expectedType: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <div>
                    <label className="label-text">Abre entregas en</label>
                    <input
                      type="datetime-local"
                      className="input-field"
                      value={pc.createForm.opensAt}
                      onChange={(e) => pc.setCreateForm(prev => ({ ...prev, opensAt: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="label-text">Cierra entregas en</label>
                    <input
                      type="datetime-local"
                      className="input-field"
                      value={pc.createForm.closesAt}
                      onChange={(e) => pc.setCreateForm(prev => ({ ...prev, closesAt: e.target.value }))}
                    />
                  </div>
                </div>
                <div>
                  <label className="label-text">Instrucciones de rúbrica</label>
                  <textarea
                    className="input-field min-h-[160px]"
                    placeholder="Indica los criterios docentes y el comportamiento esperado de la nota final."
                    value={pc.createForm.rubricInstructions}
                    onChange={(e) => pc.setCreateForm(prev => ({ ...prev, rubricInstructions: e.target.value }))}
                  />
                </div>

                <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 pt-6 border-t border-slate-100">
                  {/* Grupos Académicos */}
                  <div className="space-y-4">
                    <label className="label-text">Asignar Grupos Académicos</label>
                    <p className="text-xs text-slate-500 mb-3">Los alumnos de los grupos seleccionados serán matriculados automáticamente.</p>
                    <div className="grid grid-cols-1 gap-3 max-h-[300px] overflow-y-auto pr-2">
                      {pc.groups.map((group) => {
                        const isSelected = pc.createForm.assignedGroupIds.includes(group.id);
                        return (
                          <button
                            key={group.id}
                            type="button"
                            onClick={() => {
                              const newIds = isSelected
                                ? pc.createForm.assignedGroupIds.filter(id => id !== group.id)
                                : [...pc.createForm.assignedGroupIds, group.id];
                              pc.setCreateForm(prev => ({ ...prev, assignedGroupIds: newIds }));
                            }}
                            className={`flex items-center justify-between p-4 rounded-2xl border transition-all text-left ${isSelected
                                ? "bg-brand-maroon/5 border-brand-maroon shadow-sm"
                                : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                              }`}
                          >
                            <div className="flex items-center gap-4">
                              <div className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${isSelected ? "bg-brand-maroon text-white" : "bg-slate-100 text-slate-500"
                                }`}>
                                <RiGroupLine className="text-lg" />
                              </div>
                              <div>
                                <p className={`font-bold text-sm ${isSelected ? "text-brand-maroon" : "text-slate-900"}`}>{group.name}</p>
                                <p className="text-xs text-slate-500">{group.code || 'Sin código'}</p>
                              </div>
                            </div>
                            {isSelected && <RiCheckFill className="text-brand-maroon text-xl" />}
                          </button>
                        );
                      })}
                      {pc.groups.length === 0 && (
                        <div className="p-8 text-center rounded-2xl bg-slate-50 border border-slate-100">
                          <RiGroupLine className="mx-auto text-3xl text-slate-300 mb-3" />
                          <p className="text-sm text-slate-500">No hay grupos creados todavía.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Suite de Evaluación */}
                  <div className="space-y-4">
                    <label className="label-text">Suite de Evaluación Inicial</label>
                    <p className="text-xs text-slate-500 mb-3">Sube el archivo .zip con los tests docentes para este proyecto.</p>

                    <div
                      className={`relative flex flex-col items-center justify-center rounded-3xl border-2 border-dashed p-8 text-center transition-all h-[300px] ${pc.createForm.suiteFile
                          ? "bg-emerald-50 border-emerald-200 shadow-sm"
                          : "bg-slate-50/50 border-slate-200 hover:bg-slate-50 hover:border-slate-300"
                        }`}
                    >
                      <input
                        id="new-project-suite"
                        type="file"
                        className="hidden"
                        accept=".zip"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          pc.setCreateForm(prev => ({ ...prev, suiteFile: file }));
                        }}
                      />

                      <div className={`mb-4 flex h-16 w-16 items-center justify-center rounded-2xl shadow-sm transition-colors ${pc.createForm.suiteFile ? "bg-emerald-500 text-white" : "bg-white text-slate-400"
                        }`}>
                        {pc.createForm.suiteFile ? <RiCheckFill className="text-3xl" /> : <RiFolderUploadLine className="text-3xl" />}
                      </div>

                      {pc.createForm.suiteFile ? (
                        <>
                          <h5 className="text-sm font-bold text-emerald-900">{pc.createForm.suiteFile.name}</h5>
                          <p className="mt-1 text-xs text-emerald-600">{(pc.createForm.suiteFile.size / 1024).toFixed(1)} KB pronto para subir</p>
                          <button
                            type="button"
                            className="mt-4 text-xs font-bold text-rose-600 hover:underline"
                            onClick={() => pc.setCreateForm(prev => ({ ...prev, suiteFile: null }))}
                          >
                            Quitar archivo
                          </button>
                        </>
                      ) : (
                        <>
                          <h5 className="text-sm font-bold text-slate-900">Seleccionar Suite (.zip)</h5>
                          <p className="mt-1 text-xs text-slate-500">Haz clic para buscar en tu equipo</p>
                          <button
                            type="button"
                            className="mt-6 btn-secondary !py-2"
                            onClick={() => document.getElementById('new-project-suite')?.click()}
                          >
                            Explorar archivos
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-5">
                  <Button type="submit" variant="primary">
                    <RiFolderAddLine />
                    Crear proyecto
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setDetailMode("selected-project");
                      setActiveSubTab("catalog");
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            </div>
          ) : selectedCanvasProject ? (
            <>
              <div className="rounded-lg border border-academic-surface-variant bg-white p-8 shadow-academic">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                  {/* Left Side: Pills, Title, Subtitle */}
                  <div className="min-w-0 flex-1 pr-6">
                    <div className="flex flex-wrap items-center gap-3 mb-3">
                      <ProjectStatusPill status={selectedCanvasProject.status} />
                      <span className="inline-flex items-center rounded-full border border-academic-secondary/30 bg-academic-secondary/5 px-3 py-1 ui-label text-academic-secondary uppercase">
                        {selectedCanvasProject.maxDeliveriesPerStudent} INTENTOS
                      </span>
                      <span className="inline-flex items-center rounded-full border border-academic-secondary/30 bg-academic-secondary/5 px-3 py-1 ui-label text-academic-secondary uppercase">
                        PERFIL DEL PROYECTO
                      </span>
                    </div>

                    <h3 className="truncate text-3xl font-bold tracking-tight text-slate-950">
                      {selectedCanvasProject.title}
                    </h3>

                    <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600 line-clamp-2">
                      {selectedCanvasProject.contextAcademico || "Sin contexto académico definido."}
                    </p>
                  </div>

                  {/* Right Side: Tabs */}
                  <div className="flex items-center shrink-0">
                    <Tabs
                      tabs={[
                        { id: "catalog", label: "Resumen", icon: RiLayoutGridFill },
                        { id: "assignments", label: "Alumnos", icon: RiTeamFill },
                        { id: "monitoring", label: "Seguimiento", icon: RiBarChart2Line },
                        { id: "config", label: "Ajustes", icon: RiSettings4Line },
                      ]}
                      activeTab={activeSubTab}
                      onTabChange={(id) => setActiveSubTab(id as SubTab)}
                      variant="primary"
                    />
                  </div>
                </div>
              </div>

              {activeSubTab === "catalog" ? (
                <ProjectOverview
                  project={selectedCanvasProject}
                  assignmentCount={assignmentCount}
                  preparedStudentCount={preparedStudentCount}
                  onOpenAssignments={() => setActiveSubTab("assignments")}
                  onOpenSettings={() => setActiveSubTab("config")}
                  onOpenMonitoring={() => setActiveSubTab("monitoring")}
                  onRefreshAssignments={() => void pc.refreshAssignments()}
                  onFetchTestSuite={() => void pc.handleFetchTestSuite()}
                  onDelete={() => {
                    pc.setDeleteId(selectedCanvasProject.id);
                    pc.setConfirmOpen(true);
                  }}
                />
              ) : null}

              {activeSubTab === "assignments" ? (
                <ProjectAssignmentManager
                  project={selectedCanvasProject}
                  students={pc.students}
                  groups={pc.groups}
                  assignments={pc.assignmentsResult ?? []}
                  selectedStudentIds={pc.selectedStudentIds}
                  searchTerm={assignmentSearch}
                  loadingGroups={pc.loadingGroups}
                  focusedGroupId={pc.focusedGroupId}
                  onFocusedGroupChange={pc.setFocusedGroupId}
                  assignmentBusy={pc.assignmentBusy}
                  onSearchChange={setAssignmentSearch}
                  onImportCsvFile={(file) => void pc.handleBulkEmailImport(file)}
                  onSelectionChange={pc.setSelectedStudentIds}
                  onAssignSelected={() => void pc.handleAssignStudents()}
                  onRefreshGroups={() => void pc.refreshGroups()}
                  onRefreshAssignments={() => void pc.refreshAssignments()}
                  onRevokeAssignment={(assignmentId, studentId) =>
                    void pc.handleRevokeAssignment(assignmentId, studentId)
                  }
                  onAssignGroups={(groupIds) => {
                    pc.setSelectedGroupIds(groupIds);
                    void pc.handleAssignGroups();
                  }}
                />
              ) : null}





              {activeSubTab === "monitoring" ? (
                <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
                  <ProgressDashboard
                    session={session}
                    selectedProjectId={selectedCanvasProject.id}
                    embedded
                  />
                </div>
              ) : null}

              {activeSubTab === "config" ? (
                <div className="space-y-8 animate-fade-in">
                  <form className="space-y-8" onSubmit={pc.handleUpdate}>
                    {/* Tarjeta: Ajustes Generales */}
                    <div className="rounded-[2.5rem] border border-slate-200 bg-white p-8 shadow-sm">
                      <div className="flex items-center gap-4 mb-8">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-maroon/5 text-brand-maroon text-xl">
                          <RiSettings4Line />
                        </div>
                        <div>
                          <h4 className="text-xl font-bold tracking-tight text-slate-950">Ajustes Generales</h4>
                          <p className="text-sm text-slate-500">Identidad, estado y contexto técnico del proyecto.</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                        <div className="space-y-2">
                          <label className="ui-label">Título del proyecto</label>
                          <input
                            className="input-field h-12"
                            required
                            value={pc.editForm.title}
                            onChange={e => pc.setEditForm(prev => ({ ...prev, title: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="ui-label">Estado operativo</label>
                          <select
                            className="input-field h-12"
                            value={pc.editForm.status}
                            onChange={e => pc.setEditForm(prev => ({ ...prev, status: e.target.value as ProjectStatus }))}
                          >
                            <option value="DRAFT">BORRADOR (No visible para alumnos)</option>
                            <option value="ACTIVE">ACTIVO (Visible y entregable)</option>
                            <option value="ARCHIVED">ARCHIVADO (Solo lectura)</option>
                          </select>
                        </div>
                        <div className="space-y-2 lg:col-span-2">
                          <label className="ui-label">Contexto académico y objetivos</label>
                          <textarea
                            className="input-field min-h-[120px] py-4"
                            placeholder="Describe qué deben aprender y entregar los alumnos..."
                            value={pc.editForm.contextAcademico}
                            onChange={e => pc.setEditForm(prev => ({ ...prev, contextAcademico: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="ui-label">Tipo de stack esperado</label>
                          <input
                            className="input-field h-12"
                            placeholder="Ej. FastAPI + PostgreSQL"
                            value={pc.editForm.expectedType}
                            onChange={e => pc.setEditForm(prev => ({ ...prev, expectedType: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Intentos por alumno</label>
                          <input
                            type="number"
                            min="1"
                            className="input-field h-12"
                            value={pc.editForm.maxDeliveriesPerStudent}
                            onChange={e => pc.setEditForm(prev => ({ ...prev, maxDeliveriesPerStudent: e.target.value }))}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Tarjeta: Ventana Temporal y Rúbrica */}
                    <div className="rounded-[2.5rem] border border-slate-200 bg-white p-8 shadow-sm">
                      <div className="flex items-center gap-4 mb-8">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 text-xl">
                          <RiCalendarScheduleLine />
                        </div>
                        <div>
                          <h4 className="text-xl font-bold tracking-tight text-slate-950">Plazos y Evaluación</h4>
                          <p className="text-sm text-slate-500">Define cuándo se entrega y bajo qué criterios se califica.</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                        <div className="space-y-2">
                          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Apertura de entregas</label>
                          <input
                            type="datetime-local"
                            className="input-field h-12"
                            value={pc.editForm.opensAt}
                            onChange={e => pc.setEditForm(prev => ({ ...prev, opensAt: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Cierre de entregas</label>
                          <input
                            type="datetime-local"
                            className="input-field h-12"
                            value={pc.editForm.closesAt}
                            onChange={e => pc.setEditForm(prev => ({ ...prev, closesAt: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2 lg:col-span-2">
                          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Instrucciones de la rúbrica</label>
                          <textarea
                            className="input-field min-h-[140px] py-4"
                            placeholder="Criterios de evaluación, penalizaciones, etc."
                            value={pc.editForm.rubricInstructions}
                            onChange={e => pc.setEditForm(prev => ({ ...prev, rubricInstructions: e.target.value }))}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Tarjeta: Equipo Docente */}
                    <div className="rounded-[2.5rem] border border-slate-200 bg-white overflow-hidden shadow-sm">
                      <div className="bg-white px-8 pt-8">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-blue/5 text-brand-blue">
                            <RiTeamFill className="text-xl" />
                          </div>
                          <div>
                            <h4 className="text-lg font-bold text-slate-900">Equipo Docente</h4>
                            <p className="text-xs text-slate-500">Profesores con permisos administrativos.</p>
                          </div>
                        </div>
                      </div>

                      <div className="p-8">
                        <div className="space-y-6">
                          {/* Add Teacher Selection */}
                          <div className="flex flex-col md:flex-row gap-4 items-end">
                            <div className="flex-1 w-full">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">
                                Añadir Colaborador
                              </label>
                              <VisualPicker
                                options={pc.allTeachers
                                  .filter(t => !selectedCanvasProject.teachers?.some(st => st.id === t.id))
                                  .map(teacher => ({
                                    id: teacher.id,
                                    label: `${teacher.firstName} ${teacher.lastName}`,
                                    description: teacher.email,
                                    icon: <div className="h-6 w-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-400 uppercase">
                                      {teacher.firstName[0]}{teacher.lastName[0]}
                                    </div>
                                  }))
                                }
                                value={null}
                                onSelect={(id) => pc.handleAddTeacher(selectedCanvasProject.id, id)}
                                placeholder="Buscar profesor por nombre o email..."
                              />
                            </div>
                            <div className="px-4 py-3 bg-brand-blue/5 rounded-2xl border border-brand-blue/10 text-brand-blue text-[10px] font-bold uppercase tracking-wider h-[46px] flex items-center shrink-0">
                              <RiInformationFill className="mr-2 text-brand-blue-light" />
                              {pc.allTeachers.filter(t => !selectedCanvasProject.teachers?.some(st => st.id === t.id)).length} disponibles
                            </div>
                          </div>

                          {/* Teachers Grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
                            {selectedCanvasProject.teachers?.map((teacher) => (
                              <div
                                key={teacher.id}
                                className="group flex items-center justify-between p-4 rounded-3xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:border-brand-blue/10 hover:shadow-md transition-all duration-300"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="h-10 w-10 rounded-2xl bg-brand-blue/10 flex items-center justify-center text-xs font-bold text-brand-blue shadow-sm group-hover:scale-110 transition-transform">
                                    {teacher.firstName[0]}{teacher.lastName[0]}
                                  </div>
                                  <div>
                                    <p className="text-sm font-bold text-slate-800">{teacher.firstName} {teacher.lastName}</p>
                                    <p className="text-[11px] text-slate-400">{teacher.email}</p>
                                  </div>
                                </div>

                                {selectedCanvasProject.teachers!.length > 1 && (
                                  <button
                                    onClick={() => pc.handleRemoveTeacher(selectedCanvasProject.id, teacher.id)}
                                    className="p-2 rounded-xl text-slate-300 hover:text-rose-500 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-all"
                                    title="Eliminar del equipo"
                                  >
                                    <RiCloseLine size={20} />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Tarjeta: Suite Docente */}
                    <div className="rounded-[2.5rem] border border-slate-200 bg-white overflow-hidden shadow-sm">
                      <div className="bg-slate-900 p-8 text-white">
                        <div className="flex items-center gap-4">
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-white text-xl">
                            <RiTestTubeLine />
                          </div>
                          <div>
                            <h4 className="text-xl font-bold tracking-tight">Suite de Evaluación Técnica</h4>
                            <p className="text-sm text-slate-400">Tests automáticos para validar las entregas.</p>
                          </div>
                        </div>
                      </div>

                      <div className="p-8 bg-white">
                        {pc.testSuiteResult && 'id' in pc.testSuiteResult ? (
                          <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
                            <div className="flex items-start gap-5">
                              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-600 border border-emerald-100 shadow-sm">
                                <RiCheckFill className="text-4xl" />
                              </div>
                              <div className="space-y-1">
                                <p className="text-lg font-bold text-slate-900">{pc.testSuiteResult.logicalName}</p>
                                <div className="flex items-center gap-3 text-sm text-slate-500">
                                  <span>{formatBytes(pc.testSuiteResult.sizeBytes)}</span>
                                  <span className="h-1 w-1 rounded-full bg-slate-300" />
                                  <span>Subido el {new Date(pc.testSuiteResult.createdAt).toLocaleDateString()}</span>
                                </div>

                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-3">
                              <button
                                type="button"
                                className="btn-secondary"
                                onClick={handleOpenPreview}
                              >
                                <RiEyeLine className="text-xl" />
                                Ver tests
                              </button>
                              <button
                                type="button"
                                className="btn-secondary"
                                onClick={handleDownloadSuite}
                              >
                                <RiFileDownloadLine className="text-xl" />
                                Descargar
                              </button>
                              <div className="h-8 w-px bg-slate-100 mx-2 hidden md:block" />
                              <button
                                type="button"
                                className="btn-primary"
                                disabled={isUploadingSuite}
                                onClick={() => document.getElementById('suite-upload')?.click()}
                              >
                                <RiFolderUploadLine className="text-xl" />
                                {isUploadingSuite ? "Subiendo..." : "Reemplazar Suite"}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center rounded-[2rem] border-2 border-dashed border-slate-200 bg-slate-50/50 py-16 px-6 text-center">
                            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-white text-slate-300 shadow-sm">
                              <RiFolderUploadLine className="text-4xl" />
                            </div>
                            <h5 className="text-lg font-bold text-slate-950">No hay suite técnica configurada</h5>
                            <p className="mt-2 mb-8 max-w-sm text-sm text-slate-500">
                              Para evaluar automáticamente las entregas, sube una suite de tests compatible con <span className="font-bold text-slate-700">pytest</span>.
                            </p>
                            <button
                              type="button"
                              className="btn-primary px-10"
                              disabled={isUploadingSuite}
                              onClick={() => document.getElementById('suite-upload')?.click()}
                            >
                              {isUploadingSuite ? (
                                <RiLoader4Line className="animate-spin text-xl" />
                              ) : (
                                <RiFolderUploadLine className="text-xl" />
                              )}
                              {isUploadingSuite ? "Subiendo archivo..." : "Subir Suite (.zip)"}
                            </button>
                          </div>
                        )}

                        <input
                          type="file"
                          id="suite-upload"
                          className="hidden"
                          accept=".zip,.tar.gz"
                          onChange={handleFileChange}
                        />
                      </div>
                    </div>

                    {/* Acciones de Guardado Final */}
                    <div className="flex flex-col items-center justify-between gap-6 pt-10 border-t border-slate-100 sm:flex-row">
                      <div className="text-sm text-slate-500">
                        Última modificación detectada: <span className="font-bold text-slate-700">Hace unos momentos</span>
                      </div>
                      <div className="flex flex-wrap gap-4 w-full sm:w-auto">
                        <button
                          type="submit"
                          className="btn-primary px-10 flex-1 sm:flex-none"
                        >
                          <RiCheckFill className="text-2xl" />
                          Guardar configuración
                        </button>
                        <button
                          type="button"
                          className="btn-danger px-8 flex-1 sm:flex-none"
                          onClick={() => {
                            if (selectedCanvasProject) {
                              pc.setDeleteId(selectedCanvasProject.id);
                              pc.setConfirmOpen(true);
                            }
                          }}
                        >
                          <RiDeleteBin6Line className="text-xl" />
                          Eliminar
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              ) : null}
            </>
          ) : (
            <EmptyState
              icon={<RiStackFill className="text-5xl text-slate-300" />}
              title="Selecciona un proyecto o crea uno nuevo"
              description="El detalle aparece aquí con el resumen, los alumnos, el seguimiento y los ajustes. Mientras tanto, mantenemos el lienzo limpio para evitar mensajes de contexto roto."
              actionLabel="Crear proyecto"
              onAction={openNewProject}
              className="min-h-[420px] border-slate-200 bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.08),_transparent_38%),linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.98))]"
            />
          )}
        </section>
      </div>

      {/* Modal de Previsualización de Código */}
      <CodePreviewModal
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        title="Explorador de Suite"
        subtitle="Previsualizando contenido del .zip de evaluación"
        isLoading={isLoadingPreview}
        files={previewFiles}
      />

      <DangerConfirmModal
        open={pc.confirmOpen}
        title="Confirmar eliminación permanente"
        description={`Esta acción no se puede deshacer. Se eliminarán de forma permanente todos los datos asociados al proyecto «${pc.selectedProject?.title ?? pc.deleteId}», incluyendo asignaciones, entregas y evaluaciones.`}
        confirmWord="DELETE"
        onCancel={() => pc.setConfirmOpen(false)}
        onConfirm={() => pc.executeDelete()}
      />
    </div>
  );
}



