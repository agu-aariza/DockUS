import type { SetStateAction } from "react";
import type { NoticeState } from "./projectManagement.types";

export interface GroupFormState {
  name: string;
  code: string;
  description: string;
}

export interface ProjectAssignmentState {
  focusedGroupId: string;
  selectedStudentIds: string[];
  bulkStudentEmails: string;
  groupStudentSearch: string;
  selectedGroupIds: string[];
  selectedGroupStudentIds: string[];
  bulkGroupStudentEmails: string;
  groupForm: GroupFormState;
  assignmentNotice: NoticeState | null;
  assignmentBusy: string | null;
}

export const initialProjectAssignmentState: ProjectAssignmentState = {
  focusedGroupId: "",
  selectedStudentIds: [],
  bulkStudentEmails: "",
  groupStudentSearch: "",
  selectedGroupIds: [],
  selectedGroupStudentIds: [],
  bulkGroupStudentEmails: "",
  groupForm: { name: "", code: "", description: "" },
  assignmentNotice: null,
  assignmentBusy: null,
};

type AssignmentAction =
  | { type: "set-focused-group"; value: SetStateAction<string> }
  | { type: "set-selected-students"; value: SetStateAction<string[]> }
  | { type: "set-bulk-student-emails"; value: SetStateAction<string> }
  | { type: "set-group-search"; value: SetStateAction<string> }
  | { type: "set-selected-groups"; value: SetStateAction<string[]> }
  | { type: "set-selected-group-students"; value: SetStateAction<string[]> }
  | { type: "set-bulk-group-student-emails"; value: SetStateAction<string> }
  | { type: "set-group-form"; value: SetStateAction<GroupFormState> }
  | { type: "set-notice"; value: SetStateAction<NoticeState | null> }
  | { type: "set-busy"; value: SetStateAction<string | null> };

function resolve<T>(value: SetStateAction<T>, current: T): T {
  return typeof value === "function"
    ? (value as (previous: T) => T)(current)
    : value;
}

export function projectAssignmentReducer(
  state: ProjectAssignmentState,
  action: AssignmentAction,
): ProjectAssignmentState {
  switch (action.type) {
    case "set-focused-group":
      return { ...state, focusedGroupId: resolve(action.value, state.focusedGroupId) };
    case "set-selected-students":
      return { ...state, selectedStudentIds: resolve(action.value, state.selectedStudentIds) };
    case "set-bulk-student-emails":
      return { ...state, bulkStudentEmails: resolve(action.value, state.bulkStudentEmails) };
    case "set-group-search":
      return { ...state, groupStudentSearch: resolve(action.value, state.groupStudentSearch) };
    case "set-selected-groups":
      return { ...state, selectedGroupIds: resolve(action.value, state.selectedGroupIds) };
    case "set-selected-group-students":
      return {
        ...state,
        selectedGroupStudentIds: resolve(action.value, state.selectedGroupStudentIds),
      };
    case "set-bulk-group-student-emails":
      return {
        ...state,
        bulkGroupStudentEmails: resolve(action.value, state.bulkGroupStudentEmails),
      };
    case "set-group-form":
      return { ...state, groupForm: resolve(action.value, state.groupForm) };
    case "set-notice":
      return { ...state, assignmentNotice: resolve(action.value, state.assignmentNotice) };
    case "set-busy":
      return { ...state, assignmentBusy: resolve(action.value, state.assignmentBusy) };
    default:
      return state;
  }
}

export type { AssignmentAction };
