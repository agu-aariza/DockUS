import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { DangerConfirmModal } from "../shared/components/DangerConfirmModal";
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
  RiFileSettingsLine,
  RiFolderChartLine,
  RiFolderUploadLine,
  RiFoldersLine,
  RiLayoutGridFill,
  RiLoader4Line,
  RiSearchLine,
  RiSettings4Line,
  RiSparkling2Line,
  RiStackFill,
  RiTeamFill,
  RiTimeLine,
  RiFolderAddLine,
  RiDeleteBin6Line,
  RiRefreshLine,
  RiTestTubeLine,
} from "react-icons/ri";
import { EmptyState } from "../shared/components/EmptyState";
import {
  ProjectAssignmentManager,
} from "./components/ProjectSubPanels";
import { useNoticeToasts } from "../shared/toast/useNoticeToasts";

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
  DRAFT: "border-slate-200 bg-slate-100 text-slate-700",
  ACTIVE: "border-emerald-200 bg-emerald-50 text-emerald-700",
  ARCHIVED: "border-amber-200 bg-amber-50 text-amber-700",
};

function formatOptionalDate(value?: string | null): string {
  return value ? new Date(value).toLocaleString("es-ES") : "Sin definir";
}

function ProjectStatusPill({ status }: { status: ProjectStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${STATUS_STYLE[status]}`}
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
      <section className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-3">
              <ProjectStatusPill status={project.status} />
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                {project.maxDeliveriesPerStudent} intentos por alumno
              </span>
            </div>
            <h3 className="mt-5 text-3xl font-semibold tracking-tight text-slate-950">
              {project.title}
            </h3>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              {project.contextAcademico || "Define aquí el contexto académico, objetivos y reglas del trabajo para que el panel funcione como ficha operativa del proyecto."}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button className="btn-primary" onClick={onOpenAssignments}>
              <RiTeamFill />
              Gestionar alumnos
            </button>
            <button className="btn-secondary" onClick={onOpenMonitoring}>
              <RiBarChart2Line />
              Ver métricas
            </button>
            <button className="btn-secondary" onClick={onOpenSettings}>
              <RiSettings4Line />
              Ajustes
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-4">
        {[
          {
            label: "Asignados",
            value: assignmentCount,
            helper: "Alumnos activos en el proyecto",
            icon: <RiTeamFill className="text-lg" />,
          },
          {
            label: "Preparados",
            value: preparedStudentCount,
            helper: "Selecciones o emails listos para asignar",
            icon: <RiSparkling2Line className="text-lg" />,
          },
          {
            label: "Apertura",
            value: formatOptionalDate(project.opensAt),
            helper: "Inicio del periodo de entrega",
            icon: <RiCalendarScheduleLine className="text-lg" />,
          },
          {
            label: "Cierre",
            value: formatOptionalDate(project.closesAt),
            helper: "Las entregas tardías quedan marcadas",
            icon: <RiTimeLine className="text-lg" />,
          },
        ].map((metric) => (
          <article
            key={metric.label}
            className="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-center justify-between gap-3 text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-[0.16em]">
                {metric.label}
              </span>
              {metric.icon}
            </div>
            <div className="mt-3 text-lg font-semibold tracking-tight text-slate-950">
              {metric.value}
            </div>
            <p className="mt-2 text-sm leading-5 text-slate-500">{metric.helper}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
                Compatibilidad Python-first
              </h4>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                El builder está optimizado para proyectos Python. Si defines el tipo esperado, el profesorado y el alumno entienden mejor el contrato técnico.
              </p>
            </div>
            <RiFolderChartLine className="text-2xl text-slate-300" />
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {["CLI", "Flask", "FastAPI", "Django simple", "Worker batch", "pyproject.toml"].map((item) => (
              <span
                key={item}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${
                  project.expectedType?.toLowerCase().includes(item.toLowerCase())
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-slate-50 text-slate-700"
                }`}
              >
                {item}
              </span>
            ))}
          </div>
          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
            <strong className="text-slate-900">Tipo esperado:</strong>{" "}
            {project.expectedType || "Aún no definido. Usa Ajustes para describirlo y reducir ambigüedad en las evaluaciones."}
          </div>
          <div className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50 p-4 text-sm leading-6 text-indigo-900">
            La suite docente sigue ejecutándose sobre `pytest` cuando existe, así que este panel deja explícito que la plataforma es Python-first y no promete compatibilidad universal.
          </div>
        </article>

        <article className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
            Acciones rápidas
          </h4>
          <div className="mt-5 space-y-3">
            <button className="btn-secondary w-full justify-start" onClick={onRefreshAssignments}>
              <RiRefreshLine />
              Refrescar asignaciones
            </button>
            <button className="btn-secondary w-full justify-start" onClick={onFetchTestSuite}>
              <RiTestTubeLine />
              Recuperar suite docente
            </button>
            <button className="btn-secondary w-full justify-start" onClick={onOpenMonitoring}>
              <RiBarChart2Line />
              Abrir gradebook y seguimiento
            </button>
            <button className="btn-danger w-full justify-start" onClick={onDelete}>
              <RiDeleteBin6Line />
              Eliminar proyecto
            </button>
          </div>
          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
            <div><strong className="text-slate-900">Ventana de entrega:</strong> {formatOptionalDate(project.opensAt)} → {formatOptionalDate(project.closesAt)}</div>
            <div className="mt-2"><strong className="text-slate-900">Rúbrica:</strong> {project.rubricInstructions || "Pendiente de definición en ajustes."}</div>
          </div>
        </article>
      </section>
    </div>
  );
}

export function TeacherProjectsPanel({ session }: TeacherProjectsPanelProps): JSX.Element {
  const pc = useProjectManagement(session);
  const { selection, setProject, clearWorkspace } = useWorkspace();
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('catalog');
  const [detailMode, setDetailMode] = useState<DetailMode>("selected-project");
  const [assignmentSearch, setAssignmentSearch] = useState("");
  const [projectSearch, setProjectSearch] = useState("");
  const deferredProjectSearch = useDeferredValue(projectSearch);

  useNoticeToasts(
    [pc.projectNotice, pc.editorNotice, pc.assignmentNotice, pc.suiteNotice],
    "Proyectos",
  );

  // Hydrate from context
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

  // Sync context when local selection changes
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

  const selectedCanvasProject =
    detailMode === "new-project" ? null : pc.selectedProject;

  return (
    <div className="space-y-8 animate-fade-in">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="eyebrow">Panel docente</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            Proyectos con contexto, seguimiento y acciones en un único lienzo.
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
            El catálogo, la asignación, el gradebook y los ajustes viven ahora dentro del proyecto seleccionado para evitar doble navegación y estados muertos.
          </p>
        </div>
        <button className="btn-primary" onClick={openNewProject}>
          <RiFolderAddLine />
          Nuevo proyecto
        </button>
      </header>

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Master
              </p>
              <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">
                Proyectos
              </h3>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              {projects.length}
            </span>
          </div>

          <div className="mt-5 space-y-3">
            <label className="relative block">
              <RiSearchLine className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="input-field pl-10"
                placeholder="Busca por título, contexto o stack"
                value={projectSearch}
                onChange={(event) => setProjectSearch(event.target.value)}
              />
            </label>
            <button className="btn-secondary w-full justify-center" onClick={() => void pc.refreshProjects("Listado de proyectos actualizado.")}>
              {pc.loadingProjects ? <RiLoader4Line className="animate-spin" /> : <RiRefreshLine />}
              Refrescar catálogo
            </button>
          </div>

          <div className="mt-5 space-y-3">
            {visibleProjects.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                No hay proyectos que coincidan con el filtro actual.
              </div>
            ) : (
              visibleProjects.map((project) => {
                const isSelected =
                  detailMode === "selected-project" &&
                  pc.selectedProjectId === project.id;

                return (
                  <button
                    key={project.id}
                    className={`w-full rounded-[1.6rem] border px-4 py-4 text-left transition ${
                      isSelected
                        ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                    }`}
                    onClick={() => openProject(project.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <RiFoldersLine className={isSelected ? "text-white/80" : "text-slate-400"} />
                          <span className="line-clamp-2 text-sm font-semibold tracking-tight">
                            {project.title}
                          </span>
                        </div>
                        <div className={`mt-2 text-xs leading-5 ${isSelected ? "text-slate-200" : "text-slate-500"}`}>
                          {project.expectedType || "Proyecto sin stack definido"}
                        </div>
                      </div>
                      <RiArrowRightSLine className={isSelected ? "text-white/60" : "text-slate-300"} />
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                          isSelected
                            ? "border-white/15 bg-white/10 text-white"
                            : STATUS_STYLE[project.status]
                        }`}
                      >
                        {STATUS_LABEL[project.status]}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] ${
                          isSelected ? "bg-white/10 text-white/80" : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {project.maxDeliveriesPerStudent} intentos
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <section className="min-w-0 space-y-5">
          {detailMode === "new-project" ? (
            <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
              <div className="flex flex-col gap-3 border-b border-slate-100 pb-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="eyebrow">Nuevo proyecto</p>
                  <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                    Crea una práctica sin salir del panel
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Define el contrato académico, la ventana temporal y el tipo esperado para que el builder y el seguimiento sean coherentes desde el primer momento.
                  </p>
                </div>
                <button
                  className="btn-secondary"
                  onClick={() => {
                    setDetailMode("selected-project");
                    setActiveSubTab("catalog");
                  }}
                >
                  Volver al lienzo
                </button>
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
                <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-5">
                  <button type="submit" className="btn-primary">
                    <RiFolderAddLine />
                    Crear proyecto
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setDetailMode("selected-project");
                      setActiveSubTab("catalog");
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          ) : selectedCanvasProject ? (
            <>
              <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                  <div className="min-w-0">
                    <p className="eyebrow">Detail canvas</p>
                    <h3 className="mt-2 truncate text-3xl font-semibold tracking-tight text-slate-950">
                      {selectedCanvasProject.title}
                    </h3>
                    <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                      Navega por el proyecto sin salir de contexto: overview, alumnos, métricas y ajustes viven en este mismo lienzo.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: "catalog", label: "Overview", icon: <RiLayoutGridFill /> },
                      { id: "assignments", label: "Assignments", icon: <RiTeamFill /> },
                      { id: "monitoring", label: "Monitoring", icon: <RiBarChart2Line /> },
                      { id: "config", label: "Settings", icon: <RiFileSettingsLine /> },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
                          activeSubTab === tab.id
                            ? "bg-slate-900 text-white"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                        onClick={() => setActiveSubTab(tab.id as SubTab)}
                      >
                        {tab.icon}
                        {tab.label}
                      </button>
                    ))}
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
                  focusedGroup={pc.focusedGroup}
                  groupEnrollments={pc.groupEnrollments ?? []}
                  assignments={pc.assignmentsResult ?? []}
                  selectedStudentIds={pc.selectedStudentIds}
                  bulkStudentEmails={pc.bulkStudentEmails}
                  groupStudentSearch={pc.groupStudentSearch}
                  selectedGroupIds={pc.selectedGroupIds}
                  selectedGroupStudentIds={pc.selectedGroupStudentIds}
                  bulkGroupStudentEmails={pc.bulkGroupStudentEmails}
                  groupForm={pc.groupForm}
                  preparedStudentCount={preparedStudentCount}
                  searchTerm={assignmentSearch}
                  loadingGroups={pc.loadingGroups}
                  assignmentBusy={pc.assignmentBusy}
                  onSearchChange={setAssignmentSearch}
                  onGroupStudentSearchChange={pc.setGroupStudentSearch}
                  onBulkEmailChange={pc.setBulkStudentEmails}
                  onBulkGroupEmailChange={pc.setBulkGroupStudentEmails}
                  onImportCsvFile={(file) => void pc.handleBulkEmailImport(file)}
                  onImportGroupCsvFile={(file) => void pc.handleGroupBulkEmailImport(file)}
                  onSelectionChange={pc.setSelectedStudentIds}
                  onGroupSelectionChange={pc.setSelectedGroupIds}
                  onFocusedGroupChange={pc.setFocusedGroupId}
                  onGroupStudentSelectionChange={pc.setSelectedGroupStudentIds}
                  onGroupFormChange={(patch) =>
                    pc.setGroupForm((current) => ({ ...current, ...patch }))
                  }
                  onCreateGroup={() => void pc.handleCreateGroup()}
                  onAssignSelected={() => void pc.handleAssignStudents()}
                  onAssignGroups={() => void pc.handleAssignGroups()}
                  onEnrollGroupStudents={() => void pc.handleEnrollGroupStudents()}
                  onRefreshGroups={() => void pc.refreshGroups()}
                  onRefreshGroupEnrollments={() => void pc.refreshGroupEnrollments()}
                  onRefreshAssignments={() => void pc.refreshAssignments()}
                  onRevokeGroupEnrollment={(enrollmentId) =>
                    void pc.handleRevokeGroupEnrollment(enrollmentId)
                  }
                  onRevokeAssignment={(assignmentId, studentId) =>
                    void pc.handleRevokeAssignment(assignmentId, studentId)
                  }
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
                <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
                  <div className="border-b border-slate-100 pb-6">
                    <p className="eyebrow">Settings</p>
                    <h4 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                      Ajustes de {selectedCanvasProject.title}
                    </h4>
                  </div>
                  <form className="mt-8 space-y-6" onSubmit={pc.handleUpdate}>
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                      <div>
                        <label className="label-text">Título del proyecto</label>
                        <input
                          className="input-field"
                          required
                          value={pc.editForm.title}
                          onChange={e => pc.setEditForm(prev => ({ ...prev, title: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="label-text">Estado</label>
                        <select
                          className="input-field"
                          value={pc.editForm.status}
                          onChange={e => pc.setEditForm(prev => ({ ...prev, status: e.target.value as ProjectStatus }))}
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
                        value={pc.editForm.contextAcademico}
                        onChange={e => pc.setEditForm(prev => ({ ...prev, contextAcademico: e.target.value }))}
                      />
                    </div>
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                      <div>
                        <label className="label-text">Intentos máximos por alumno</label>
                        <input
                          type="number"
                          min="1"
                          className="input-field"
                          value={pc.editForm.maxDeliveriesPerStudent}
                          onChange={e => pc.setEditForm(prev => ({ ...prev, maxDeliveriesPerStudent: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="label-text">Tipo esperado</label>
                        <input
                          className="input-field"
                          value={pc.editForm.expectedType}
                          onChange={e => pc.setEditForm(prev => ({ ...prev, expectedType: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                      <div>
                        <label className="label-text">Abre entregas en</label>
                        <input
                          type="datetime-local"
                          className="input-field"
                          value={pc.editForm.opensAt}
                          onChange={e => pc.setEditForm(prev => ({ ...prev, opensAt: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="label-text">Cierra entregas en</label>
                        <input
                          type="datetime-local"
                          className="input-field"
                          value={pc.editForm.closesAt}
                          onChange={e => pc.setEditForm(prev => ({ ...prev, closesAt: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="label-text">Instrucciones de rúbrica</label>
                      <textarea
                        className="input-field min-h-[160px]"
                        value={pc.editForm.rubricInstructions}
                        onChange={e => pc.setEditForm(prev => ({ ...prev, rubricInstructions: e.target.value }))}
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-5">
                      <button type="submit" className="btn-primary">
                        <RiSettings4Line />
                        Guardar cambios
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => void pc.handleFetchTestSuite()}
                      >
                        <RiFolderUploadLine />
                        Suite docente
                      </button>
                      <button
                        type="button"
                        className="btn-danger"
                        onClick={() => {
                          pc.setDeleteId(selectedCanvasProject.id);
                          pc.setConfirmOpen(true);
                        }}
                      >
                        <RiDeleteBin6Line />
                        Eliminar proyecto
                      </button>
                    </div>
                  </form>
                </div>
              ) : null}
            </>
          ) : (
            <EmptyState
              icon={<RiStackFill className="text-5xl text-slate-300" />}
              title="Selecciona un proyecto o crea uno nuevo"
              description="El detalle aparece aquí con overview, alumnos, monitoring y settings. Mientras tanto, mantenemos el lienzo limpio para que no tengas mensajes de contexto roto."
              actionLabel="Crear proyecto"
              onAction={openNewProject}
              className="min-h-[420px] border-slate-200 bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.08),_transparent_38%),linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.98))]"
            />
          )}
        </section>
      </div>

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
