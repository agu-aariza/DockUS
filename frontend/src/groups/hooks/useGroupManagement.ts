/**
 * @fileoverview Gestión reactiva de grupos y matrículas con React Query.
 *
 * @module useGroupManagement
 */

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { groupsApi, usersApi } from "../../shared/api/services";
import type {
  BulkGroupEnrollResponse,
  CourseGroupEntity,
} from "../../features/groups/types";
import { getErrorMessage } from "../../shared/utils/errors";
import { normalizeOptionalText } from "../../projects/hooks/projectManagement.utils";
import { queryKeys } from "../../shared/query/queryKeys";

export interface GroupFormValues {
  name: string;
  code: string;
  description: string;
}

interface UseGroupManagementOptions {
  canWrite: boolean;
  focusedGroupId: string;
  studentSearch: string;
  studentPage: number;
  directoryEnabled: boolean;
}

type Notice = {
  text: string;
  tone: "info" | "warning" | "success" | "error";
};

const STUDENTS_PER_PAGE = 20;

export function useGroupManagement({
  canWrite,
  focusedGroupId,
  studentSearch,
  studentPage,
  directoryEnabled,
}: UseGroupManagementOptions) {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<Notice | null>(null);

  const studentQuery = useMemo(
    () => ({
      page: studentPage,
      limit: STUDENTS_PER_PAGE,
      role: "STUDENT" as const,
      search: studentSearch.trim() || undefined,
      sortBy: "lastName",
      sortOrder: "ASC" as const,
    }),
    [studentPage, studentSearch],
  );

  const groupsQuery = useQuery({
    queryKey: queryKeys.groups.list(),
    queryFn: ({ signal }) => groupsApi.list(signal),
    enabled: canWrite,
  });

  const enrollmentsQuery = useQuery({
    queryKey: queryKeys.groups.enrollments(focusedGroupId),
    queryFn: () => groupsApi.listEnrollments(focusedGroupId),
    enabled: canWrite && Boolean(focusedGroupId),
  });

  const studentsQuery = useQuery({
    queryKey: queryKeys.users.list(studentQuery),
    queryFn: () => usersApi.list(studentQuery),
    enabled: canWrite && Boolean(focusedGroupId) && directoryEnabled,
  });

  const invalidateMembership = async (groupId: string) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.groups.list(), exact: true }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.groups.enrollments(groupId),
        exact: true,
      }),
    ]);
  };

  const createMutation = useMutation({
    mutationFn: (payload: {
      name: string;
      code?: string;
      description?: string;
    }) => groupsApi.create(payload),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.groups.list(), exact: true }),
  });

  const updateMutation = useMutation({
    mutationFn: ({
      groupId,
      payload,
    }: {
      groupId: string;
      payload: Partial<{
        name: string;
        code: string;
        description: string;
      }>;
    }) => groupsApi.update(groupId, payload),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.groups.list(), exact: true }),
  });

  const deleteMutation = useMutation({
    mutationFn: (groupId: string) => groupsApi.remove(groupId),
    onSuccess: async (_, groupId) => {
      queryClient.removeQueries({
        queryKey: queryKeys.groups.enrollments(groupId),
        exact: true,
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.groups.list(), exact: true });
    },
  });

  const enrollMutation = useMutation({
    mutationFn: ({ groupId, studentId }: { groupId: string; studentId: string }) =>
      groupsApi.bulkEnroll(groupId, { studentIds: [studentId] }),
    onSuccess: (_, variables) => invalidateMembership(variables.groupId),
  });

  const revokeMutation = useMutation({
    mutationFn: ({
      groupId: _groupId,
      enrollmentId,
    }: {
      groupId: string;
      enrollmentId: string;
    }) => groupsApi.revokeEnrollment(enrollmentId),
    onSuccess: (_, variables) => invalidateMembership(variables.groupId),
  });

  const bulkEnrollMutation = useMutation({
    mutationFn: ({ groupId, rawInput }: { groupId: string; rawInput: string }) =>
      groupsApi.bulkEnroll(groupId, { rawInput }),
    onSuccess: (_, variables) => invalidateMembership(variables.groupId),
  });

  const reportError = (error: unknown) => {
    setNotice({ text: getErrorMessage(error), tone: "error" });
  };

  const createGroup = async (
    values: GroupFormValues,
  ): Promise<CourseGroupEntity | null> => {
    try {
      const group = await createMutation.mutateAsync({
        name: values.name.trim(),
        code: normalizeOptionalText(values.code),
        description: normalizeOptionalText(values.description),
      });
      setNotice({ text: `Grupo "${group.name}" creado.`, tone: "success" });
      return group;
    } catch (error) {
      reportError(error);
      return null;
    }
  };

  const updateGroup = async (
    groupId: string,
    values: GroupFormValues,
  ): Promise<boolean> => {
    try {
      await updateMutation.mutateAsync({
        groupId,
        payload: {
          name: values.name.trim(),
          code: normalizeOptionalText(values.code),
          description: normalizeOptionalText(values.description),
        },
      });
      setNotice({ text: "Grupo actualizado correctamente.", tone: "success" });
      return true;
    } catch (error) {
      reportError(error);
      return false;
    }
  };

  const deleteGroup = async (groupId: string): Promise<boolean> => {
    try {
      await deleteMutation.mutateAsync(groupId);
      setNotice({ text: "Grupo eliminado correctamente.", tone: "success" });
      return true;
    } catch (error) {
      reportError(error);
      return false;
    }
  };

  const enrollStudent = async (studentId: string): Promise<boolean> => {
    if (!focusedGroupId) return false;
    try {
      await enrollMutation.mutateAsync({ groupId: focusedGroupId, studentId });
      setNotice({ text: "Alumno matriculado.", tone: "success" });
      return true;
    } catch (error) {
      reportError(error);
      return false;
    }
  };

  const revokeEnrollment = async (enrollmentId: string): Promise<boolean> => {
    if (!focusedGroupId) return false;
    try {
      await revokeMutation.mutateAsync({
        groupId: focusedGroupId,
        enrollmentId,
      });
      setNotice({ text: "Alumno retirado del grupo.", tone: "info" });
      return true;
    } catch (error) {
      reportError(error);
      return false;
    }
  };

  const bulkEnroll = async (
    rawInput: string,
  ): Promise<BulkGroupEnrollResponse | null> => {
    if (!focusedGroupId) return null;
    try {
      const response = await bulkEnrollMutation.mutateAsync({
        groupId: focusedGroupId,
        rawInput: rawInput.trim(),
      });
      const incorporated =
        response.summary.enrolledCount + response.summary.reactivatedCount;
      const unresolved =
        response.summary.unresolvedEmails.length +
        response.summary.unresolvedNames.length;
      setNotice({
        text:
          unresolved > 0
            ? `Importación completada: ${incorporated} incorporados y ${unresolved} registros por revisar.`
            : `Importación completada: ${incorporated} alumnos incorporados.`,
        tone: unresolved > 0 ? "warning" : "success",
      });
      return response;
    } catch (error) {
      reportError(error);
      return null;
    }
  };

  const activeEnrollments = useMemo(
    () =>
      (enrollmentsQuery.data ?? [])
        .filter((enrollment) => !enrollment.revokedAt)
        .sort((left, right) =>
          left.studentName.localeCompare(right.studentName, "es", {
            sensitivity: "base",
          }),
        ),
    [enrollmentsQuery.data],
  );

  return {
    groups: groupsQuery.data ?? [],
    activeEnrollments,
    studentDirectory: studentsQuery.data?.data ?? [],
    studentMeta: studentsQuery.data?.meta ?? null,
    notice,

    isGroupsLoading: groupsQuery.isLoading,
    isGroupsFetching: groupsQuery.isFetching,
    groupsError: groupsQuery.error ? getErrorMessage(groupsQuery.error) : null,
    refetchGroups: groupsQuery.refetch,

    isEnrollmentsLoading: enrollmentsQuery.isLoading,
    enrollmentsError: enrollmentsQuery.error
      ? getErrorMessage(enrollmentsQuery.error)
      : null,
    refetchEnrollments: enrollmentsQuery.refetch,

    isStudentsLoading: studentsQuery.isLoading || studentsQuery.isFetching,
    studentsError: studentsQuery.error
      ? getErrorMessage(studentsQuery.error)
      : null,
    refetchStudents: studentsQuery.refetch,

    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isBulkEnrolling: bulkEnrollMutation.isPending,
    isEnrollingStudent: (studentId: string) =>
      enrollMutation.isPending &&
      enrollMutation.variables?.studentId === studentId,
    isRevokingEnrollment: (enrollmentId: string) =>
      revokeMutation.isPending &&
      revokeMutation.variables?.enrollmentId === enrollmentId,

    createGroup,
    updateGroup,
    deleteGroup,
    enrollStudent,
    revokeEnrollment,
    bulkEnroll,
  };
}
