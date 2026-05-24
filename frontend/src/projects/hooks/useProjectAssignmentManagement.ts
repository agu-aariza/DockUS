import { useEffect, useState } from "react";
import {
  assignmentsApi,
  groupsApi,
} from "../../shared/api/services";
import type {
  CourseGroupEntity,
  GroupEnrollmentEntity,
  ProjectAssignmentEntity,
} from "../../shared/types";
import { getErrorMessage } from "../../shared/utils/errors";
import type { NoticeState } from "./projectManagement.types";
import { normalizeOptionalText } from "./projectManagement.utils";

interface UseProjectAssignmentManagementInput {
  canWrite: boolean;
  selectedProjectId: string;
  setDebugPayload: (payload: unknown) => void;
}

export function useProjectAssignmentManagement({
  canWrite,
  selectedProjectId,
  setDebugPayload,
}: UseProjectAssignmentManagementInput) {
  const [groups, setGroups] = useState<CourseGroupEntity[]>([]);
  const [focusedGroupId, setFocusedGroupId] = useState("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [bulkStudentEmails, setBulkStudentEmails] = useState("");
  const [groupStudentSearch, setGroupStudentSearch] = useState("");
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [selectedGroupStudentIds, setSelectedGroupStudentIds] = useState<string[]>([]);
  const [bulkGroupStudentEmails, setBulkGroupStudentEmails] = useState("");
  const [assignmentsResult, setAssignmentsResult] =
    useState<ProjectAssignmentEntity[] | null>(null);
  const [groupEnrollments, setGroupEnrollments] =
    useState<GroupEnrollmentEntity[] | null>(null);
  const [groupForm, setGroupForm] = useState({
    name: "",
    code: "",
    description: "",
  });
  const [assignmentNotice, setAssignmentNotice] =
    useState<NoticeState | null>(null);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [assignmentBusy, setAssignmentBusy] = useState<string | null>(null);

  const refreshAssignments = async (
    projectId = selectedProjectId,
    options?: { silent?: boolean; noticeText?: string },
    signal?: AbortSignal,
  ) => {
    if (!canWrite || !projectId) return;
    try {
      const response = await assignmentsApi.listByProject(projectId, signal);
      if (signal?.aborted) return;
      setAssignmentsResult(response);
      if (!options?.silent) {
        setAssignmentNotice({
          text: options?.noticeText ?? "Asignaciones actualizadas.",
          tone: "info",
        });
      }
      setDebugPayload(response);
    } catch (error) {
      if (signal?.aborted) return;
      setAssignmentNotice({ text: getErrorMessage(error), tone: "warning" });
    }
  };

  const refreshGroups = async (
    options?: { silent?: boolean; noticeText?: string },
    signal?: AbortSignal,
  ) => {
    if (!canWrite) return;
    setLoadingGroups(true);
    try {
      const response = await groupsApi.list(signal);
      if (signal?.aborted) return;
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
      if (signal?.aborted) return;
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

  const handleAssignStudents = async () => {
    if (!canWrite || !selectedProjectId) return;
    
    const payload: any = {
      studentIds: selectedStudentIds.length > 0 ? selectedStudentIds : undefined,
    };

    if (bulkStudentEmails.trim()) {
      payload.rawInput = bulkStudentEmails.trim();
    }

    if (!payload.studentIds && !payload.rawInput) return;

    setAssignmentBusy("assign");
    try {
      const response = await assignmentsApi.bulkAssign(selectedProjectId, payload);
      setAssignmentsResult(response.assignments);
      setSelectedStudentIds([]);
      setBulkStudentEmails("");
      const importedCount =
        response.summary.assignedCount + response.summary.reactivatedCount;
      const unresolvedCount = response.summary.unresolvedEmails.length;
      setAssignmentNotice({
        text:
          unresolvedCount > 0
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
    if (!canWrite || !selectedProjectId || selectedGroupIds.length === 0) return;
    setAssignmentBusy("assign:groups");
    try {
      const response = await assignmentsApi.bulkAssign(selectedProjectId, {
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
        current.trim() ? `${current.trim()}\n${normalized}` : normalized,
      );
      setAssignmentNotice({
        text: `Se ha cargado el archivo ${file.name}. Puedes revisar la lista antes de procesar.`,
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
        current.trim() ? `${current.trim()}\n${normalized}` : normalized,
      );
      setAssignmentNotice({
        text: `Se ha cargado el archivo ${file.name} para el grupo.`,
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
    
    const payload: any = {
      studentIds: selectedGroupStudentIds.length > 0 ? selectedGroupStudentIds : undefined,
    };

    if (bulkGroupStudentEmails.trim()) {
      payload.rawInput = bulkGroupStudentEmails.trim();
    }

    if (!payload.studentIds && !payload.rawInput) return;

    setAssignmentBusy("group:enroll");
    try {
      const response = await groupsApi.bulkEnroll(focusedGroupId, payload);
      setGroupEnrollments(response.enrollments);
      setSelectedGroupStudentIds([]);
      setBulkGroupStudentEmails("");
      await refreshGroups({ silent: true });
      const enrolledCount =
        response.summary.enrolledCount + response.summary.reactivatedCount;
      const unresolvedCount = (response.summary.unresolvedEmails?.length || 0) + (response.summary.unresolvedNames?.length || 0);
      setAssignmentNotice({
        text:
          unresolvedCount > 0
            ? `Matrícula completada con incidencias: ${enrolledCount} incorporados y ${unresolvedCount} registros no procesados.`
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
    if (!canWrite || !selectedProjectId || !assignmentId.trim()) return;
    setAssignmentBusy(`revoke:${assignmentId}`);
    try {
      await assignmentsApi.revoke(assignmentId.trim());
      await refreshAssignments(selectedProjectId, { silent: true });
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

  useEffect(() => {
    if (!canWrite) return;
    const controller = new AbortController();
    void refreshGroups({ silent: true }, controller.signal);
    return () => controller.abort();
  }, [canWrite]);

  useEffect(() => {
    if (!selectedProjectId) {
      setAssignmentsResult(null);
      return;
    }
    setSelectedStudentIds([]);
    setSelectedGroupIds([]);
    setBulkStudentEmails("");
    if (canWrite) {
      const controller = new AbortController();
      void refreshAssignments(selectedProjectId, { silent: true }, controller.signal);
      return () => controller.abort();
    }
  }, [canWrite, selectedProjectId]);

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

  useEffect(() => {
    if (!assignmentNotice) return;
    const timer = setTimeout(() => setAssignmentNotice(null), 15_000);
    return () => clearTimeout(timer);
  }, [assignmentNotice]);

  return {
    groups,
    setGroups,
    focusedGroupId,
    setFocusedGroupId,
    selectedStudentIds,
    setSelectedStudentIds,
    bulkStudentEmails,
    setBulkStudentEmails,
    groupStudentSearch,
    setGroupStudentSearch,
    selectedGroupIds,
    setSelectedGroupIds,
    selectedGroupStudentIds,
    setSelectedGroupStudentIds,
    bulkGroupStudentEmails,
    setBulkGroupStudentEmails,
    assignmentsResult,
    groupEnrollments,
    groupForm,
    setGroupForm,
    assignmentNotice,
    setAssignmentNotice,
    loadingGroups,
    assignmentBusy,
    refreshAssignments,
    refreshGroups,
    refreshGroupEnrollments,
    handleAssignStudents,
    handleAssignGroups,
    handleBulkEmailImport,
    handleGroupBulkEmailImport,
    handleCreateGroup,
    handleEnrollGroupStudents,
    handleRevokeGroupEnrollment,
    handleRevokeAssignment,
  };
}
