/**
 * @fileoverview Vista y gestión de proyectos académicos (TeacherProjectsPanel).
 *
 * @module TeacherProjectsPanel
 */

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { DangerConfirmModal } from "../shared/components/DangerConfirmModal";
import { CodePreviewModal } from "../shared/components/CodePreviewModal";
import { ProgressDashboard } from "./ProgressDashboard";
import { useProjectManagement } from "./hooks/useProjectManagement";
import { useWorkspaceSelection } from "../shared/workspace/WorkspaceContext";
import {
  RiFoldersLine,
  RiLoader4Line,
  RiRefreshLine,
  RiStackFill,
  RiFolderAddLine,
} from "react-icons/ri";
import { EmptyState } from "../shared/components/EmptyState";
import { SkeletonCard } from "../shared/components/Skeleton";
import {
  ProjectAssignmentManager,
} from "./components/ProjectSubPanels";
import { useNoticeToasts } from "../shared/toast/useNoticeToasts";
import { PageHeader } from "../shared/components/ui/PageHeader";
import { Button } from "../shared/components/ui/Button";
import { SearchInput } from "../shared/components/ui/SearchInput";
import { Card } from "../shared/components/ui/Layout";
import { StatusBadge } from "../shared/components/ui/StatusBadge";
import { ProjectListItem } from "./components/ProjectListItem";
import { ProjectOverview } from "./components/ProjectOverview";
import { ProjectCreateForm } from "./features/ProjectCreateForm";
import { ProjectDetailHeader } from "./components/ProjectDetailHeader";
import { ProjectConfigForm } from "./features/ProjectConfigForm";

type SubTab = 'catalog' | 'assignments' | 'config' | 'monitoring';
type DetailMode = "selected-project" | "new-project";

export function TeacherProjectsPanel(): JSX.Element {
  const pc = useProjectManagement();
  const { selection, setProject, clearWorkspace } = useWorkspaceSelection();
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
      rubricCriteria: [],
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

  const handleUploadSuite = async (file: File) => {
    if (!pc.selectedProjectId) return;

    setIsUploadingSuite(true);
    try {
      await pc.handleUploadTestSuite(file);
    } finally {
      setIsUploadingSuite(false);
    }
  };

  const handleDeleteProject = (projectId: string) => {
    pc.setDeleteId(projectId);
    pc.setConfirmOpen(true);
  };

  const cancelNewProject = () => {
    setDetailMode("selected-project");
    setActiveSubTab("catalog");
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
        <Card className="flex h-full flex-col overflow-hidden p-4">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <p className="ui-label">Catálogo</p>
              <h3 className="text-sm font-semibold text-slate-900">
                Proyectos
              </h3>
            </div>
            <StatusBadge tone="info">{projects.length}</StatusBadge>
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

          <div className="mt-6 flex-1 overflow-y-auto space-y-2.5 pr-1 -mr-1 custom-scrollbar">
            {pc.loadingProjects ? (
              <>
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </>
            ) : visibleProjects.length === 0 ? (
              <div className="rounded-md border border-dashed border-app-border bg-slate-50/60 px-4 py-10 text-center">
                <RiFoldersLine className="mx-auto mb-2 text-3xl text-slate-400" />
                <p className="text-xs font-medium text-slate-500">No se encontraron proyectos</p>
              </div>
            ) : (
              visibleProjects.map((project) => {
                const isSelected =
                  detailMode === "selected-project" &&
                  pc.selectedProjectId === project.id;

                return (
                  <ProjectListItem
                    key={project.id}
                    project={project}
                    isSelected={isSelected}
                    onClick={() => openProject(project.id)}
                  />
                );
              })
            )}
          </div>
        </Card>

        <section className="min-w-0 space-y-5">
          {detailMode === "new-project" ? (
            <ProjectCreateForm
              createForm={pc.createForm}
              setCreateForm={pc.setCreateForm}
              groups={pc.groups}
              handleCreate={pc.handleCreate}
              onCancel={cancelNewProject}
            />
          ) : selectedCanvasProject ? (
            <>
              <ProjectDetailHeader
                project={selectedCanvasProject}
                activeTab={activeSubTab}
                onTabChange={setActiveSubTab}
              />

              {activeSubTab === "catalog" ? (
                <ProjectOverview
                  project={selectedCanvasProject}
                  assignmentCount={assignmentCount}
                  preparedStudentCount={preparedStudentCount}
                  onOpenMonitoring={() => setActiveSubTab("monitoring")}
                  onRefreshAssignments={() => void pc.refreshAssignments()}
                  onFetchTestSuite={() => void pc.handleFetchTestSuite()}
                  onDelete={() => handleDeleteProject(selectedCanvasProject.id)}
                />
              ) : null}

              {activeSubTab === "assignments" ? (
                <ProjectAssignmentManager
                  project={selectedCanvasProject}
                  students={pc.students}
                  totalStudentsCount={pc.totalStudentsCount}
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
                    selectedProjectId={selectedCanvasProject.id}
                    embedded
                  />
                </Card>
              ) : null}

              {activeSubTab === "config" ? (
                <ProjectConfigForm
                  project={selectedCanvasProject}
                  editForm={pc.editForm}
                  setEditForm={pc.setEditForm}
                  handleUpdate={pc.handleUpdate}
                  testSuite={pc.testSuiteResult}
                  isUploadingSuite={isUploadingSuite}
                  onUploadSuite={handleUploadSuite}
                  onDownloadSuite={handleDownloadSuite}
                  onPreviewSuite={handleOpenPreview}
                  allTeachers={pc.allTeachers}
                  onSearchTeachers={pc.searchTeachers}
                  onAddTeacher={pc.handleAddTeacher}
                  onRemoveTeacher={pc.handleRemoveTeacher}
                  onDelete={() => handleDeleteProject(selectedCanvasProject.id)}
                />
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
