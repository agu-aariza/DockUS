/**
 * @fileoverview Módulo de integración con la API REST (assignmentsApi).
 *
 * @module assignmentsApi
 */

import { http } from "../../shared/api/http";
import { normalizeStringArray } from "../../shared/api/query-params";
import type { BulkAssignResponse, ProjectAssignmentEntity } from "../../features/projects/types";

export const assignmentsApi = {
  async bulkAssign(
    projectId: string,
    payload: {
      studentIds?: string[];
      studentEmails?: string[];
      groupIds?: string[];
      rawInput?: string;
    },
  ): Promise<BulkAssignResponse> {
    const sanitizedPayload = {
      studentIds: normalizeStringArray(payload.studentIds),
      studentEmails: normalizeStringArray(payload.studentEmails),
      groupIds: normalizeStringArray(payload.groupIds),
      rawInput: payload.rawInput,
    };
    const { data } = await http.post<BulkAssignResponse>(
      `/projects/${projectId}/assignments/bulk`,
      sanitizedPayload,
    );
    return data;
  },

  async listByProject(
    projectId: string,
    signal?: AbortSignal,
  ): Promise<ProjectAssignmentEntity[]> {
    const { data } = await http.get<ProjectAssignmentEntity[]>(
      `/projects/${projectId}/assignments`,
      { signal },
    );
    return data;
  },

  async listMine(): Promise<ProjectAssignmentEntity[]> {
    const { data } =
      await http.get<ProjectAssignmentEntity[]>("/assignments/me");
    return data;
  },

  async revoke(assignmentId: string): Promise<{ message: string }> {
    const { data } = await http.delete<{ message: string }>(
      `/assignments/${assignmentId}`,
    );
    return data;
  },
};
