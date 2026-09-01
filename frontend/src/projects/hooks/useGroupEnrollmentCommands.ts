import { type Dispatch, type SetStateAction } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { groupsApi } from "../../groups/api/groupsApi";
import { getErrorMessage } from "../../shared/utils/errors";
import { queryKeys } from "../../shared/query/queryKeys";
import { appendBulkInput, readBulkInput } from "./bulkInput.util";
import type { NoticeState } from "./projectManagement.types";
import type { GroupFormState, ProjectAssignmentState } from "./projectAssignment.reducer";

type RefetchResult = { data?: unknown; error?: unknown };
type RefetchableQuery = { refetch: () => Promise<RefetchResult> };

interface UseGroupEnrollmentCommandsInput {
  canWrite: boolean;
  focusedGroupId: string;
  groupEnrollmentsQuery: RefetchableQuery;
  groupsQuery: RefetchableQuery;
  state: ProjectAssignmentState;
  setAssignmentBusy: Dispatch<SetStateAction<string | null>>;
  setAssignmentNotice: Dispatch<SetStateAction<NoticeState | null>>;
  setBulkGroupStudentEmails: Dispatch<SetStateAction<string>>;
  setDebugPayload: (payload: unknown) => void;
  setFocusedGroupId: Dispatch<SetStateAction<string>>;
  setGroupForm: Dispatch<SetStateAction<GroupFormState>>;
  setSelectedGroupIds: Dispatch<SetStateAction<string[]>>;
  setSelectedGroupStudentIds: Dispatch<SetStateAction<string[]>>;
}

export function useGroupEnrollmentCommands({
  canWrite,
  focusedGroupId,
  groupEnrollmentsQuery,
  groupsQuery,
  state,
  setAssignmentBusy,
  setAssignmentNotice,
  setBulkGroupStudentEmails,
  setDebugPayload,
  setFocusedGroupId,
  setGroupForm,
  setSelectedGroupIds,
  setSelectedGroupStudentIds,
}: UseGroupEnrollmentCommandsInput) {
  const queryClient = useQueryClient();

  const refreshGroups = async (options?: { noticeText?: string }) => {
    if (!canWrite) return;
    const result = await groupsQuery.refetch();
    if (result.data) {
      setDebugPayload(result.data);
      setAssignmentNotice({
        text: options?.noticeText ?? "Grupos docentes actualizados.",
        tone: "info",
      });
    } else if (result.error) {
      setAssignmentNotice({ text: getErrorMessage(result.error), tone: "warning" });
    }
  };

  const refreshGroupEnrollments = async (options?: { noticeText?: string }) => {
    if (!canWrite || !focusedGroupId) return;
    const result = await groupEnrollmentsQuery.refetch();
    if (result.data) {
      setDebugPayload(result.data);
      setAssignmentNotice({
        text: options?.noticeText ?? "Matrículas del grupo actualizadas.",
        tone: "info",
      });
    } else if (result.error) {
      setAssignmentNotice({ text: getErrorMessage(result.error), tone: "warning" });
    }
  };

  const handleGroupBulkEmailImport = async (file: File | null) => {
    try {
      const incoming = await readBulkInput(file);
      if (!incoming || !file) return;
      setBulkGroupStudentEmails((current) => appendBulkInput(current, incoming));
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
    const name = state.groupForm.name.trim();
    if (!name) return;
    setAssignmentBusy("group:create");
    try {
      const response = await groupsApi.create({
        name,
        code: state.groupForm.code.trim() || undefined,
        description: state.groupForm.description.trim() || undefined,
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
      studentIds: state.selectedGroupStudentIds.length > 0
        ? state.selectedGroupStudentIds
        : undefined,
    };
    if (state.bulkGroupStudentEmails.trim()) {
      payload.rawInput = state.bulkGroupStudentEmails.trim();
    }
    if (!payload.studentIds && !payload.rawInput) return;

    setAssignmentBusy("group:enroll");
    try {
      const response = await groupsApi.bulkEnroll(focusedGroupId, payload);
      queryClient.setQueryData(
        queryKeys.groups.enrollments(focusedGroupId),
        response.enrollments,
      );
      setSelectedGroupStudentIds([]);
      setBulkGroupStudentEmails("");
      await queryClient.invalidateQueries({ queryKey: queryKeys.groups.list() });
      const enrolledCount =
        response.summary.enrolledCount + response.summary.reactivatedCount;
      const unresolvedCount =
        response.summary.unresolvedEmails.length +
        (response.summary.unresolvedNames?.length || 0);
      setAssignmentNotice({
        text: unresolvedCount > 0
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
        queryClient.invalidateQueries({
          queryKey: queryKeys.groups.enrollments(focusedGroupId),
        }),
        queryClient.invalidateQueries({ queryKey: queryKeys.groups.list() }),
      ]);
      setAssignmentNotice({ text: "Alumno retirado del grupo.", tone: "info" });
    } catch (error) {
      setAssignmentNotice({ text: getErrorMessage(error), tone: "warning" });
    } finally {
      setAssignmentBusy(null);
    }
  };

  return {
    refreshGroups,
    refreshGroupEnrollments,
    handleGroupBulkEmailImport,
    handleCreateGroup,
    handleEnrollGroupStudents,
    handleRevokeGroupEnrollment,
  };
}
