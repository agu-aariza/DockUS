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
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-100 text-slate-500">
            <RiSettings4Line className="text-lg" />
          </div>
        }
      >
        <div className="flex flex-col gap-6 xl:flex-row">
          <div className="flex-1">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              <Button
                variant="secondary"
                className="justify-start"
                onClick={onRefreshAssignments}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-50 text-slate-500">
                  <RiRefreshLine />
                </span>
                Sincronizar asignaciones
              </Button>
              <Button
                variant="secondary"
                className="justify-start"
                onClick={onFetchTestSuite}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-50 text-slate-500">
                  <RiTestTubeLine />
                </span>
                Recuperar suite docente
              </Button>
              <Button
                variant="secondary"
                className="justify-start"
                onClick={onOpenMonitoring}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-50 text-slate-500">
                  <RiBarChart2Line />
                </span>
                Ver seguimiento
              </Button>
            </div>
          </div>

          <div className="flex items-end xl:w-56 xl:shrink-0 xl:border-l xl:border-app-border xl:pl-6">
            <Button variant="danger" className="w-full justify-start" onClick={onDelete}>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-red-50 text-red-600">
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
          <Button variant="primary" onClick={openNewProject}>
            <RiFolderAddLine /> Nuevo Proyecto
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="flex flex-col h-full overflow-hidden">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Catálogo</p>
              <h3 className="text-sm font-semibold text-slate-900">
                Proyectos
              </h3>
            </div>
            <span className="flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-accent px-2 text-xs font-medium text-white">
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
              className="w-full justify-center"
              onClick={() => void pc.refreshProjects("Catálogo actualizado.")}
              disabled={pc.loadingProjects}
            >
              {pc.loadingProjects ? <RiLoader4Line className="animate-spin" /> : <RiRefreshLine />}
              Actualizar catálogo
            </Button>
          </div>

          <div className="mt-6 flex-1 overflow-y-auto space-y-2 pr-1 -mr-1 custom-scrollbar">
            {pc.loadingProjects ? (
              <>
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </>
            ) : visibleProjects.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/50 px-4 py-10 text-center">
                <RiFoldersLine className="mx-auto text-2xl text-slate-400 mb-2" />
                <p className="text-xs font-medium text-slate-500">No se encontraron proyectos</p>
              </div>
            ) : (
              visibleProjects.map((project) => {
                const isSelected =
                  detailMode === "selected-project" &&
                  pc.selectedProjectId === project.id;

                return (
                  <button
                    key={project.id}
                    className={`group w-full rounded-lg border p-4 text-left transition-colors relative ${isSelected
                      ? "border-primary bg-primary-subtle"
                      : "border-app-border bg-white hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    onClick={() => openProject(project.id)}
                  >
                    <div className="flex items-start justify-between gap-3 relative">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <RiFoldersLine className={isSelected ? "text-primary" : "text-slate-400 group-hover:text-slate-500"} />
                          <span className={`line-clamp-1 text-sm font-semibold ${isSelected ? "text-primary" : "text-slate-900"}`}>
                            {project.title}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 line-clamp-1">
                          {project.expectedType || "Sin stack definido"}
                        </div>
                      </div>
                      <RiArrowRightSLine className={`text-lg transition-transform ${isSelected ? "text-primary translate-x-0.5" : "text-slate-300 group-hover:text-slate-400"}`} />
                    </div>

                    <div className="mt-4 flex items-center justify-between relative">
                      <div className="flex items-center gap-3">
                        <span className={isSelected ? "text-white" : ""}>
                          {isSelected ? (
                            <span className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-xs font-medium text-white">
                              {STATUS_LABEL[project.status]}
                            </span>
                          ) : (
                            <ProjectStatusPill status={project.status} />
                          )}
                        </span>

                        {project.teachers && project.teachers.length > 0 && (
                          <div className="flex -space-x-1.5">
                            {project.teachers.slice(0, 3).map((teacher) => (
                              <div
                                key={teacher.id}
                                className={`h-5 w-5 rounded-full border-2 flex items-center justify-center text-[7px] font-bold uppercase ${isSelected ? 'border-primary-subtle bg-primary text-white' : 'border-white bg-slate-100 text-slate-600'
                                  }`}
                                title={`${teacher.firstName} ${teacher.lastName}`}
                              >
                                {teacher.firstName[0]}{teacher.lastName[0]}
                              </div>
                            ))}
                            {project.teachers.length > 3 && (
                              <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center text-[7px] font-bold ${isSelected ? 'border-primary-subtle bg-primary/80 text-white' : 'border-white bg-slate-50 text-slate-500'
                                }`}>
                                +{project.teachers.length - 3}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <RiTeamFill className={isSelected ? "text-primary/40" : "text-slate-300"} />
                        <span className="text-xs text-slate-400">
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
              description="Define el contrato académico, la ventana temporal y el tipo esperado para que el builder y el seguimiento sean coherentes desde el primer momento."
              headerAction={
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setDetailMode("selected-project");
                    setActiveSubTab("catalog");
                  }}
                >
                  Volver al lienzo
                </Button>
              }
            >
              <form className="space-y-6" onSubmit={pc.handleCreate}>
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Título del proyecto</label>
                    <input
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                      required
                      value={pc.createForm.title}
                      onChange={(e) => pc.setCreateForm(prev => ({ ...prev, title: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Estado</label>
                    <select
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
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
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Contexto académico</label>
                  <textarea
                    className="w-full min-h-[140px] rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                    placeholder="Describe objetivos, entregables, criterios y notas operativas."
                    value={pc.createForm.contextAcademico}
                    onChange={(e) => pc.setCreateForm(prev => ({ ...prev, contextAcademico: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Intentos máximos por alumno</label>
                    <input
                      type="number"
                      min="1"
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                      value={pc.createForm.maxDeliveriesPerStudent}
                      onChange={(e) => pc.setCreateForm(prev => ({ ...prev, maxDeliveriesPerStudent: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Tipo esperado</label>
                    <input
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                      placeholder="CLI, Flask, FastAPI, Django simple..."
                      value={pc.createForm.expectedType}
                      onChange={(e) => pc.setCreateForm(prev => ({ ...prev, expectedType: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Abre entregas en</label>
                    <input
                      type="datetime-local"
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                      value={pc.createForm.opensAt}
                      onChange={(e) => pc.setCreateForm(prev => ({ ...prev, opensAt: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Cierra entregas en</label>
                    <input
                      type="datetime-local"
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                      value={pc.createForm.closesAt}
                      onChange={(e) => pc.setCreateForm(prev => ({ ...prev, closesAt: e.target.value }))}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Salida esperada (Oracle)</label>
                  <textarea
                    className="w-full min-h-[120px] rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 placeholder:text-slate-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                    placeholder="Pega aquí la salida esperada para que el evaluador compare stdout/stderr."
                    value={pc.createForm.expectedOutput}
                    onChange={(e) => pc.setCreateForm(prev => ({ ...prev, expectedOutput: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Instrucciones de rúbrica</label>
                  <textarea
                    className="w-full min-h-[160px] rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                    placeholder="Indica los criterios docentes y el comportamiento esperado de la nota final."
                    value={pc.createForm.rubricInstructions}
                    onChange={(e) => pc.setCreateForm(prev => ({ ...prev, rubricInstructions: e.target.value }))}
                  />
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 pt-6 border-t border-app-border">
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700">Asignar Grupos Académicos</label>
                      <p className="text-xs text-slate-500 mt-1">Los alumnos de los grupos seleccionados serán matriculados automáticamente.</p>
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
                            className={`flex items-center justify-between p-3 rounded-lg border text-left transition-colors ${isSelected
                                ? "border-accent bg-accent-subtle"
                                : "border-app-border bg-white hover:border-slate-300 hover:bg-slate-50"
                              }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`flex h-9 w-9 items-center justify-center rounded-md ${isSelected ? "bg-accent text-white" : "bg-slate-100 text-slate-500"
                                }`}>
                                <RiGroupLine />
                              </div>
                              <div>
                                <p className={`text-sm font-medium ${isSelected ? "text-accent" : "text-slate-900"}`}>{group.name}</p>
                                <p className="text-xs text-slate-500">{group.code || 'Sin código'}</p>
                              </div>
                            </div>
                            {isSelected && <RiCheckFill className="text-accent text-lg" />}
                          </button>
                        );
                      })}
                      {pc.groups.length === 0 && (
                        <div className="p-6 text-center rounded-lg bg-slate-50 border border-dashed border-slate-300">
                          <RiGroupLine className="mx-auto text-2xl text-slate-400 mb-2" />
                          <p className="text-sm text-slate-500">No hay grupos creados todavía.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700">Suite de Evaluación Inicial</label>
                      <p className="text-xs text-slate-500 mt-1">Sube el archivo .zip con los tests docentes para este proyecto.</p>
                    </div>

                    <div
                      className={`relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition-colors h-[300px] ${pc.createForm.suiteFile
                          ? "bg-emerald-50 border-emerald-200"
                          : "bg-slate-50 border-slate-300 hover:border-slate-400"
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

                      <div className={`mb-4 flex h-14 w-14 items-center justify-center rounded-lg transition-colors ${pc.createForm.suiteFile ? "bg-emerald-500 text-white" : "bg-white text-slate-400 border border-slate-200"
                        }`}>
                        {pc.createForm.suiteFile ? <RiCheckFill className="text-2xl" /> : <RiFolderUploadLine className="text-2xl" />}
                      </div>

                      {pc.createForm.suiteFile ? (
                        <>
                          <h5 className="text-sm font-semibold text-emerald-900">{pc.createForm.suiteFile.name}</h5>
                          <p className="mt-1 text-xs text-emerald-700">{(pc.createForm.suiteFile.size / 1024).toFixed(1)} KB listo para subir</p>
                          <button
                            type="button"
                            className="mt-4 text-xs font-medium text-red-700 hover:underline"
                            onClick={() => pc.setCreateForm(prev => ({ ...prev, suiteFile: null }))}
                          >
                            Quitar archivo
                          </button>
                        </>
                      ) : (
                        <>
                          <h5 className="text-sm font-semibold text-slate-900">Seleccionar Suite (.zip)</h5>
                          <p className="mt-1 text-xs text-slate-500">Haz clic para buscar en tu equipo</p>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="mt-4"
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
            </SectionCard>
          ) : selectedCanvasProject ? (
            <>
              <Card>
                <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1 pr-0 lg:pr-6">
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <ProjectStatusPill status={selectedCanvasProject.status} />
                      <StatusBadge tone="info">
                        {selectedCanvasProject.maxDeliveriesPerStudent} INTENTOS
                      </StatusBadge>
                    </div>

                    <h3 className="truncate text-lg font-semibold text-slate-900">
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
                <Card>
                  <ProgressDashboard
                    session={session}
                    selectedProjectId={selectedCanvasProject.id}
                    embedded
                  />
                </Card>
              ) : null}

              {activeSubTab === "config" ? (
                <div className="space-y-5">
                  <nav className="sticky top-0 z-10 -mx-1 flex flex-wrap gap-2 rounded-lg border border-app-border bg-white/95 px-3 py-2 backdrop-blur-sm">
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
                        className="rounded-md border border-app-border bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-primary/40 hover:bg-primary-subtle hover:text-primary"
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
                          <label className="text-sm font-medium text-slate-700">Título del proyecto</label>
                          <input
                            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                            required
                            value={pc.editForm.title}
                            onChange={e => pc.setEditForm(prev => ({ ...prev, title: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-sm font-medium text-slate-700">Estado operativo</label>
                          <select
                            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                            value={pc.editForm.status}
                            onChange={e => pc.setEditForm(prev => ({ ...prev, status: e.target.value as ProjectStatus }))}
                          >
                            <option value="DRAFT">BORRADOR (No visible para alumnos)</option>
                            <option value="ACTIVE">ACTIVO (Visible y entregable)</option>
                            <option value="ARCHIVED">ARCHIVADO (Solo lectura)</option>
                          </select>
                        </div>
                        <div className="space-y-1.5 lg:col-span-2">
                          <label className="text-sm font-medium text-slate-700">Contexto académico y objetivos</label>
                          <textarea
                            className="w-full min-h-[120px] rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                            placeholder="Describe qué deben aprender y entregar los alumnos..."
                            value={pc.editForm.contextAcademico}
                            onChange={e => pc.setEditForm(prev => ({ ...prev, contextAcademico: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-sm font-medium text-slate-700">Tipo de stack esperado</label>
                          <input
                            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                            placeholder="Ej. FastAPI + PostgreSQL"
                            value={pc.editForm.expectedType}
                            onChange={e => pc.setEditForm(prev => ({ ...prev, expectedType: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-1.5 lg:col-span-2">
                          <label className="text-sm font-medium text-slate-700">Salida esperada (Oracle)</label>
                          <textarea
                            className="w-full min-h-[100px] rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 placeholder:text-slate-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                            placeholder="Pega aquí la salida exacta que esperas que el programa imprima..."
                            value={pc.editForm.expectedOutput}
                            onChange={e => pc.setEditForm(prev => ({ ...prev, expectedOutput: e.target.value }))}
                          />
                          <p className="text-xs text-slate-400">El LLM comparará la salida real con este texto para verificar la corrección.</p>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-sm font-medium text-slate-700">Intentos por alumno</label>
                          <input
                            type="number"
                            min="1"
                            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
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
                          <label className="text-sm font-medium text-slate-700">Apertura de entregas</label>
                          <input
                            type="datetime-local"
                            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                            value={pc.editForm.opensAt}
                            onChange={e => pc.setEditForm(prev => ({ ...prev, opensAt: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-sm font-medium text-slate-700">Cierre de entregas</label>
                          <input
                            type="datetime-local"
                            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                            value={pc.editForm.closesAt}
                            onChange={e => pc.setEditForm(prev => ({ ...prev, closesAt: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-1.5 lg:col-span-2">
                          <label className="text-sm font-medium text-slate-700">Instrucciones de la rúbrica</label>
                          <textarea
                            className="w-full min-h-[140px] rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
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
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">
                              Añadir Colaborador
                            </label>
                            <VisualPicker
                              options={pc.allTeachers
                                .filter(t => !selectedCanvasProject.teachers?.some(st => st.id === t.id))
                                .map(teacher => ({
                                  id: teacher.id,
                                  label: `${teacher.firstName} ${teacher.lastName}`,
                                  description: teacher.email,
                                  icon: <div className="h-6 w-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500 uppercase">
                                    {teacher.firstName[0]}{teacher.lastName[0]}
                                  </div>
                                }))
                              }
                              value={null}
                              onSelect={(id) => pc.handleAddTeacher(selectedCanvasProject.id, id)}
                              placeholder="Buscar profesor por nombre o email..."
                            />
                          </div>
                          <div className="px-3 py-2 bg-primary-subtle rounded-md border border-primary/10 text-primary text-xs font-medium h-10 flex items-center shrink-0">
                            <RiInformationFill className="mr-1.5" />
                            {pc.allTeachers.filter(t => !selectedCanvasProject.teachers?.some(st => st.id === t.id)).length} disponibles
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {selectedCanvasProject.teachers?.map((teacher) => (
                            <div
                              key={teacher.id}
                              className="group flex items-center justify-between p-3 rounded-lg border border-app-border bg-slate-50 hover:bg-white hover:border-slate-300 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-md bg-primary-subtle flex items-center justify-center text-xs font-bold text-primary">
                                  {teacher.firstName[0]}{teacher.lastName[0]}
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-slate-900">{teacher.firstName} {teacher.lastName}</p>
                                  <p className="text-xs text-slate-500">{teacher.email}</p>
                                </div>
                              </div>

                              {selectedCanvasProject.teachers!.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => pc.handleRemoveTeacher(selectedCanvasProject.id, teacher.id)}
                                  className="p-1.5 rounded-md text-slate-400 hover:text-red-700 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity focus-visible:ring-2 focus-visible:ring-red-400/50 focus-visible:outline-none"
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
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200">
                              <RiCheckFill className="text-2xl" />
                            </div>
                            <div className="space-y-0.5">
                              <p className="text-sm font-semibold text-slate-900">{pc.testSuiteResult.logicalName}</p>
                              <div className="flex items-center gap-2 text-xs text-slate-500">
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
                            >
                              <RiEyeLine />
                              Ver tests
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={handleDownloadSuite}
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
                            >
                              <RiFolderUploadLine />
                              {isUploadingSuite ? "Subiendo..." : "Reemplazar Suite"}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50/50 py-12 px-6 text-center">
                          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-400 border border-slate-200">
                            <RiFolderUploadLine className="text-2xl" />
                          </div>
                          <h5 className="text-sm font-semibold text-slate-900">No hay suite técnica configurada</h5>
                          <p className="mt-1 mb-5 max-w-sm text-xs text-slate-500">
                            Para evaluar automáticamente las entregas, sube una suite de tests compatible con <span className="font-medium text-slate-900">pytest</span>.
                          </p>
                          <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            disabled={isUploadingSuite}
                            onClick={() => document.getElementById('suite-upload')?.click()}
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
                      <div className="text-sm text-slate-500">
                        Última modificación detectada: <span className="font-medium text-slate-900">Hace unos momentos</span>
                      </div>
                      <div className="flex flex-wrap gap-3 w-full sm:w-auto">
                        <Button
                          type="submit"
                          variant="primary"
                          className="flex-1 sm:flex-none"
                        >
                          <RiCheckFill />
                          Guardar configuración
                        </Button>
                        <Button
                          type="button"
                          variant="danger"
                          className="flex-1 sm:flex-none"
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
