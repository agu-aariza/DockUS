import { http } from "./http";
import { toParams } from "./query-params";
import type { BuilderOutcome, QualityInsightCategory } from "../../features/builder/types";
import type { DeliveryStatus } from "../../features/deliveries/types";
import type { ProjectEntity, ProjectGradebookRow, ProjectOperationalIssuesReconcileResult, ProjectOperationalIssuesSummary, ProjectProgressSummary, ProjectQualityInsightsResponse, ProjectStatus, ProjectStudentQualityInsightsResponse, RubricCriterion } from "../../features/projects/types";
import type { PaginatedResponse } from "../types";
import type { StorageObjectEntity } from "../../features/storage/types";

export const projectsApi = {
  async list(
    query: {
      page?: number;
      limit?: number;
      status?: ProjectStatus;
      creatorId?: string;
      search?: string;
      createdFrom?: string;
      createdTo?: string;
      sortBy?: string;
      sortOrder?: "ASC" | "DESC";
    },
    signal?: AbortSignal,
  ): Promise<PaginatedResponse<ProjectEntity>> {
    const { data } = await http.get<PaginatedResponse<ProjectEntity>>(
      "/projects",
      { params: toParams(query), signal },
    );
    return data;
  },

  async detail(id: string): Promise<ProjectEntity> {
    const { data } = await http.get<ProjectEntity>(`/projects/${id}`);
    return data;
  },

  async create(payload: {
    title: string;
    contextAcademico?: string;
    status?: ProjectStatus;
    maxDeliveriesPerStudent?: number;
    expectedType?: string;
    expectedOutput?: string;
    rubricInstructions?: string;
    rubricCriteria?: RubricCriterion[];
    opensAt?: string;
    closesAt?: string;
    assignedGroupIds?: string[];
  }): Promise<ProjectEntity> {
    const { data } = await http.post<ProjectEntity>("/projects", payload);
    return data;
  },

  async update(
    id: string,
    payload: Partial<{
      title: string;
      contextAcademico: string;
      status: ProjectStatus;
      maxDeliveriesPerStudent: number;
      expectedType: string;
      expectedOutput: string;
      rubricInstructions: string;
      rubricCriteria: RubricCriterion[];
      opensAt: string;
      closesAt: string;
    }>,
  ): Promise<ProjectEntity> {
    const { data } = await http.patch<ProjectEntity>(
      `/projects/${id}`,
      payload,
    );
    return data;
  },

  async updateStatus(
    id: string,
    status: ProjectStatus,
  ): Promise<ProjectEntity> {
    const { data } = await http.patch<ProjectEntity>(
      `/projects/${id}/status/${status}`,
    );
    return data;
  },

  async remove(id: string): Promise<void> {
    await http.delete(`/projects/${id}`);
  },

  async restore(id: string): Promise<ProjectEntity> {
    const { data } = await http.patch<ProjectEntity>(`/projects/${id}/restore`);
    return data;
  },

  async uploadTestSuite(
    projectId: string,
    file: File,
  ): Promise<StorageObjectEntity> {
    const formData = new FormData();
    formData.append("file", file);
    const { data } = await http.post<StorageObjectEntity>(
      `/projects/${projectId}/test-suite/upload`,
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      },
    );
    return data;
  },

  async getTestSuite(
    projectId: string,
    signal?: AbortSignal,
  ): Promise<StorageObjectEntity> {
    const { data } = await http.get<StorageObjectEntity>(
      `/projects/${projectId}/test-suite`,
      { signal },
    );
    return data;
  },

  async removeTestSuite(projectId: string): Promise<{ message: string }> {
    const { data } = await http.delete<{ message: string }>(
      `/projects/${projectId}/test-suite`,
    );
    return data;
  },

  async previewTestSuite(
    projectId: string,
  ): Promise<Array<{ path: string; content: string }>> {
    const { data } = await http.get<Array<{ path: string; content: string }>>(
      `/projects/${projectId}/test-suite/preview`,
    );
    return data;
  },

  async progressSummary(
    projectId: string,
    query?: {
      deliveryStatus?: DeliveryStatus;
      builderOutcome?: BuilderOutcome;
      lateOnly?: boolean;
      groupId?: string;
    },
  ): Promise<ProjectProgressSummary> {
    const { data } = await http.get<ProjectProgressSummary>(
      `/projects/${projectId}/progress-summary`,
      {
        params: toParams({
          deliveryStatus: query?.deliveryStatus,
          builderOutcome: query?.builderOutcome,
          lateOnly: query?.lateOnly ? "true" : undefined,
          groupId: query?.groupId,
        }),
      },
    );
    return data;
  },

  async gradebook(
    projectId: string,
    query?: {
      deliveryStatus?: DeliveryStatus;
      builderOutcome?: BuilderOutcome;
      lateOnly?: boolean;
      groupId?: string;
    },
  ): Promise<ProjectGradebookRow[]> {
    const { data } = await http.get<ProjectGradebookRow[]>(
      `/projects/${projectId}/gradebook`,
      {
        params: toParams({
          deliveryStatus: query?.deliveryStatus,
          builderOutcome: query?.builderOutcome,
          lateOnly: query?.lateOnly ? "true" : undefined,
          groupId: query?.groupId,
        }),
      },
    );
    return data;
  },

  async getOperationalIssues(): Promise<ProjectOperationalIssuesSummary> {
    const { data } = await http.get<ProjectOperationalIssuesSummary>(
      "/projects/operational-issues",
    );
    return data;
  },

  async reconcileOperationalIssues(payload: {
    mode?: "dry-run" | "apply";
    categories?: Array<
      "orphanAssignments" | "orphanDeliveries" | "orphanStorageObjects"
    >;
  }): Promise<ProjectOperationalIssuesReconcileResult> {
    const { data } = await http.post<ProjectOperationalIssuesReconcileResult>(
      "/projects/operational-issues/reconcile",
      payload,
    );
    return data;
  },

  async exportProgressSummary(
    projectId: string,
    query?: {
      deliveryStatus?: DeliveryStatus;
      builderOutcome?: BuilderOutcome;
      lateOnly?: boolean;
      groupId?: string;
    },
  ): Promise<Blob> {
    const response = await http.get(
      `/projects/${projectId}/progress-summary/export`,
      {
        params: toParams({
          deliveryStatus: query?.deliveryStatus,
          builderOutcome: query?.builderOutcome,
          lateOnly: query?.lateOnly ? "true" : undefined,
          groupId: query?.groupId,
        }),
        responseType: "blob",
      },
    );
    return response.data as Blob;
  },

  async exportGradebook(
    projectId: string,
    query?: {
      deliveryStatus?: DeliveryStatus;
      builderOutcome?: BuilderOutcome;
      lateOnly?: boolean;
      groupId?: string;
    },
  ): Promise<Blob> {
    const response = await http.get(`/projects/${projectId}/gradebook/export`, {
      params: toParams({
        deliveryStatus: query?.deliveryStatus,
        builderOutcome: query?.builderOutcome,
        lateOnly: query?.lateOnly ? "true" : undefined,
        groupId: query?.groupId,
      }),
      responseType: "blob",
    });
    return response.data as Blob;
  },

  async getQualityInsights(
    projectId: string,
  ): Promise<ProjectQualityInsightsResponse> {
    const { data } = await http.get<ProjectQualityInsightsResponse>(
      `/projects/${projectId}/quality-insights`,
    );
    return data;
  },

  async getQualityInsightsByCategory(
    projectId: string,
    category: QualityInsightCategory,
  ): Promise<ProjectQualityInsightsResponse> {
    const { data } = await http.get<ProjectQualityInsightsResponse>(
      `/projects/${projectId}/quality-insights/categories/${category}`,
    );
    return data;
  },

  async getQualityInsightsForStudent(
    projectId: string,
    studentId: string,
  ): Promise<ProjectStudentQualityInsightsResponse> {
    const { data } = await http.get<ProjectStudentQualityInsightsResponse>(
      `/projects/${projectId}/quality-insights/students/${studentId}`,
    );
    return data;
  },


  async addTeacher(
    projectId: string,
    teacherId: string,
  ): Promise<ProjectEntity> {
    const { data } = await http.post<ProjectEntity>(
      `/projects/${projectId}/teachers/${teacherId}`,
    );
    return data;
  },

  async removeTeacher(
    projectId: string,
    teacherId: string,
  ): Promise<ProjectEntity> {
    const { data } = await http.delete<ProjectEntity>(
      `/projects/${projectId}/teachers/${teacherId}`,
    );
    return data;
  },
};
