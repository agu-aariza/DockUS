import { type FormEvent, useEffect, useState } from "react";
import {
  assignmentsApi,
  groupsApi,
  projectsApi,
  usersApi,
} from "../../shared/api/services";
import type {
  CourseGroupEntity,
  GroupEnrollmentEntity,
  PaginatedResponse,
  ProjectAssignmentEntity,
  ProjectEntity,
  ProjectStatus,
  SessionRecord,
  StorageObjectEntity,
  UserEntity,
} from "../../shared/types";
import { getErrorMessage } from "../../shared/utils/errors";
import { hasRole } from "../../shared/utils/permissions";

export type NoticeTone = "info" | "warning";

export interface NoticeState {
  text: string;
  tone: NoticeTone;
}

function toDateTimeLocalValue(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  const pad = (input: number) => String(input).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function normalizeOptionalText(value: string): string | undefined {
  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

function normalizeOptionalDateTime(value: string): string | undefined {
  const normalized = value.trim();
  return normalized ? new Date(normalized).toISOString() : undefined;
}

function parseStudentEmails(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(/[\n,;]+/)
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}

export function useProjectManagement(session: SessionRecord | null) {
  const [projects, setProjects] =
    useState<PaginatedResponse<ProjectEntity> | null>(null);
  const [students, setStudents] = useState<UserEntity[]>([]);
  const [groups, setGroups] = useState<CourseGroupEntity[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [bulkStudentEmails, setBulkStudentEmails] = useState("");
  const [groupStudentSearch, setGroupStudentSearch] = useState("");
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [focusedGroupId, setFocusedGroupId] = useState("");
  const [selectedGroupStudentIds, setSelectedGroupStudentIds] = useState<string[]>([]);
  const [bulkGroupStudentEmails, setBulkGroupStudentEmails] = useState("");
  const [assignmentsResult, setAssignmentsResult] =
    useState<ProjectAssignmentEntity[] | null>(null);
  const [groupEnrollments, setGroupEnrollments] =
    useState<GroupEnrollmentEntity[] | null>(null);
  const [testSuiteFile, setTestSuiteFile] = useState<File | null>(null);
  const [testSuiteResult, setTestSuiteResult] =
    useState<StorageObjectEntity | { message: string } | null>(null);
  const [groupForm, setGroupForm] = useState({
    name: "",
    code: "",
    description: "",
  });
  
  const [createForm, setCreateForm] = useState({
    title: "",
    contextAcademico: "",
    status: "DRAFT" as ProjectStatus,
    maxDeliveriesPerStudent: "1",
    expectedType: "",
    rubricInstructions: "",
    opensAt: "",
    closesAt: "",
  });
  
  const [editForm, setEditForm] = useState({
    title: "",
    contextAcademico: "",
    status: "DRAFT" as ProjectStatus,
    maxDeliveriesPerStudent: "1",
    expectedType: "",
    rubricInstructions: "",
    opensAt: "",
    closesAt: "",
  });
  
  const [deleteId, setDeleteId] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [projectNotice, setProjectNotice] = useState<NoticeState | null>(null);
  const [assignmentNotice, setAssignmentNotice] =
    useState<NoticeState | null>(null);
  const [suiteNotice, setSuiteNotice] = useState<NoticeState | null>(null);
  const [editorNotice, setEditorNotice] = useState<NoticeState | null>(null);
  const [debugPayload, setDebugPayload] = useState<unknown>(null);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [assignmentBusy, setAssignmentBusy] = useState<string | null>(null);

  const canRead = Boolean(session);
  const canWrite = hasRole(session, ["ADMIN", "TEACHER"]);
  const canAdmin = hasRole(session, ["ADMIN"]);

  const selectedProject =
    projects?.data.find((project) => project.id === selectedProjectId) ?? null;
  const focusedGroup =
    groups.find((group) => group.id === focusedGroupId) ?? null;

  const refreshProjects = async (noticeText?: string) => {
    if (!canRead) return;
    setLoadingProjects(true);
    try {
      const response = await projectsApi.list({
        page: 1,
        limit: 50,
        sortBy: "updatedAt",
        sortOrder: "DESC",
      });
      setProjects(response);
      setDebugPayload(response);
      setProjectNotice(
        noticeText
          ? { text: noticeText, tone: "info" }
          : null,
      );
      setSelectedProjectId((current) =>
        current && response.data.some((p) => p.id === current)
          ? current
          : "",
      );
    } catch (error) {
      setProjectNotice({ text: getErrorMessage(error), tone: "warning" });
    } finally {
      setLoadingProjects(false);
    }
  };

  const refreshAssignments = async (
    projectId = selectedProjectId,
    options?: { silent?: boolean; noticeText?: string },
  ) => {
    if (!canWrite || !projectId) return;
    try {
      const response = await assignmentsApi.listByProject(projectId);
      setAssignmentsResult(response);
      if (!options?.silent) {
        setAssignmentNotice({
          text: options?.noticeText ?? "Asignaciones actualizadas.",
          tone: "info",
        });
      }
      setDebugPayload(response);
    } catch (error) {
      setAssignmentNotice({ text: getErrorMessage(error), tone: "warning" });
    }
  };

  const refreshGroups = async (
    options?: { silent?: boolean; noticeText?: string },
  ) => {
    if (!canWrite) return;
    setLoadingGroups(true);
    try {
      const response = await groupsApi.list();
      setGroups(response);
      setDebugPayload(response);
      setFocusedGroupId((current) =>
        current && response.some((group) => group.id === current)
          ? current
          : response[0]?.id ?? "",
      );
      if (!options?.silent) {
        setAssignmentNotice({
          text: options?.noticeText ?? "Grupos docentes actualizados.",
          tone: "info",
        });
      }
    } catch (error) {
      setAssignmentNotice({ text: getErrorMessage(error), tone: "warning" });
    } finally {
      setLoadingGroups(false);
    }
  };

  const refreshGroupEnrollments = async (
    groupId = focusedGroupId,
    options?: { silent?: boolean; noticeText?: string },
  ) => {
    if (!canWrite || !groupId) return;
    try {
      const response = await groupsApi.listEnrollments(groupId);
      setGroupEnrollments(response);
      setDebugPayload(response);
      if (!options?.silent) {
        setAssignmentNotice({
          text: options?.noticeText ?? "Matrículas del grupo actualizadas.",
          tone: "info",
        });
      }
    } catch (error) {
      setAssignmentNotice({ text: getErrorMessage(error), tone: "warning" });
    }
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canWrite) return;

    try {
      const response = await projectsApi.create({
        title: createForm.title,
        contextAcademico: normalizeOptionalText(createForm.contextAcademico),
        status: createForm.status,
        maxDeliveriesPerStudent: Number(createForm.maxDeliveriesPerStudent) || 1,
        expectedType: normalizeOptionalText(createForm.expectedType),
        rubricInstructions: normalizeOptionalText(createForm.rubricInstructions),
        opensAt: normalizeOptionalDateTime(createForm.opensAt),
        closesAt: normalizeOptionalDateTime(createForm.closesAt),
      });
      setCreateForm({
        title: "",
        contextAcademico: "",
        status: "DRAFT",
        maxDeliveriesPerStudent: "1",
        expectedType: "",
        rubricInstructions: "",
        opensAt: "",
        closesAt: "",
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

    try {
      const response = await projectsApi.update(selectedProject.id, {
        title: editForm.title,
        contextAcademico: normalizeOptionalText(editForm.contextAcademico),
        status: editForm.status,
        maxDeliveriesPerStudent: Number(editForm.maxDeliveriesPerStudent) || 1,
        expectedType: normalizeOptionalText(editForm.expectedType),
        rubricInstructions: normalizeOptionalText(editForm.rubricInstructions),
        opensAt: normalizeOptionalDateTime(editForm.opensAt),
        closesAt: normalizeOptionalDateTime(editForm.closesAt),
      });
      setDebugPayload(response);
      setEditorNotice({ text: "Proyecto actualizado correctamente.", tone: "info" });
      await refreshProjects("Datos del proyecto actualizados.");
    } catch (error) {
      setEditorNotice({ text: getErrorMessage(error), tone: "warning" });
    }
  };

  const handleAssignStudents = async () => {
    if (!canWrite || !selectedProject) return;
    const studentEmails = parseStudentEmails(bulkStudentEmails);
    if (selectedStudentIds.length === 0 && studentEmails.length === 0) return;
    setAssignmentBusy("assign");
    try {
      const response = await assignmentsApi.bulkAssign(selectedProject.id, {
        studentIds: selectedStudentIds,
        studentEmails,
      });
      setAssignmentsResult(response.assignments);
      setSelectedStudentIds([]);
      setBulkStudentEmails("");
      const importedCount = response.summary.assignedCount + response.summary.reactivatedCount;
      const unresolvedCount = response.summary.unresolvedEmails.length;
      setAssignmentNotice({
        text: unresolvedCount > 0
          ? `Asignación completada con incidencias: ${importedCount} incorporados y ${unresolvedCount} correos sin resolver.`
          : `Asignación completada: ${response.summary.assignedCount} altas nuevas, ${response.summary.reactivatedCount} reactivadas y ${response.summary.alreadyActiveCount} ya activas.`,
        tone: unresolvedCount > 0 ? "warning" : "info",
      });
      setDebugPayload(response);
    } catch (error) {
      setAssignmentNotice({ text: getErrorMessage(error), tone: "warning" });
    } finally {
      setAssignmentBusy(null);
    }
  };

  const handleAssignGroups = async () => {
    if (!canWrite || !selectedProject || selectedGroupIds.length === 0) return;
    setAssignmentBusy("assign:groups");
    try {
      const response = await assignmentsApi.bulkAssign(selectedProject.id, {
        groupIds: selectedGroupIds,
      });
      setAssignmentsResult(response.assignments);
      setSelectedGroupIds([]);
      setAssignmentNotice({
        text: `Asignación por grupo completada: ${response.summary.requestedGroupIds.length} grupos procesados, ${response.summary.assignedCount} altas nuevas, ${response.summary.reactivatedCount} reactivadas y ${response.summary.alreadyActiveCount} ya activas.`,
        tone: "info",
      });
      setDebugPayload(response);
    } catch (error) {
      setAssignmentNotice({ text: getErrorMessage(error), tone: "warning" });
    } finally {
      setAssignmentBusy(null);
    }
  };

  const handleBulkEmailImport = async (file: File | null) => {
    if (!file) return;
    try {
      const text = await file.text();
      const normalized = text.trim();
      setBulkStudentEmails((current) =>
        current.trim()
          ? `${current.trim()}\n${normalized}`
          : normalized,
      );
      setAssignmentNotice({
        text: `Se han cargado ${parseStudentEmails(normalized).length} correos desde ${file.name}.`,
        tone: "info",
      });
    } catch (error) {
      setAssignmentNotice({ text: getErrorMessage(error), tone: "warning" });
    }
  };

  const handleGroupBulkEmailImport = async (file: File | null) => {
    if (!file) return;
    try {
      const text = await file.text();
      const normalized = text.trim();
      setBulkGroupStudentEmails((current) =>
        current.trim()
          ? `${current.trim()}\n${normalized}`
          : normalized,
      );
      setAssignmentNotice({
        text: `Se han cargado ${parseStudentEmails(normalized).length} correos para el grupo desde ${file.name}.`,
        tone: "info",
      });
    } catch (error) {
      setAssignmentNotice({ text: getErrorMessage(error), tone: "warning" });
    }
  };

  const handleCreateGroup = async () => {
    if (!canWrite) return;
    const name = groupForm.name.trim();
    if (!name) return;
    setAssignmentBusy("group:create");
    try {
      const response = await groupsApi.create({
        name,
        code: normalizeOptionalText(groupForm.code),
        description: normalizeOptionalText(groupForm.description),
      });
      setGroupForm({ name: "", code: "", description: "" });
      await refreshGroups({ silent: true });
      setFocusedGroupId(response.id);
      setSelectedGroupIds((current) =>
        current.includes(response.id) ? current : [...current, response.id],
      );
      setAssignmentNotice({
        text: `Grupo "${response.name}" creado correctamente.`,
        tone: "info",
      });
      setDebugPayload(response);
    } catch (error) {
      setAssignmentNotice({ text: getErrorMessage(error), tone: "warning" });
    } finally {
      setAssignmentBusy(null);
    }
  };

  const handleEnrollGroupStudents = async () => {
    if (!canWrite || !focusedGroupId) return;
    const studentEmails = parseStudentEmails(bulkGroupStudentEmails);
    if (selectedGroupStudentIds.length === 0 && studentEmails.length === 0) return;
    setAssignmentBusy("group:enroll");
    try {
      const response = await groupsApi.bulkEnroll(focusedGroupId, {
        studentIds: selectedGroupStudentIds,
        studentEmails,
      });
      setGroupEnrollments(response.enrollments);
      setSelectedGroupStudentIds([]);
      setBulkGroupStudentEmails("");
      await refreshGroups({ silent: true });
      const enrolledCount =
        response.summary.enrolledCount + response.summary.reactivatedCount;
      const unresolvedCount = response.summary.unresolvedEmails.length;
      setAssignmentNotice({
        text:
          unresolvedCount > 0
            ? `Matrícula completada con incidencias: ${enrolledCount} incorporados y ${unresolvedCount} correos sin resolver.`
            : `Grupo actualizado: ${response.summary.enrolledCount} altas nuevas, ${response.summary.reactivatedCount} reactivadas y ${response.summary.alreadyActiveCount} ya activas.`,
        tone: unresolvedCount > 0 ? "warning" : "info",
      });
      setDebugPayload(response);
    } catch (error) {
      setAssignmentNotice({ text: getErrorMessage(error), tone: "warning" });
    } finally {
      setAssignmentBusy(null);
    }
  };

  const handleRevokeGroupEnrollment = async (enrollmentId: string) => {
    if (!canWrite || !focusedGroupId || !enrollmentId.trim()) return;
    setAssignmentBusy(`group:revoke:${enrollmentId}`);
    try {
      await groupsApi.revokeEnrollment(enrollmentId.trim());
      await refreshGroupEnrollments(focusedGroupId, { silent: true });
      await refreshGroups({ silent: true });
      setAssignmentNotice({
        text: "Alumno retirado del grupo.",
        tone: "info",
      });
    } catch (error) {
      setAssignmentNotice({ text: getErrorMessage(error), tone: "warning" });
    } finally {
      setAssignmentBusy(null);
    }
  };

  const handleRevokeAssignment = async (
    assignmentId: string,
    studentId?: string,
  ) => {
    if (!canWrite || !selectedProject || !assignmentId.trim()) return;
    setAssignmentBusy(`revoke:${assignmentId}`);
    try {
      await assignmentsApi.revoke(assignmentId.trim());
      await refreshAssignments(selectedProject.id, { silent: true });
      if (studentId) {
        setSelectedStudentIds((current) =>
          current.filter((candidateId) => candidateId !== studentId),
        );
      }
      setAssignmentNotice({
        text: "Alumno retirado del proyecto.",
        tone: "info",
      });
    } catch (error) {
      setAssignmentNotice({ text: getErrorMessage(error), tone: "warning" });
    } finally {
      setAssignmentBusy(null);
    }
  };

  const handleUploadTestSuite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canWrite || !selectedProject || !testSuiteFile) return;
    try {
      const response = await projectsApi.uploadTestSuite(selectedProject.id, testSuiteFile);
      setTestSuiteResult(response);
      setSuiteNotice({ text: "Suite docente subida.", tone: "info" });
    } catch (error) {
      setSuiteNotice({ text: getErrorMessage(error), tone: "warning" });
    }
  };

  const handleFetchTestSuite = async () => {
    if (!canWrite || !selectedProject) return;
    try {
      const response = await projectsApi.getTestSuite(selectedProject.id);
      setTestSuiteResult(response);
      setSuiteNotice({ text: "Suite docente recuperada.", tone: "info" });
    } catch (error) {
      setSuiteNotice({ text: getErrorMessage(error), tone: "warning" });
    }
  };

  const handleRemoveTestSuite = async () => {
    if (!canWrite || !selectedProject) return;
    try {
      await projectsApi.removeTestSuite(selectedProject.id);
      setTestSuiteResult(null);
      setSuiteNotice({ text: "Suite docente eliminada.", tone: "info" });
    } catch (error) {
      setSuiteNotice({ text: getErrorMessage(error), tone: "warning" });
    }
  };

  const executeDelete = async () => {
    if (!canAdmin || !deleteId.trim()) return;
    try {
      await projectsApi.remove(deleteId.trim());
      setEditorNotice({ text: `Proyecto ${deleteId.trim()} eliminado.`, tone: "info" });
      setDeleteId("");
      await refreshProjects();
    } catch (error) {
      setEditorNotice({ text: getErrorMessage(error), tone: "warning" });
      throw error;
    }
  };

  // Initial loads
  useEffect(() => { if (canRead) void refreshProjects(); }, [canRead]);
  
  useEffect(() => {
    if (!canWrite) return;
    setLoadingStudents(true);
    usersApi.list({ page: 1, limit: 100, role: "STUDENT" })
      .then(r => setStudents(r.data))
      .catch(e => setAssignmentNotice({ text: getErrorMessage(e), tone: "warning" }))
      .finally(() => setLoadingStudents(false));
  }, [canWrite]);

  useEffect(() => {
    if (!canWrite) return;
    void refreshGroups({ silent: true });
  }, [canWrite]);

  useEffect(() => {
    if (!selectedProject) return;
    setSelectedStudentIds([]);
    setSelectedGroupIds([]);
    setBulkStudentEmails("");
    setEditForm({
      title: selectedProject.title,
      contextAcademico: selectedProject.contextAcademico ?? "",
      status: selectedProject.status,
      maxDeliveriesPerStudent: String(selectedProject.maxDeliveriesPerStudent),
      expectedType: selectedProject.expectedType ?? "",
      rubricInstructions: selectedProject.rubricInstructions ?? "",
      opensAt: toDateTimeLocalValue(selectedProject.opensAt),
      closesAt: toDateTimeLocalValue(selectedProject.closesAt),
    });
    if (canWrite) void refreshAssignments(selectedProject.id, { silent: true });
  }, [selectedProject, canWrite]);

  useEffect(() => {
    if (!focusedGroupId) {
      setGroupEnrollments(null);
      return;
    }

    setGroupStudentSearch("");
    setSelectedGroupStudentIds([]);
    setBulkGroupStudentEmails("");
    if (canWrite) {
      void refreshGroupEnrollments(focusedGroupId, { silent: true });
    }
  }, [focusedGroupId, canWrite]);

  // Auto-dismiss notices after 15 seconds
  useEffect(() => {
    if (!projectNotice) return;
    const timer = setTimeout(() => setProjectNotice(null), 15_000);
    return () => clearTimeout(timer);
  }, [projectNotice]);

  useEffect(() => {
    if (!editorNotice) return;
    const timer = setTimeout(() => setEditorNotice(null), 15_000);
    return () => clearTimeout(timer);
  }, [editorNotice]);

  useEffect(() => {
    if (!assignmentNotice) return;
    const timer = setTimeout(() => setAssignmentNotice(null), 15_000);
    return () => clearTimeout(timer);
  }, [assignmentNotice]);

  useEffect(() => {
    if (!suiteNotice) return;
    const timer = setTimeout(() => setSuiteNotice(null), 15_000);
    return () => clearTimeout(timer);
  }, [suiteNotice]);

  return {
    projects, setProjects,
    students, setStudents,
    groups, setGroups,
    selectedProjectId, setSelectedProjectId,
    selectedProject,
    focusedGroupId, setFocusedGroupId,
    focusedGroup,
    selectedStudentIds, setSelectedStudentIds,
    bulkStudentEmails, setBulkStudentEmails,
    groupStudentSearch, setGroupStudentSearch,
    selectedGroupIds, setSelectedGroupIds,
    selectedGroupStudentIds, setSelectedGroupStudentIds,
    bulkGroupStudentEmails, setBulkGroupStudentEmails,
    assignmentsResult,
    groupEnrollments,
    testSuiteFile, setTestSuiteFile,
    testSuiteResult,
    groupForm, setGroupForm,
    createForm, setCreateForm,
    editForm, setEditForm,
    deleteId, setDeleteId,
    confirmOpen, setConfirmOpen,
    projectNotice, assignmentNotice, suiteNotice, editorNotice,
    debugPayload,
    loadingProjects, loadingStudents, loadingGroups, assignmentBusy,
    canRead, canWrite, canAdmin,
    refreshProjects, refreshAssignments, refreshGroups, refreshGroupEnrollments,
    handleCreate, handleUpdate, handleAssignStudents, handleAssignGroups, handleRevokeAssignment,
    handleBulkEmailImport, handleGroupBulkEmailImport,
    handleCreateGroup, handleEnrollGroupStudents, handleRevokeGroupEnrollment,
    handleUploadTestSuite, handleFetchTestSuite, handleRemoveTestSuite,
    executeDelete
  };
}
