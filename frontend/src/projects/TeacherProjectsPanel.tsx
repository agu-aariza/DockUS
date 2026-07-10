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
  RiArrowRightSLine,
  RiBarChart2Line,
  RiCalendarScheduleLine,
  RiRefreshLine,
  RiTeamFill,
  RiCloseLine,
  RiCheckFill,
  RiSparkling2Line,
  RiSettings4Line,
  RiTestTubeLine,
  RiDeleteBin6Line,
  RiGroupLine,
  RiInformationFill,
  RiFoldersLine,
  RiLayoutGridFill,
  RiLoader4Line,
  RiFolderAddLine,
  RiFileDownloadLine,
  RiEyeLine,
  RiTimeLine,
  RiStackFill,
  RiFolderUploadLine,
} from "react-icons/ri";
import { EmptyState } from "../shared/components/EmptyState";
import { SkeletonCard } from "../shared/components/Skeleton";
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
import { StatusBadge } from "../shared/components/ui/StatusBadge";
import { SearchInput } from "../shared/components/ui/SearchInput";
import { Card, SectionCard } from "../shared/components/ui/Layout";

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

const STATUS_TONE: Record<ProjectStatus, Parameters<typeof StatusBadge>[0]["tone"]> = {
  DRAFT: "draft",
  ACTIVE: "active",
  ARCHIVED: "closed",
};

function formatOptionalDate(value?: string | null): string {
  return value ? new Date(value).toLocaleString("es-ES") : "Sin definir";
}

function ProjectStatusPill({ status }: { status: ProjectStatus }) {
  return (
    <StatusBadge tone={STATUS_TONE[status]}>
      {STATUS_LABEL[status]}
    </StatusBadge>
  );
}

function ProjectOverview({
  project,
  assignmentCount,
  preparedStudentCount,
  onOpenMonitoring,
  onRefreshAssignments,
  onFetchTestSuite,
  onDelete,
}: {
  project: NonNullable<ReturnType<typeof useProjectManagement>["selectedProject"]>;
  assignmentCount: number;
  preparedStudentCount: number;
  onOpenMonitoring: () => void;
  onRefreshAssignments: () => void;
  onFetchTestSuite: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="space-y-6">
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

      <SectionCard
        title="Control Operativo"
        description="Operaciones de gestión"
        headerAction={
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100/80 text-slate-500 border border-slate-200/40 shadow-sm">
            <RiSettings4Line className="text-lg" />
          </div>
        }
      >
        <div className="flex flex-col gap-6 xl:flex-row">
          <div className="flex-1">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              <Button
                variant="secondary"
                className="justify-start shadow-sm hover:shadow"
                onClick={onRefreshAssignments}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100/50 border border-slate-200/40 text-slate-600">
                  <RiRefreshLine />
                </span>
                Sincronizar asignaciones
              </Button>
              <Button
                variant="secondary"
                className="justify-start shadow-sm hover:shadow"
                onClick={onFetchTestSuite}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100/50 border border-slate-200/40 text-slate-600">
                  <RiTestTubeLine />
                </span>
                Recuperar suite docente
              </Button>
              <Button
                variant="secondary"
                className="justify-start shadow-sm hover:shadow"
                onClick={onOpenMonitoring}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100/50 border border-slate-200/40 text-slate-600">
                  <RiBarChart2Line />
                </span>
                Ver seguimiento
              </Button>
            </div>
          </div>

          <div className="flex items-end xl:w-56 xl:shrink-0 xl:border-l xl:border-app-border xl:pl-6">
            <Button variant="danger" className="w-full justify-start shadow-sm" onClick={onDelete}>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-100/60 border border-red-200/40 text-red-600">
                <RiDeleteBin6Line />
              </span>
              Eliminar proyecto
            </Button>
          </div>
        </div>
      </SectionCard>
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
  const [, setSelectedPreviewFile] = useState<number>(0);

  useNoticeToasts(
    [pc.projectNotice, pc.editorNotice, pc.assignmentNotice, pc.suiteNotice],
    "Proyectos",
  );

  useEffect(() => {
    if (!selection.projectId) {
      if (pc.selectedProjectId) {
        pc.setSelectedProjectId("");
      }
      // Preserve the new-project creation mode when the workspace is empty.
      if (detailMode !== "selected-project" && detailMode !== "new-project") {
        setDetailMode("selected-project");
      }
    } else if (pc.projects?.data) {
      const exists = pc.projects.data.some(p => p.id === selection.projectId);
      if (exists && pc.selectedProjectId !== selection.projectId) {
        pc.setSelectedProjectId(selection.projectId);
        setDetailMode("selected-project");
      }
    }
  }, [selection.projectId, pc.projects?.data, pc.selectedProjectId, detailMode]);

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
        .some((value) => value?.toLowerCase().includes(normalized)),
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
      expectedOutput: "",
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
    const proj = pc.projects?.data.find(p => p.id === projectId);
    if (proj) {
      setProject(proj.id, proj.title);
    }
  };

  const handleDownloadSuite = async () => {
    if (!pc.testSuiteResult || typeof pc.testSuiteResult === 'string' || !('id' in pc.testSuiteResult)) return;
    try {
      const { storageApi } = await import("../shared/api/services");
      const { downloadUrl } = await storageApi.createDownloadUrl(pc.testSuiteResult.id);

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
    <div className="space-y-6">
      <PageHeader
        title="Gestión de Proyectos"
        subtitle="Gestión estratégica de proyectos académicos: orquestación de asignaciones, seguimiento de progreso y auditoría de calidad."
        icon={<RiFoldersLine />}
        badge={projects.length.toString()}
        actions={
          <Button variant="primary" onClick={openNewProject} className="shadow-sm">
            <RiFolderAddLine /> Nuevo Proyecto
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="flex flex-col h-full overflow-hidden p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Catálogo</p>
              <h3 className="text-sm font-bold text-slate-900">
                Proyectos
              </h3>
            </div>
            <span className="flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-white shadow-sm">
              {projects.length}
            </span>
          </div>

          <div className="space-y-3">
            <SearchInput
              value={projectSearch}
              onChange={setProjectSearch}
              placeholder="Buscar proyecto..."
            />
            <Button
              variant="secondary"
              className="w-full justify-center shadow-sm"
              onClick={() => void pc.refreshProjects("Catálogo actualizado.")}
              disabled={pc.loadingProjects}
            >
              {pc.loadingProjects ? <RiLoader4Line className="animate-spin" /> : <RiRefreshLine />}
              Actualizar catálogo
            </Button>
          </div>

          <div className="mt-6 flex-1 overflow-y-auto space-y-2.5 pr-1 -mr-1 custom-scrollbar">
            {pc.loadingProjects ? (
              <>
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </>
            ) : visibleProjects.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/30 px-4 py-10 text-center">
                <RiFoldersLine className="mx-auto text-3xl text-slate-400 mb-2" />
                <p className="text-xs font-bold text-slate-500">No se encontraron proyectos</p>
              </div>
            ) : (
              visibleProjects.map((project) => {
                const isSelected =
                  detailMode === "selected-project" &&
                  pc.selectedProjectId === project.id;

                return (
                  <button
                    key={project.id}
                    className={`group w-full rounded-xl border p-4 text-left transition-all duration-200 relative ${isSelected
                      ? "border-primary/50 bg-gradient-to-r from-primary/5 to-primary/10 shadow-sm ring-1 ring-primary/10"
                      : "border-app-border bg-white hover:border-slate-300 hover:-translate-y-[2px] hover:shadow-md"
                      }`}
                    onClick={() => openProject(project.id)}
                  >
                    <div className="flex items-start justify-between gap-3 relative">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <RiFoldersLine className={`text-base transition-colors duration-200 ${isSelected ? "text-primary" : "text-slate-400 group-hover:text-slate-500"}`} />
                          <span className={`line-clamp-1 text-sm font-bold transition-colors duration-200 ${isSelected ? "text-primary" : "text-slate-900"}`}>
                            {project.title}
                          </span>
                        </div>
                        <div className="text-xs font-medium text-slate-400 line-clamp-1">
                          {project.expectedType || "Sin stack definido"}
                        </div>
                      </div>
                      <RiArrowRightSLine className={`text-lg transition-transform duration-200 ${isSelected ? "text-primary translate-x-0.5" : "text-slate-300 group-hover:text-slate-400 group-hover:translate-x-0.5"}`} />
                    </div>

                    <div className="mt-4 flex items-center justify-between relative">
                      <div className="flex items-center gap-3">
                        <span>
                          {isSelected ? (
                            <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary shadow-sm">
                              {STATUS_LABEL[project.status]}
                            </span>
                          ) : (
                            <ProjectStatusPill status={project.status} />
                          )}
                        </span>

                        {project.teachers && project.teachers.length > 0 && (
                          <div className="flex -space-x-2">
                            {project.teachers.slice(0, 3).map((teacher) => (
                              <div
                                key={teacher.id}
                                className={`h-6 w-6 rounded-full border-2 flex items-center justify-center text-[8px] font-bold uppercase transition-all duration-200 ${
                                  isSelected 
                                    ? 'border-blue-100 bg-gradient-to-tr from-primary to-blue-400 text-white shadow-sm' 
                                    : 'border-white bg-gradient-to-tr from-slate-100 to-slate-50 text-slate-600 shadow-sm group-hover:border-slate-50'
                                }`}
                                title={`${teacher.firstName} ${teacher.lastName}`}
                              >
                                {teacher.firstName[0]}{teacher.lastName[0]}
                              </div>
                            ))}
                            {project.teachers.length > 3 && (
                              <div className={`h-6 w-6 rounded-full border-2 flex items-center justify-center text-[8px] font-bold shadow-sm ${
                                isSelected 
                                  ? 'border-blue-100 bg-gradient-to-tr from-primary/80 to-blue-500/80 text-white' 
                                  : 'border-white bg-slate-50 text-slate-500'
                                }`}>
                                +{project.teachers.length - 3}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <RiTeamFill className={`text-base ${isSelected ? "text-primary/40" : "text-slate-300"}`} />
                        <span className="text-xs font-medium text-slate-400">
                          {project.maxDeliveriesPerStudent} {project.maxDeliveriesPerStudent === 1 ? 'intento' : 'intentos'}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </Card>

        <section className="min-w-0 space-y-5">
          {detailMode === "new-project" ? (
            <SectionCard
              title="Parametrización de Práctica Académica"
              description="Define el contrato académico, la ventana temporal y el tipo esperado para que el evaluador y el seguimiento sean coherentes desde el primer momento."
              headerAction={
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setDetailMode("selected-project");
                    setActiveSubTab("catalog");
                  }}
                  className="shadow-sm"
                >
                  Volver al lienzo
                </Button>
              }
            >
              <form className="space-y-6" onSubmit={pc.handleCreate}>
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">Título del proyecto</label>
                    <input
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10 hover:border-slate-300 transition-all"
                      required
                      value={pc.createForm.title}
                      onChange={(e) => pc.setCreateForm(prev => ({ ...prev, title: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">Estado</label>
                    <select
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm text-slate-900 focus:bg-white focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10 hover:border-slate-300 transition-all"
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
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">Contexto académico</label>
                  <textarea
                    className="w-full min-h-[140px] rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10 hover:border-slate-300 transition-all"
                    placeholder="Describe objetivos, entregables, criterios y notas operativas."
                    value={pc.createForm.contextAcademico}
                    onChange={(e) => pc.setCreateForm(prev => ({ ...prev, contextAcademico: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">Intentos máximos por alumno</label>
                    <input
                      type="number"
                      min="1"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 focus:bg-white focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10 hover:border-slate-300 transition-all"
                      value={pc.createForm.maxDeliveriesPerStudent}
                      onChange={(e) => pc.setCreateForm(prev => ({ ...prev, maxDeliveriesPerStudent: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">Tipo esperado</label>
                    <input
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10 hover:border-slate-300 transition-all"
                      placeholder="CLI, Flask, FastAPI, Django simple..."
                      value={pc.createForm.expectedType}
                      onChange={(e) => pc.setCreateForm(prev => ({ ...prev, expectedType: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">Abre entregas en</label>
                    <input
                      type="datetime-local"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 focus:bg-white focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10 hover:border-slate-300 transition-all"
                      value={pc.createForm.opensAt}
                      onChange={(e) => pc.setCreateForm(prev => ({ ...prev, opensAt: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">Cierra entregas en</label>
                    <input
                      type="datetime-local"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 focus:bg-white focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10 hover:border-slate-300 transition-all"
                      value={pc.createForm.closesAt}
                      onChange={(e) => pc.setCreateForm(prev => ({ ...prev, closesAt: e.target.value }))}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">Salida esperada (Oracle)</label>
                  <textarea
                    className="w-full min-h-[120px] rounded-xl border border-slate-200 bg-slate-50/50 p-4 font-mono text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10 hover:border-slate-300 transition-all"
                    placeholder="Pega aquí la salida esperada para que el evaluador compare stdout/stderr."
                    value={pc.createForm.expectedOutput}
                    onChange={(e) => pc.setCreateForm(prev => ({ ...prev, expectedOutput: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">Instrucciones de rúbrica</label>
                  <textarea
                    className="w-full min-h-[160px] rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10 hover:border-slate-300 transition-all"
                    placeholder="Indica los criterios docentes y el comportamiento esperado de la nota final."
                    value={pc.createForm.rubricInstructions}
                    onChange={(e) => pc.setCreateForm(prev => ({ ...prev, rubricInstructions: e.target.value }))}
                  />
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 pt-6 border-t border-app-border">
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-500">Asignar Grupos Académicos</label>
                      <p className="text-[11px] text-slate-400 mt-1">Los alumnos de los grupos seleccionados serán matriculados automáticamente.</p>
                    </div>
                    <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto pr-1">
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
                            className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all duration-200 ${isSelected
                                ? "border-primary/50 bg-gradient-to-r from-primary/5 to-primary/10 shadow-sm ring-1 ring-primary/10"
                                : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                              }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${isSelected ? "bg-primary text-white shadow-sm shadow-primary/20" : "bg-slate-100 text-slate-500"
                                }`}>
                                <RiGroupLine />
                              </div>
                              <div>
                                <p className={`text-sm font-semibold ${isSelected ? "text-primary" : "text-slate-900"}`}>{group.name}</p>
                                <p className="text-xs text-slate-500">{group.code || 'Sin código'}</p>
                              </div>
                            </div>
                            {isSelected && <RiCheckFill className="text-primary text-lg" />}
                          </button>
                        );
                      })}
                      {pc.groups.length === 0 && (
                        <div className="p-6 text-center rounded-xl bg-slate-50 border border-dashed border-slate-300">
                          <RiGroupLine className="mx-auto text-2xl text-slate-400 mb-2" />
                          <p className="text-sm text-slate-500">No hay grupos creados todavía.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-500">Suite de Evaluación Inicial</label>
                      <p className="text-[11px] text-slate-400 mt-1">Sube el archivo .zip con los tests docentes para este proyecto.</p>
                    </div>

                    <div
                      className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition-all duration-300 h-[300px] ${pc.createForm.suiteFile
                          ? "bg-emerald-50/30 border-emerald-300"
                          : "bg-slate-50/40 border-slate-200 hover:border-slate-300/80"
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

                      <div className={`mb-4 flex h-14 w-14 items-center justify-center rounded-2xl transition-all duration-300 shadow-sm ${pc.createForm.suiteFile ? "bg-emerald-500 text-white shadow-emerald-500/20" : "bg-white text-slate-400 border border-slate-200/60"
                        }`}>
                        {pc.createForm.suiteFile ? <RiCheckFill className="text-2xl" /> : <RiFolderUploadLine className="text-2xl" />}
                      </div>

                      {pc.createForm.suiteFile ? (
                        <>
                          <h5 className="text-sm font-bold text-emerald-900">{pc.createForm.suiteFile.name}</h5>
                           <p className="mt-1 text-xs text-emerald-700">{(pc.createForm.suiteFile.size / 1024).toFixed(1)} KB listo para subir</p>
                          <button
                            type="button"
                            className="mt-4 text-xs font-semibold text-red-600 hover:underline"
                            onClick={() => pc.setCreateForm(prev => ({ ...prev, suiteFile: null }))}
                          >
                            Quitar archivo
                          </button>
                        </>
                      ) : (
                        <>
                          <h5 className="text-sm font-bold text-slate-900">Seleccionar Suite (.zip)</h5>
                          <p className="mt-1 text-xs text-slate-500">Haz clic para buscar en tu equipo</p>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="mt-4 shadow-sm"
                            onClick={() => document.getElementById('new-project-suite')?.click()}
                          >
                            Explorar archivos
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 border-t border-app-border pt-5">
                  <Button type="submit" variant="primary" className="shadow-sm">
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
                    className="shadow-sm"
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            </SectionCard>
          ) : selectedCanvasProject ? (
            <>
              <Card className="p-5">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1 pr-0 lg:pr-6">
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <ProjectStatusPill status={selectedCanvasProject.status} />
                      <StatusBadge tone="info">
                        {selectedCanvasProject.maxDeliveriesPerStudent} INTENTOS
                      </StatusBadge>
                    </div>

                    <h3 className="truncate text-lg font-bold text-slate-900">
                      {selectedCanvasProject.title}
                    </h3>

                    <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-500 line-clamp-2">
                      {selectedCanvasProject.contextAcademico || "Sin contexto académico definido."}
                    </p>
                  </div>

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
                    />
                  </div>
                </div>
              </Card>

              {activeSubTab === "catalog" ? (
                <ProjectOverview
                  project={selectedCanvasProject}
                  assignmentCount={assignmentCount}
                  preparedStudentCount={preparedStudentCount}
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
                <Card className="p-5">
                  <ProgressDashboard
                    session={session}
                    selectedProjectId={selectedCanvasProject.id}
                    embedded
                  />
                </Card>
              ) : null}

              {activeSubTab === "config" ? (
                <div className="space-y-5">
                  <nav className="sticky top-0 z-10 -mx-1 flex flex-wrap gap-2 rounded-2xl border border-slate-100 bg-white/90 p-2.5 shadow-sm backdrop-blur-md animate-in slide-in-from-top-2 duration-300">
                    {[
                      { id: "section-settings", label: "Ajustes" },
                      { id: "section-plazos", label: "Plazos" },
                      { id: "section-profesores", label: "Profesores" },
                      { id: "section-suite", label: "Suite" },
                    ].map(({ id, label }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() =>
                          document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
                        }
                        className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-600 transition-all hover:border-primary/30 hover:bg-primary-subtle hover:text-primary active:scale-[0.97]"
                      >
                        {label}
                      </button>
                    ))}
                  </nav>
                  <form className="space-y-5" onSubmit={pc.handleUpdate}>
                    <div id="section-settings" className="scroll-mt-20">
                      <SectionCard
                        title="Ajustes Generales"
                        description="Identidad, estado y contexto técnico del proyecto."
                      >
                      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-500">Título del proyecto</label>
                          <input
                            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm text-slate-900 focus:bg-white focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10 hover:border-slate-300 transition-all"
                            required
                            value={pc.editForm.title}
                            onChange={e => pc.setEditForm(prev => ({ ...prev, title: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-500">Estado operativo</label>
                          <select
                            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm text-slate-900 focus:bg-white focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10 hover:border-slate-300 transition-all"
                            value={pc.editForm.status}
                            onChange={e => pc.setEditForm(prev => ({ ...prev, status: e.target.value as ProjectStatus }))}
                          >
                            <option value="DRAFT">BORRADOR (No visible para alumnos)</option>
                            <option value="ACTIVE">ACTIVO (Visible y entregable)</option>
                            <option value="ARCHIVED">ARCHIVADO (Solo lectura)</option>
                          </select>
                        </div>
                        <div className="space-y-1.5 lg:col-span-2">
                          <label className="text-xs font-bold text-slate-500">Contexto académico y objetivos</label>
                          <textarea
                            className="w-full min-h-[120px] rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10 hover:border-slate-300 transition-all"
                            placeholder="Describe qué deben aprender y entregar los alumnos..."
                            value={pc.editForm.contextAcademico}
                            onChange={e => pc.setEditForm(prev => ({ ...prev, contextAcademico: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-500">Tipo de stack esperado</label>
                          <input
                            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10 hover:border-slate-300 transition-all"
                            placeholder="Ej. FastAPI + PostgreSQL"
                            value={pc.editForm.expectedType}
                            onChange={e => pc.setEditForm(prev => ({ ...prev, expectedType: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-1.5 lg:col-span-2">
                          <label className="text-xs font-bold text-slate-500">Salida esperada (Oracle)</label>
                          <textarea
                            className="w-full min-h-[100px] rounded-xl border border-slate-200 bg-slate-50/50 p-4 font-mono text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10 hover:border-slate-300 transition-all"
                            placeholder="Pega aquí la salida exacta que esperas que el programa imprima..."
                            value={pc.editForm.expectedOutput}
                            onChange={e => pc.setEditForm(prev => ({ ...prev, expectedOutput: e.target.value }))}
                          />
                          <p className="text-xs text-slate-400 mt-1">El LLM comparará la salida real con este texto para verificar la corrección.</p>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-500">Intentos por alumno</label>
                          <input
                            type="number"
                            min="1"
                            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm text-slate-900 focus:bg-white focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10 hover:border-slate-300 transition-all"
                            value={pc.editForm.maxDeliveriesPerStudent}
                            onChange={e => pc.setEditForm(prev => ({ ...prev, maxDeliveriesPerStudent: e.target.value }))}
                          />
                        </div>
                      </div>
                      </SectionCard>
                    </div>

                    <div id="section-plazos" className="scroll-mt-20">
                      <SectionCard
                        title="Plazos y Evaluación"
                        description="Define cuándo se entrega y bajo qué criterios se califica."
                      >
                      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-500">Apertura de entregas</label>
                          <input
                            type="datetime-local"
                            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm text-slate-900 focus:bg-white focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10 hover:border-slate-300 transition-all"
                            value={pc.editForm.opensAt}
                            onChange={e => pc.setEditForm(prev => ({ ...prev, opensAt: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-500">Cierre de entregas</label>
                          <input
                            type="datetime-local"
                            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm text-slate-900 focus:bg-white focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10 hover:border-slate-300 transition-all"
                            value={pc.editForm.closesAt}
                            onChange={e => pc.setEditForm(prev => ({ ...prev, closesAt: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-1.5 lg:col-span-2">
                          <label className="text-xs font-bold text-slate-500">Instrucciones de la rúbrica</label>
                          <textarea
                            className="w-full min-h-[140px] rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10 hover:border-slate-300 transition-all"
                            placeholder="Criterios de evaluación, penalizaciones, etc."
                            value={pc.editForm.rubricInstructions}
                            onChange={e => pc.setEditForm(prev => ({ ...prev, rubricInstructions: e.target.value }))}
                          />
                        </div>
                      </div>
                      </SectionCard>
                    </div>

                    <div id="section-profesores" className="scroll-mt-20">
                      <SectionCard
                        title="Equipo Docente"
                        description="Profesores con permisos administrativos."
                      >
                      <div className="space-y-5">
                        <div className="flex flex-col md:flex-row gap-3 items-end">
                          <div className="flex-1 w-full">
                            <label className="block text-xs font-bold text-slate-500 mb-1.5">
                              Añadir Colaborador
                            </label>
                            <VisualPicker
                              options={pc.allTeachers
                                .filter(t => !selectedCanvasProject.teachers?.some(st => st.id === t.id))
                                .map(teacher => ({
                                  id: teacher.id,
                                  label: `${teacher.firstName} ${teacher.lastName}`,
                                  description: teacher.email,
                                  icon: <div className="h-6 w-6 rounded-full bg-gradient-to-tr from-slate-100 to-slate-50 border border-slate-200/40 flex items-center justify-center text-[10px] font-bold text-slate-500 uppercase">
                                    {teacher.firstName[0]}{teacher.lastName[0]}
                                  </div>
                                }))
                              }
                              value={null}
                              onSelect={(id) => pc.handleAddTeacher(selectedCanvasProject.id, id)}
                              placeholder="Buscar profesor por nombre o email..."
                            />
                          </div>
                          <div className="px-3.5 py-2 bg-primary-subtle rounded-xl border border-primary/10 text-primary text-xs font-semibold h-10 flex items-center shrink-0 shadow-sm">
                            <RiInformationFill className="mr-1.5" />
                            {pc.allTeachers.filter(t => !selectedCanvasProject.teachers?.some(st => st.id === t.id)).length} disponibles
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {selectedCanvasProject.teachers?.map((teacher) => (
                            <div
                              key={teacher.id}
                              className="group flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-slate-300 hover:shadow-sm transition-all duration-200"
                            >
                              <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-primary to-blue-400 flex items-center justify-center text-xs font-bold text-white shadow-sm shadow-primary/20">
                                  {teacher.firstName[0]}{teacher.lastName[0]}
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-slate-900">{teacher.firstName} {teacher.lastName}</p>
                                  <p className="text-xs text-slate-400">{teacher.email}</p>
                                </div>
                              </div>

                              {selectedCanvasProject.teachers!.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => pc.handleRemoveTeacher(selectedCanvasProject.id, teacher.id)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all focus-visible:ring-2 focus-visible:ring-red-400/50 focus-visible:outline-none"
                                  title="Eliminar del equipo"
                                  aria-label="Eliminar del equipo"
                                >
                                  <RiCloseLine size={18} />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                      </SectionCard>
                    </div>

                    <div id="section-suite" className="scroll-mt-20">
                      <SectionCard
                        title="Suite de Evaluación Técnica"
                        description="Tests automáticos para validar las entregas."
                      >
                      {pc.testSuiteResult && 'id' in pc.testSuiteResult ? (
                        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                          <div className="flex items-start gap-4">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-sm shadow-emerald-500/20 border border-emerald-400">
                              <RiCheckFill className="text-2xl" />
                            </div>
                            <div className="space-y-0.5">
                              <p className="text-sm font-bold text-slate-900">{pc.testSuiteResult.logicalName}</p>
                              <div className="flex items-center gap-2 text-xs text-slate-400">
                                <span>{formatBytes(pc.testSuiteResult.sizeBytes)}</span>
                                <span className="h-1 w-1 rounded-full bg-slate-300" />
                                <span>Subido el {new Date(pc.testSuiteResult.createdAt).toLocaleDateString()}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={handleOpenPreview}
                              className="shadow-sm"
                            >
                              <RiEyeLine />
                              Ver tests
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={handleDownloadSuite}
                              className="shadow-sm"
                            >
                              <RiFileDownloadLine />
                              Descargar
                            </Button>
                            <Button
                              type="button"
                              variant="primary"
                              size="sm"
                              disabled={isUploadingSuite}
                              onClick={() => document.getElementById('suite-upload')?.click()}
                              className="shadow-sm"
                            >
                              <RiFolderUploadLine />
                              {isUploadingSuite ? "Subiendo..." : "Reemplazar Suite"}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/30 py-12 px-6 text-center hover:border-slate-300 transition-colors duration-200">
                          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-400 border border-slate-200/60 shadow-sm">
                            <RiFolderUploadLine className="text-2xl" />
                          </div>
                          <h5 className="text-sm font-bold text-slate-900">No hay suite técnica configurada</h5>
                          <p className="mt-1 mb-5 max-w-xs text-xs leading-relaxed text-slate-500">
                            Para evaluar automáticamente las entregas, sube una suite de tests compatible con <span className="font-semibold text-slate-900">pytest</span>.
                          </p>
                          <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            disabled={isUploadingSuite}
                            onClick={() => document.getElementById('suite-upload')?.click()}
                            className="shadow-sm"
                          >
                            {isUploadingSuite ? (
                              <RiLoader4Line className="animate-spin" />
                            ) : (
                              <RiFolderUploadLine />
                            )}
                            {isUploadingSuite ? "Subiendo archivo..." : "Subir Suite (.zip)"}
                          </Button>
                        </div>
                      )}
                      <input
                        type="file"
                        id="suite-upload"
                        className="hidden"
                        accept=".zip,.tar.gz"
                        onChange={handleFileChange}
                      />
                      </SectionCard>
                    </div>

                    <div className="flex flex-col items-center justify-between gap-4 pt-6 border-t border-app-border sm:flex-row">
                      <div className="text-xs font-semibold text-slate-400">
                        Última modificación detectada: <span className="font-semibold text-slate-900">Hace unos momentos</span>
                      </div>
                      <div className="flex flex-wrap gap-3 w-full sm:w-auto">
                        <Button
                          type="submit"
                          variant="primary"
                          className="flex-1 sm:flex-none shadow-sm"
                        >
                          <RiCheckFill />
                          Guardar configuración
                        </Button>
                        <Button
                          type="button"
                          variant="danger"
                          className="flex-1 sm:flex-none shadow-sm"
                          onClick={() => {
                            if (selectedCanvasProject) {
                              pc.setDeleteId(selectedCanvasProject.id);
                              pc.setConfirmOpen(true);
                            }
                          }}
                        >
                          <RiDeleteBin6Line />
                          Eliminar
                        </Button>
                      </div>
                    </div>
                  </form>
                </div>
              ) : null}
            </>
          ) : (
            <EmptyState
              icon={<RiStackFill className="text-4xl text-slate-400" />}
              title="Selecciona un proyecto o crea uno nuevo"
              description="El detalle aparece aquí con el resumen, los alumnos, el seguimiento y los ajustes. Mientras tanto, mantenemos el lienzo limpio para evitar contexto roto."
              actionLabel="Crear proyecto"
              onAction={openNewProject}
              className="min-h-[420px]"
            />
          )}
        </section>
      </div>

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
