/**
 * @fileoverview Composición compatible de asignaciones y matrículas de proyectos.
 *
 * @module useProjectAssignmentManagement
 */

import {
  useEffect,
  useReducer,
  type SetStateAction,
} from "react";
import type { NoticeState } from "./projectManagement.types";
import {
  initialProjectAssignmentState,
  projectAssignmentReducer,
  type GroupFormState,
} from "./projectAssignment.reducer";
import { useAssignmentCommands } from "./useAssignmentCommands";
import { useAssignmentQueries } from "./useAssignmentQueries";
import { useGroupEnrollmentCommands } from "./useGroupEnrollmentCommands";

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
  const [state, dispatch] = useReducer(
    projectAssignmentReducer,
    initialProjectAssignmentState,
  );

  const setFocusedGroupId = (value: SetStateAction<string>) =>
    dispatch({ type: "set-focused-group", value });
  const setSelectedStudentIds = (value: SetStateAction<string[]>) =>
    dispatch({ type: "set-selected-students", value });
  const setBulkStudentEmails = (value: SetStateAction<string>) =>
    dispatch({ type: "set-bulk-student-emails", value });
  const setGroupStudentSearch = (value: SetStateAction<string>) =>
    dispatch({ type: "set-group-search", value });
  const setSelectedGroupIds = (value: SetStateAction<string[]>) =>
    dispatch({ type: "set-selected-groups", value });
  const setSelectedGroupStudentIds = (value: SetStateAction<string[]>) =>
    dispatch({ type: "set-selected-group-students", value });
  const setBulkGroupStudentEmails = (value: SetStateAction<string>) =>
    dispatch({ type: "set-bulk-group-student-emails", value });
  const setGroupForm = (value: SetStateAction<GroupFormState>) =>
    dispatch({ type: "set-group-form", value });
  const setAssignmentNotice = (value: SetStateAction<NoticeState | null>) =>
    dispatch({ type: "set-notice", value });
  const setAssignmentBusy = (value: SetStateAction<string | null>) =>
    dispatch({ type: "set-busy", value });

  const queries = useAssignmentQueries({
    canWrite,
    focusedGroupId: state.focusedGroupId,
    selectedProjectId,
  });

  useEffect(() => {
    const data = queries.groupsQuery.data;
    if (!data) return;
    setFocusedGroupId((current) =>
      current && data.some((group) => group.id === current)
        ? current
        : data[0]?.id ?? "",
    );
  }, [queries.groupsQuery.data]);

  useEffect(() => {
    if (!selectedProjectId) return;
    setSelectedStudentIds([]);
    setSelectedGroupIds([]);
    setBulkStudentEmails("");
  }, [selectedProjectId]);

  useEffect(() => {
    if (!state.focusedGroupId) return;
    setGroupStudentSearch("");
    setSelectedGroupStudentIds([]);
    setBulkGroupStudentEmails("");
  }, [state.focusedGroupId]);

  useEffect(() => {
    if (!state.assignmentNotice) return;
    const timer = setTimeout(() => setAssignmentNotice(null), 15_000);
    return () => clearTimeout(timer);
  }, [state.assignmentNotice]);

  const assignmentCommands = useAssignmentCommands({
    assignmentsQuery: queries.assignmentsQuery,
    canWrite,
    selectedProjectId,
    state,
    setAssignmentBusy,
    setAssignmentNotice,
    setBulkStudentEmails,
    setDebugPayload,
    setSelectedGroupIds,
    setSelectedStudentIds,
  });
  const groupCommands = useGroupEnrollmentCommands({
    canWrite,
    focusedGroupId: state.focusedGroupId,
    groupEnrollmentsQuery: queries.groupEnrollmentsQuery,
    groupsQuery: queries.groupsQuery,
    state,
    setAssignmentBusy,
    setAssignmentNotice,
    setBulkGroupStudentEmails,
    setDebugPayload,
    setFocusedGroupId,
    setGroupForm,
    setSelectedGroupIds,
    setSelectedGroupStudentIds,
  });

  return {
    groups: queries.groups,
    focusedGroupId: state.focusedGroupId,
    setFocusedGroupId,
    selectedStudentIds: state.selectedStudentIds,
    setSelectedStudentIds,
    bulkStudentEmails: state.bulkStudentEmails,
    setBulkStudentEmails,
    groupStudentSearch: state.groupStudentSearch,
    setGroupStudentSearch,
    selectedGroupIds: state.selectedGroupIds,
    setSelectedGroupIds,
    selectedGroupStudentIds: state.selectedGroupStudentIds,
    setSelectedGroupStudentIds,
    bulkGroupStudentEmails: state.bulkGroupStudentEmails,
    setBulkGroupStudentEmails,
    assignmentsResult: queries.assignmentsResult,
    groupEnrollments: queries.groupEnrollments,
    groupForm: state.groupForm,
    setGroupForm,
    assignmentNotice: state.assignmentNotice,
    setAssignmentNotice,
    loadingGroups: queries.loadingGroups,
    assignmentBusy: state.assignmentBusy,
    refreshAssignments: assignmentCommands.refreshAssignments,
    refreshGroups: groupCommands.refreshGroups,
    refreshGroupEnrollments: groupCommands.refreshGroupEnrollments,
    handleAssignStudents: assignmentCommands.handleAssignStudents,
    handleAssignGroups: assignmentCommands.handleAssignGroups,
    handleBulkEmailImport: assignmentCommands.handleBulkEmailImport,
    handleGroupBulkEmailImport: groupCommands.handleGroupBulkEmailImport,
    handleCreateGroup: groupCommands.handleCreateGroup,
    handleEnrollGroupStudents: groupCommands.handleEnrollGroupStudents,
    handleRevokeGroupEnrollment: groupCommands.handleRevokeGroupEnrollment,
    handleRevokeAssignment: assignmentCommands.handleRevokeAssignment,
  };
}
