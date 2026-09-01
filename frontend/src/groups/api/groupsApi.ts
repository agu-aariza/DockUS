/**
 * @fileoverview Módulo de integración con la API REST (groupsApi).
 *
 * @module groupsApi
 */

import { http } from "../../shared/api/http";
import { normalizeStringArray } from "../../shared/api/query-params";
import type { BulkGroupEnrollResponse, CourseGroupEntity, GroupEnrollmentEntity } from "../../features/groups/types";

export const groupsApi = {
  async list(signal?: AbortSignal): Promise<CourseGroupEntity[]> {
    const { data } = await http.get<CourseGroupEntity[]>("/groups", { signal });
    return data;
  },

  async create(payload: {
    name: string;
    code?: string;
    description?: string;
  }): Promise<CourseGroupEntity> {
    const { data } = await http.post<CourseGroupEntity>("/groups", payload);
    return data;
  },

  async listEnrollments(groupId: string): Promise<GroupEnrollmentEntity[]> {
    const { data } = await http.get<GroupEnrollmentEntity[]>(
      `/groups/${groupId}/enrollments`,
    );
    return data;
  },

  async bulkEnroll(
    groupId: string,
    payload: {
      studentIds?: string[];
      studentEmails?: string[];
      rawInput?: string;
    },
  ): Promise<BulkGroupEnrollResponse> {
    const sanitizedPayload = {
      studentIds: normalizeStringArray(payload.studentIds),
      studentEmails: normalizeStringArray(payload.studentEmails),
      rawInput: payload.rawInput,
    };
    const { data } = await http.post<BulkGroupEnrollResponse>(
      `/groups/${groupId}/enrollments/bulk`,
      sanitizedPayload,
    );
    return data;
  },

  async revokeEnrollment(enrollmentId: string): Promise<{ message: string }> {
    const { data } = await http.delete<{ message: string }>(
      `/groups/enrollments/${enrollmentId}`,
    );
    return data;
  },

  async update(
    id: string,
    payload: Partial<{
      name: string;
      code: string;
      description: string;
    }>,
  ): Promise<CourseGroupEntity> {
    const { data } = await http.patch<CourseGroupEntity>(
      `/groups/${id}`,
      payload,
    );
    return data;
  },

  async remove(id: string): Promise<void> {
    await http.delete(`/groups/${id}`);
  },
};
