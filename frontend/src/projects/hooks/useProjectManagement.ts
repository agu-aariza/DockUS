/**
 * @fileoverview Vista y gestión de proyectos académicos (useProjectManagement).
 *
 * @module useProjectManagement
 */

import { type FormEvent, useCallback, useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  projectsApi,
  usersApi,
} from "../../shared/api/services";
import type {
  ProjectStatus,
  RubricCriterion,
} from "../../shared/types";
import { useSession } from "../../shared/session/SessionContext";
import { useManagementPermissions } from "../../shared/session/useManagementPermissions";
import { getErrorMessage } from "../../shared/utils/errors";
import { queryKeys } from "../../shared/query/queryKeys";
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

  const { canRead, canWrite, canAdmin } = useManagementPermissions(session);

  type CreateProjectPayload = Parameters<typeof projectsApi.create>[0];
  type UpdateProjectPayload = Parameters<typeof projectsApi.update>[1];

  const projectsQuery = useQuery({
    queryKey: queryKeys.projects.list(),
    queryFn: ({ signal }) =>
      projectsApi.list({ page: 1, limit: 50, sortBy: "updatedAt", sortOrder: "DESC" }, signal),
    enabled: canRead,
  });
  const projects = projectsQuery.data ?? null;

  const selectedProject =
    projects?.data.find((project) => project.id === selectedProjectId) ?? null;

  const assignmentManagement = useProjectAssignmentManagement({
    canWrite,
    selectedProjectId,
    setDebugPayload,
  });

  // Único punto que muestra un aviso de "listado actualizado": una acción
  // explícita (botón, o tras confirmar una mutación con su propio texto). El
  // efecto de montaje/canRead llama a esto sin noticeText, así que no muestra
  // ningún aviso — igual que el comportamiento original.
  const refreshProjects = async (noticeText?: string) => {
    if (!canRead) return;
    const result = await projectsQuery.refetch();
    if (result.data) {
      setDebugPayload(result.data);
      setProjectNotice(noticeText ? { text: noticeText, tone: "info" } : null);
      setSelectedProjectId((current) =>
        current && result.data.data.some((project) => project.id === current)
          ? current
          : "",
      );
    } else if (result.error) {
      setProjectNotice({ text: getErrorMessage(result.error), tone: "warning" });
    }
  };

  const testSuiteManagement = useProjectTestSuiteManagement({
    canWrite,
    selectedProjectId,
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateProjectPayload) => projectsApi.create(payload),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateProjectPayload }) =>
      projectsApi.update(id, payload),
  });
  const removeMutation = useMutation({
    mutationFn: (id: string) => projectsApi.remove(id),
  });
  const restoreMutation = useMutation({
    mutationFn: (id: string) => projectsApi.restore(id),
  });

  const handleRestore = async (id: string) => {
    try {
      await restoreMutation.mutateAsync(id);
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
      const response = await createMutation.mutateAsync({
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
      const response = await updateMutation.mutateAsync({
        id: selectedProject.id,
        payload: {
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
        },
      });
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
      await removeMutation.mutateAsync(deleteId.trim());
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

  const studentsQuery = useQuery({
    queryKey: queryKeys.users.list({ page: 1, limit: 100, role: "STUDENT" }),
    queryFn: () => usersApi.list({ page: 1, limit: 100, role: "STUDENT" }),
    enabled: canWrite,
  });
  const students = studentsQuery.data?.data ?? [];
  // Total real de alumnos en la plataforma (meta.total), no el tamaño de la
  // página cargada (limit: 100) — la métrica "Total Alumnos" usaba
  // students.length, que se quedaba fija en 100 pasado ese umbral (FE-MED-01).
  const totalStudentsCount = studentsQuery.data?.meta.total ?? 0;

  useEffect(() => {
    if (studentsQuery.isError) {
      assignmentManagement.setAssignmentNotice({
        text: getErrorMessage(studentsQuery.error),
        tone: "warning",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentsQuery.isError, studentsQuery.error]);

  // Búsqueda server-side de profesores (FE-MED-01): con más de 100 docentes,
  // el fetch fijo de la primera página los dejaba invisibles para el picker
  // de colaboradores de ProjectTeachersSection sin importar qué se tecleara.
  const [teacherSearch, setTeacherSearch] = useState<string | undefined>(undefined);
  const teachersQuery = useQuery({
    queryKey: queryKeys.users.list({ page: 1, limit: 100, role: "TEACHER", search: teacherSearch }),
    queryFn: () =>
      usersApi.list({ page: 1, limit: 100, role: "TEACHER", search: teacherSearch }),
    enabled: canWrite,
  });
  const allTeachers = teachersQuery.data?.data ?? [];

  const searchTeachers = useCallback((query?: string) => {
    setTeacherSearch(query?.trim() || undefined);
  }, []);

  useEffect(() => {
    if (teachersQuery.isError) {
      console.error("Error al cargar profesores:", teachersQuery.error);
    }
  }, [teachersQuery.isError, teachersQuery.error]);

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
    students,
    totalStudentsCount,
    searchTeachers,
    groups: assignmentManagement.groups,
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
    loadingProjects: projectsQuery.isFetching,
    loadingStudents: studentsQuery.isFetching,
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
    loadingTeachers: teachersQuery.isFetching,
    executeDelete,
    handleRestore,
  };
}
