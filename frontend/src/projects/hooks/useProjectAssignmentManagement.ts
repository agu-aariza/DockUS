/**
 * @fileoverview Vista y gestión de proyectos académicos (useProjectAssignmentManagement).
 *
 * @module useProjectAssignmentManagement
 */

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  assignmentsApi,
  groupsApi,
} from "../../shared/api/services";
import { getErrorMessage } from "../../shared/utils/errors";
import { queryKeys } from "../../shared/query/queryKeys";
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
  const queryClient = useQueryClient();
  const [focusedGroupId, setFocusedGroupId] = useState("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [bulkStudentEmails, setBulkStudentEmails] = useState("");
  const [groupStudentSearch, setGroupStudentSearch] = useState("");
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [selectedGroupStudentIds, setSelectedGroupStudentIds] = useState<string[]>([]);
  const [bulkGroupStudentEmails, setBulkGroupStudentEmails] = useState("");
  const [groupForm, setGroupForm] = useState({
    name: "",
    code: "",
    description: "",
  });
  const [assignmentNotice, setAssignmentNotice] =
    useState<NoticeState | null>(null);
  const [assignmentBusy, setAssignmentBusy] = useState<string | null>(null);

  const groupsQuery = useQuery({
    queryKey: queryKeys.groups.list(),
    queryFn: ({ signal }) => groupsApi.list(signal),
    enabled: canWrite,
  });
  const groups = groupsQuery.data ?? [];
  const loadingGroups = groupsQuery.isFetching;

  // Reusa la misma key que useDeliveryManagement/useDeliveriesPanel para el
  // mismo proyecto: es literalmente la misma llamada (assignmentsApi.listByProject),
  // así que comparten caché al navegar entre Entregas y Proyectos.
  const assignmentsQuery = useQuery({
    queryKey: queryKeys.assignments.byProject(selectedProjectId),
    queryFn: ({ signal }) => assignmentsApi.listByProject(selectedProjectId, signal),
    enabled: canWrite && !!selectedProjectId,
  });
  const assignmentsResult = assignmentsQuery.data ?? null;

  const groupEnrollmentsQuery = useQuery({
    queryKey: queryKeys.groups.enrollments(focusedGroupId),
    queryFn: () => groupsApi.listEnrollments(focusedGroupId),
    enabled: canWrite && !!focusedGroupId,
  });
  const groupEnrollments = groupEnrollmentsQuery.data ?? null;

  // Mantiene el grupo enfocado válido cuando cambia el listado (mismo patrón
  // que la selección de proyecto/entrega en los otros hooks de dominio).
  useEffect(() => {
    const data = groupsQuery.data;
    if (!data) return;
    setFocusedGroupId((current) =>
      current && data.some((group) => group.id === current) ? current : data[0]?.id ?? "",
    );
  }, [groupsQuery.data]);

  useEffect(() => {
    if (!selectedProjectId) return;
    setSelectedStudentIds([]);
    setSelectedGroupIds([]);
    setBulkStudentEmails("");
  }, [selectedProjectId]);

  useEffect(() => {
    if (!focusedGroupId) return;
    setGroupStudentSearch("");
    setSelectedGroupStudentIds([]);
    setBulkGroupStudentEmails("");
  }, [focusedGroupId]);

  useEffect(() => {
    if (!assignmentNotice) return;
    const timer = setTimeout(() => setAssignmentNotice(null), 15_000);
    return () => clearTimeout(timer);
  }, [assignmentNotice]);

  // Las tres funciones de refresh de abajo son la única vía que muestra un
  // aviso "actualizado": botones de refresco manual explícitos. Las mutaciones
  // más abajo invalidan/escriben caché directamente y nunca llaman a estas.
  const refreshAssignments = async (options?: { noticeText?: string }) => {
    if (!canWrite || !selectedProjectId) return;
    const result = await assignmentsQuery.refetch();
    if (result.data) {
      setDebugPayload(result.data);
      setAssignmentNotice({ text: options?.noticeText ?? "Asignaciones actualizadas.", tone: "info" });
    } else if (result.error) {
      setAssignmentNotice({ text: getErrorMessage(result.error), tone: "warning" });
    }
  };

  const refreshGroups = async (options?: { noticeText?: string }) => {
    if (!canWrite) return;
    const result = await groupsQuery.refetch();
    if (result.data) {
      setDebugPayload(result.data);
      setAssignmentNotice({ text: options?.noticeText ?? "Grupos docentes actualizados.", tone: "info" });
    } else if (result.error) {
      setAssignmentNotice({ text: getErrorMessage(result.error), tone: "warning" });
    }
  };

  const refreshGroupEnrollments = async (options?: { noticeText?: string }) => {
    if (!canWrite || !focusedGroupId) return;
    const result = await groupEnrollmentsQuery.refetch();
    if (result.data) {
      setDebugPayload(result.data);
      setAssignmentNotice({ text: options?.noticeText ?? "Matrículas del grupo actualizadas.", tone: "info" });
    } else if (result.error) {
      setAssignmentNotice({ text: getErrorMessage(result.error), tone: "warning" });
    }
  };

  const handleAssignStudents = async () => {
    if (!canWrite || !selectedProjectId) return;

    const payload: { studentIds?: string[]; rawInput?: string } = {
      studentIds: selectedStudentIds.length > 0 ? selectedStudentIds : undefined,
    };

    if (bulkStudentEmails.trim()) {
      payload.rawInput = bulkStudentEmails.trim();
    }

    if (!payload.studentIds && !payload.rawInput) return;

    setAssignmentBusy("assign");
    try {
      const response = await assignmentsApi.bulkAssign(selectedProjectId, payload);
      queryClient.setQueryData(queryKeys.assignments.byProject(selectedProjectId), response.assignments);
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
      queryClient.setQueryData(queryKeys.assignments.byProject(selectedProjectId), response.assignments);
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
      await queryClient.invalidateQueries({ queryKey: queryKeys.groups.list() });
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

    const payload: { studentIds?: string[]; rawInput?: string } = {
      studentIds: selectedGroupStudentIds.length > 0 ? selectedGroupStudentIds : undefined,
    };

    if (bulkGroupStudentEmails.trim()) {
      payload.rawInput = bulkGroupStudentEmails.trim();
    }

    if (!payload.studentIds && !payload.rawInput) return;

    setAssignmentBusy("group:enroll");
    try {
      const response = await groupsApi.bulkEnroll(focusedGroupId, payload);
      queryClient.setQueryData(queryKeys.groups.enrollments(focusedGroupId), response.enrollments);
      setSelectedGroupStudentIds([]);
      setBulkGroupStudentEmails("");
      // Los contadores de matrícula que muestra el listado de grupos pueden
      // haber cambiado; las matrículas en sí ya se escribieron arriba.
      await queryClient.invalidateQueries({ queryKey: queryKeys.groups.list() });
      const enrolledCount =
        response.summary.enrolledCount + response.summary.reactivatedCount;
      const unresolvedCount = (response.summary.unresolvedEmails.length || 0) + (response.summary.unresolvedNames?.length || 0);
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
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.groups.enrollments(focusedGroupId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.groups.list() }),
      ]);
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
      await queryClient.invalidateQueries({ queryKey: queryKeys.assignments.byProject(selectedProjectId) });
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

  return {
    groups,
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
