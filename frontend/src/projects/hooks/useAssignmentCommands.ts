import { type Dispatch, type SetStateAction } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { assignmentsApi } from "../api/assignmentsApi";
import { getErrorMessage } from "../../shared/utils/errors";
import { queryKeys } from "../../shared/query/queryKeys";
import { appendBulkInput, readBulkInput } from "./bulkInput.util";
import type { NoticeState } from "./projectManagement.types";
import type { ProjectAssignmentState } from "./projectAssignment.reducer";

type RefetchResult = { data?: unknown; error?: unknown };
type RefetchableQuery = { refetch: () => Promise<RefetchResult> };

interface UseAssignmentCommandsInput {
  assignmentsQuery: RefetchableQuery;
  canWrite: boolean;
  selectedProjectId: string;
  state: ProjectAssignmentState;
  setAssignmentBusy: Dispatch<SetStateAction<string | null>>;
  setAssignmentNotice: Dispatch<SetStateAction<NoticeState | null>>;
  setBulkStudentEmails: Dispatch<SetStateAction<string>>;
  setDebugPayload: (payload: unknown) => void;
  setSelectedGroupIds: Dispatch<SetStateAction<string[]>>;
  setSelectedStudentIds: Dispatch<SetStateAction<string[]>>;
}

export function useAssignmentCommands({
  assignmentsQuery,
  canWrite,
  selectedProjectId,
  state,
  setAssignmentBusy,
  setAssignmentNotice,
  setBulkStudentEmails,
  setDebugPayload,
  setSelectedGroupIds,
  setSelectedStudentIds,
}: UseAssignmentCommandsInput) {
  const queryClient = useQueryClient();

  const refreshAssignments = async (options?: { noticeText?: string }) => {
    if (!canWrite || !selectedProjectId) return;
    const result = await assignmentsQuery.refetch();
    if (result.data) {
      setDebugPayload(result.data);
      setAssignmentNotice({
        text: options?.noticeText ?? "Asignaciones actualizadas.",
        tone: "info",
      });
    } else if (result.error) {
      setAssignmentNotice({ text: getErrorMessage(result.error), tone: "warning" });
    }
  };

  const handleAssignStudents = async () => {
    if (!canWrite || !selectedProjectId) return;
    const payload: { studentIds?: string[]; rawInput?: string } = {
      studentIds: state.selectedStudentIds.length > 0
        ? state.selectedStudentIds
        : undefined,
    };
    if (state.bulkStudentEmails.trim()) {
      payload.rawInput = state.bulkStudentEmails.trim();
    }
    if (!payload.studentIds && !payload.rawInput) return;

    setAssignmentBusy("assign");
    try {
      const response = await assignmentsApi.bulkAssign(selectedProjectId, payload);
      queryClient.setQueryData(
        queryKeys.assignments.byProject(selectedProjectId),
        response.assignments,
      );
      setSelectedStudentIds([]);
      setBulkStudentEmails("");
      const importedCount =
        response.summary.assignedCount + response.summary.reactivatedCount;
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
    if (!canWrite || !selectedProjectId || state.selectedGroupIds.length === 0) return;
    setAssignmentBusy("assign:groups");
    try {
      const response = await assignmentsApi.bulkAssign(selectedProjectId, {
        groupIds: state.selectedGroupIds,
      });
      queryClient.setQueryData(
        queryKeys.assignments.byProject(selectedProjectId),
        response.assignments,
      );
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
    try {
      const incoming = await readBulkInput(file);
      if (!incoming || !file) return;
      setBulkStudentEmails((current) => appendBulkInput(current, incoming));
      setAssignmentNotice({
        text: `Se ha cargado el archivo ${file.name}. Puedes revisar la lista antes de procesar.`,
        tone: "info",
      });
    } catch (error) {
      setAssignmentNotice({ text: getErrorMessage(error), tone: "warning" });
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
      await queryClient.invalidateQueries({
        queryKey: queryKeys.assignments.byProject(selectedProjectId),
      });
      if (studentId) {
        setSelectedStudentIds((current) =>
          current.filter((candidateId) => candidateId !== studentId),
        );
      }
      setAssignmentNotice({ text: "Alumno retirado del proyecto.", tone: "info" });
    } catch (error) {
      setAssignmentNotice({ text: getErrorMessage(error), tone: "warning" });
    } finally {
      setAssignmentBusy(null);
    }
  };

  return {
    refreshAssignments,
    handleAssignStudents,
    handleAssignGroups,
    handleBulkEmailImport,
    handleRevokeAssignment,
  };
}
