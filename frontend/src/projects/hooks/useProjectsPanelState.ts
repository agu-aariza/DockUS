import { useState, useDeferredValue, useEffect } from "react";
import { useWorkspace } from "../../shared/workspace/WorkspaceContext";

type SubTab = 'catalog' | 'assignments' | 'config' | 'monitoring';
type DetailMode = "selected-project" | "new-project";

export function useProjectsPanelState(pc: any) {
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

  useEffect(() => {
    if (!selection.projectId) {
      if (pc.selectedProjectId) {
        pc.setSelectedProjectId("");
      }
      if (detailMode !== "selected-project") {
        setDetailMode("selected-project");
      }
    } else if (pc.projects?.data) {
      const exists = pc.projects.data.some((p: any) => p.id === selection.projectId);
      if (exists && pc.selectedProjectId !== selection.projectId) {
        pc.setSelectedProjectId(selection.projectId);
        setDetailMode("selected-project");
      }
    }
  }, [selection.projectId, pc.projects?.data, pc.selectedProjectId, detailMode]);

  useEffect(() => {
    setAssignmentSearch("");
  }, [pc.selectedProjectId]);

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
    const proj = pc.projects?.data.find((p: any) => p.id === projectId);
    if (proj) {
      setProject(proj.id, proj.title);
    }
  };

  const handleDownloadSuite = async () => {
    if (!pc.testSuiteResult || typeof pc.testSuiteResult === 'string' || !('id' in pc.testSuiteResult)) return;
    try {
      const { storageApi } = await import("../../shared/api/services");
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
      const { projectsApi } = await import("../../shared/api/services");
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

  return {
    activeSubTab,
    setActiveSubTab,
    detailMode,
    setDetailMode,
    isUploadingSuite,
    setIsUploadingSuite,
    assignmentSearch,
    setAssignmentSearch,
    projectSearch,
    setProjectSearch,
    deferredProjectSearch,
    isPreviewModalOpen,
    setIsPreviewModalOpen,
    previewFiles,
    isLoadingPreview,
    selectedPreviewFile,
    openNewProject,
    openProject,
    handleDownloadSuite,
    handleOpenPreview,
    handleFileChange,
  };
}
