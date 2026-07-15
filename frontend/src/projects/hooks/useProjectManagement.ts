import { type FormEvent, useEffect, useState } from "react";
import {
  assignmentsApi,
  projectsApi,
  usersApi,
} from "../../shared/api/services";
import type {
  PaginatedResponse,
  ProjectEntity,
  ProjectStatus,
  RubricCriterion,
  UserEntity,
} from "../../shared/types";
import { useSession } from "../../shared/session/SessionContext";
import { useManagementPermissions } from "../../shared/session/useManagementPermissions";
import { getErrorMessage } from "../../shared/utils/errors";
import { useCrudResource } from "../../shared/hooks/useCrudResource";
import type { NoticeState } from "./projectManagement.types";
import {
  normalizeOptionalDateTime,
  normalizeOptionalText,
  toDateTimeLocalValue,
} from "./projectManagement.utils";
import { useProjectAssignmentManagement } from "./useProjectAssignmentManagement";
import { useProjectTestSuiteManagement } from "./useProjectTestSuiteManagement";

/**
 * Sanea los criterios de rúbrica del formulario: descarta los que no tienen
 * nombre y normaliza la descripción vacía a `null`. Devuelve `undefined` cuando
 * no queda ninguno, para omitir el campo del payload.
 */
export function normalizeRubricCriteria(
  criteria: RubricCriterion[],
): RubricCriterion[] | undefined {
  const cleaned = criteria
    .map((criterion) => ({
      name: criterion.name.trim(),
      weight: criterion.weight,
      description: criterion.description?.trim() || null,
    }))
    .filter((criterion) => criterion.name.length > 0);
  return cleaned.length > 0 ? cleaned : undefined;
}

/** Suma de los pesos de los criterios con nombre. */
export function sumRubricWeights(criteria: RubricCriterion[]): number {
  return criteria.reduce(
    (total, criterion) =>
      criterion.name.trim().length > 0 ? total + (criterion.weight || 0) : total,
    0,
  );
}

function useAutoDismissNotice(
  notice: NoticeState | null,
  clearNotice: () => void,
): void {
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(clearNotice, 15_000);
    return () => clearTimeout(timer);
  }, [clearNotice, notice]);
}

export function useProjectManagement() {
  const { activeSession: session } = useSession();
  const [students, setStudents] = useState<UserEntity[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [createForm, setCreateForm] = useState({
    title: "",
    contextAcademico: "",
    status: "DRAFT" as ProjectStatus,
    maxDeliveriesPerStudent: "1",
    expectedType: "",
    expectedOutput: "",
    rubricInstructions: "",
    rubricCriteria: [] as RubricCriterion[],
    opensAt: "",
    closesAt: "",
    assignedGroupIds: [] as string[],
    suiteFile: null as File | null,
  });
  const [editForm, setEditForm] = useState({
    title: "",
    contextAcademico: "",
    status: "DRAFT" as ProjectStatus,
    maxDeliveriesPerStudent: "1",
    expectedType: "",
    expectedOutput: "",
    rubricInstructions: "",
    rubricCriteria: [] as RubricCriterion[],
    opensAt: "",
    closesAt: "",
  });
  const [deleteId, setDeleteId] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [projectNotice, setProjectNotice] = useState<NoticeState | null>(null);
  const [editorNotice, setEditorNotice] = useState<NoticeState | null>(null);
  const [debugPayload, setDebugPayload] = useState<unknown>(null);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [allTeachers, setAllTeachers] = useState<UserEntity[]>([]);
  const [loadingTeachers, setLoadingTeachers] = useState(false);

  const { canRead, canWrite, canAdmin } = useManagementPermissions(session);

  type CreateProjectPayload = Parameters<typeof projectsApi.create>[0];
  type UpdateProjectPayload = Parameters<typeof projectsApi.update>[1];

  const projectCrud = useCrudResource<ProjectEntity, CreateProjectPayload, UpdateProjectPayload>({
    api: {
      list: projectsApi.list,
      create: projectsApi.create,
      update: projectsApi.update,
      remove: projectsApi.remove,
      restore: projectsApi.restore,
    },
    canRead,
    initialQuery: {
      page: 1,
      limit: 50,
      sortBy: "updatedAt",
      sortOrder: "DESC",
    },
  });

  const projects = projectCrud.listResponse;

  const selectedProject =
    projects?.data.find((project) => project.id === selectedProjectId) ?? null;

  const assignmentManagement = useProjectAssignmentManagement({
    canWrite,
    selectedProjectId,
    setDebugPayload,
  });

  const refreshProjects = async (noticeText?: string) => {
    if (!canRead) return;
    setLoadingProjects(true);
    try {
      const response = await projectCrud.refresh();
      if (response) {
        setDebugPayload(response);
        setProjectNotice(noticeText ? { text: noticeText, tone: "info" } : null);
        setSelectedProjectId((current) =>
          current && response.data.some((project) => project.id === current)
            ? current
            : "",
        );
      }
    } catch (error) {
      setProjectNotice({ text: getErrorMessage(error), tone: "warning" });
    } finally {
      setLoadingProjects(false);
    }
  };

  const testSuiteManagement = useProjectTestSuiteManagement({
    canWrite,
    selectedProjectId,
  });

  const handleRestore = async (id: string) => {
    try {
      await projectCrud.restore(id);
      await refreshProjects();
    } catch (err) {
      console.error("Error al restaurar proyecto:", err);
      throw err;
    }
  };

  const handleAddTeacher = async (projectId: string, teacherId: string) => {
    try {
      await projectsApi.addTeacher(projectId, teacherId);
      await refreshProjects();
    } catch (err) {
      console.error("Error al añadir profesor:", err);
      throw err;
    }
  };

  const handleRemoveTeacher = async (projectId: string, teacherId: string) => {
    try {
      await projectsApi.removeTeacher(projectId, teacherId);
      await refreshProjects();
    } catch (err) {
      console.error("Error al eliminar profesor:", err);
      throw err;
    }
  };

  const focusedGroup =
    assignmentManagement.groups.find(
      (group) => group.id === assignmentManagement.focusedGroupId,
    ) ?? null;

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canWrite) return;

    const rubricCriteria = normalizeRubricCriteria(createForm.rubricCriteria);
    if (rubricCriteria && sumRubricWeights(rubricCriteria) !== 100) {
      setEditorNotice({
        text: "Los pesos de la rúbrica deben sumar 100.",
        tone: "warning",
      });
      return;
    }

    try {
      const response = await projectCrud.create({
        title: createForm.title,
        contextAcademico: normalizeOptionalText(createForm.contextAcademico),
        status: createForm.status,
        maxDeliveriesPerStudent: Number(createForm.maxDeliveriesPerStudent) || 1,
        expectedType: normalizeOptionalText(createForm.expectedType),
        expectedOutput: normalizeOptionalText(createForm.expectedOutput),
        rubricInstructions: normalizeOptionalText(createForm.rubricInstructions),
        rubricCriteria,
        opensAt: normalizeOptionalDateTime(createForm.opensAt),
        closesAt: normalizeOptionalDateTime(createForm.closesAt),
        assignedGroupIds: createForm.assignedGroupIds,
      });

      if (!response) return;

      if (createForm.suiteFile) {
        await projectsApi.uploadTestSuite(response.id, createForm.suiteFile);
      }

      setCreateForm({
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
      setDebugPayload(response);
      setEditorNotice({ text: "Proyecto creado correctamente.", tone: "info" });
      await refreshProjects("Listado actualizado tras crear el proyecto.");
      setSelectedProjectId(response.id);
    } catch (error) {
      setEditorNotice({ text: getErrorMessage(error), tone: "warning" });
    }
  };

  const handleUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canWrite || !selectedProject) return;

    const rubricCriteria = normalizeRubricCriteria(editForm.rubricCriteria);
    if (rubricCriteria && sumRubricWeights(rubricCriteria) !== 100) {
      setEditorNotice({
        text: "Los pesos de la rúbrica deben sumar 100.",
        tone: "warning",
      });
      return;
    }

    try {
      const response = await projectCrud.update(selectedProject.id, {
        title: editForm.title,
        contextAcademico: normalizeOptionalText(editForm.contextAcademico),
        status: editForm.status,
        maxDeliveriesPerStudent: Number(editForm.maxDeliveriesPerStudent) || 1,
        expectedType: normalizeOptionalText(editForm.expectedType),
        expectedOutput: normalizeOptionalText(editForm.expectedOutput),
        rubricInstructions: normalizeOptionalText(editForm.rubricInstructions),
        rubricCriteria: rubricCriteria ?? [],
        opensAt: normalizeOptionalDateTime(editForm.opensAt),
        closesAt: normalizeOptionalDateTime(editForm.closesAt),
      });
      if (!response) return;
      setDebugPayload(response);
      setEditorNotice({
        text: "Proyecto actualizado correctamente.",
        tone: "info",
      });
      await refreshProjects("Datos del proyecto actualizados.");
    } catch (error) {
      setEditorNotice({ text: getErrorMessage(error), tone: "warning" });
    }
  };

  const executeDelete = async () => {
    if (!canAdmin || !deleteId.trim()) return;
    try {
      await projectCrud.remove(deleteId.trim());
      setEditorNotice({
        text: `Proyecto ${deleteId.trim()} eliminado.`,
        tone: "info",
      });
      setDeleteId("");
      await refreshProjects();
    } catch (error) {
      setEditorNotice({ text: getErrorMessage(error), tone: "warning" });
      throw error;
    }
  };

  useEffect(() => {
    if (canRead) {
      void refreshProjects();
    }
  }, [canRead]);

  useEffect(() => {
    if (!canWrite) return;
    setLoadingStudents(true);
    usersApi
      .list({ page: 1, limit: 100, role: "STUDENT" })
      .then((response) => setStudents(response.data))
      .catch((error) =>
        assignmentManagement.setAssignmentNotice({
          text: getErrorMessage(error),
          tone: "warning",
        }),
      )
      .finally(() => setLoadingStudents(false));
  }, [canWrite]);

  useEffect(() => {
    if (!canWrite) return;
    setLoadingTeachers(true);
    usersApi
      .list({ page: 1, limit: 100, role: "TEACHER" })
      .then((response) => setAllTeachers(response.data))
      .catch((error) => console.error("Error al cargar profesores:", error))
      .finally(() => setLoadingTeachers(false));
  }, [canWrite]);

  useEffect(() => {
    if (!canWrite || !selectedProject) return;
    setEditForm({
      title: selectedProject.title,
      contextAcademico: selectedProject.contextAcademico ?? "",
      status: selectedProject.status,
      maxDeliveriesPerStudent: String(selectedProject.maxDeliveriesPerStudent),
      expectedType: selectedProject.expectedType ?? "",
      expectedOutput: selectedProject.expectedOutput ?? "",
      rubricInstructions: selectedProject.rubricInstructions ?? "",
      rubricCriteria: selectedProject.rubricCriteria
        ? selectedProject.rubricCriteria.map((criterion) => ({ ...criterion }))
        : [],
      opensAt: toDateTimeLocalValue(selectedProject.opensAt),
      closesAt: toDateTimeLocalValue(selectedProject.closesAt),
    });
  }, [canWrite, selectedProject]);

  useAutoDismissNotice(projectNotice, () => setProjectNotice(null));
  useAutoDismissNotice(editorNotice, () => setEditorNotice(null));

  return {
    projects,
    setProjects: () => {}, // preserved for API compatibility; list is managed by CRUD hook
    students,
    setStudents,
    groups: assignmentManagement.groups,
    setGroups: assignmentManagement.setGroups,
    selectedProjectId,
    setSelectedProjectId,
    selectedProject,
    focusedGroupId: assignmentManagement.focusedGroupId,
    setFocusedGroupId: assignmentManagement.setFocusedGroupId,
    focusedGroup,
    selectedStudentIds: assignmentManagement.selectedStudentIds,
    setSelectedStudentIds: assignmentManagement.setSelectedStudentIds,
    bulkStudentEmails: assignmentManagement.bulkStudentEmails,
    setBulkStudentEmails: assignmentManagement.setBulkStudentEmails,
    groupStudentSearch: assignmentManagement.groupStudentSearch,
    setGroupStudentSearch: assignmentManagement.setGroupStudentSearch,
    selectedGroupIds: assignmentManagement.selectedGroupIds,
    setSelectedGroupIds: assignmentManagement.setSelectedGroupIds,
    selectedGroupStudentIds: assignmentManagement.selectedGroupStudentIds,
    setSelectedGroupStudentIds: assignmentManagement.setSelectedGroupStudentIds,
    bulkGroupStudentEmails: assignmentManagement.bulkGroupStudentEmails,
    setBulkGroupStudentEmails: assignmentManagement.setBulkGroupStudentEmails,
    assignmentsResult: assignmentManagement.assignmentsResult,
    groupEnrollments: assignmentManagement.groupEnrollments,
    testSuiteFile: testSuiteManagement.testSuiteFile,
    setTestSuiteFile: testSuiteManagement.setTestSuiteFile,
    testSuiteResult: testSuiteManagement.testSuiteResult,
    groupForm: assignmentManagement.groupForm,
    setGroupForm: assignmentManagement.setGroupForm,
    createForm,
    setCreateForm,
    editForm,
    setEditForm,
    deleteId,
    setDeleteId,
    confirmOpen,
    setConfirmOpen,
    projectNotice,
    assignmentNotice: assignmentManagement.assignmentNotice,
    suiteNotice: testSuiteManagement.suiteNotice,
    editorNotice,
    debugPayload,
    loadingProjects,
    loadingStudents,
    loadingGroups: assignmentManagement.loadingGroups,
    assignmentBusy: assignmentManagement.assignmentBusy,
    canRead,
    canWrite,
    canAdmin,
    refreshProjects,
    refreshAssignments: assignmentManagement.refreshAssignments,
    refreshGroups: assignmentManagement.refreshGroups,
    refreshGroupEnrollments: assignmentManagement.refreshGroupEnrollments,
    handleCreate,
    handleUpdate,
    handleAssignStudents: assignmentManagement.handleAssignStudents,
    handleAssignGroups: assignmentManagement.handleAssignGroups,
    handleRevokeAssignment: assignmentManagement.handleRevokeAssignment,
    handleBulkEmailImport: assignmentManagement.handleBulkEmailImport,
    handleGroupBulkEmailImport:
      assignmentManagement.handleGroupBulkEmailImport,
    handleCreateGroup: assignmentManagement.handleCreateGroup,
    handleEnrollGroupStudents: assignmentManagement.handleEnrollGroupStudents,
    handleRevokeGroupEnrollment:
      assignmentManagement.handleRevokeGroupEnrollment,
    handleUploadTestSuite: testSuiteManagement.handleUploadTestSuite,
    handleFetchTestSuite: testSuiteManagement.handleFetchTestSuite,
    handleRemoveTestSuite: testSuiteManagement.handleRemoveTestSuite,
    handleAddTeacher,
    handleRemoveTeacher,
    allTeachers,
    loadingTeachers,
    executeDelete,
    handleRestore,
  };
}
