import { http } from "./http";
import type {
  BuildRunEntity,
  BuildRunEventsPage,
  DownloadUrlResponse,
  EvidenceArtifactDto,
  EnqueueBuildRunResponse,
  PaginatedResponse,
} from "../types";

function toParams(
  input: Record<string, string | number | undefined>,
): URLSearchParams {
  const params = new URLSearchParams();
  Object.entries(input).forEach(([key, value]) => {
    if (value === undefined) return;
    const normalized = String(value).trim();
    if (!normalized) return;
    params.set(key, normalized);
  });
  return params;
}

export const builderApi = {
  async runForDelivery(deliveryId: string): Promise<EnqueueBuildRunResponse> {
    const { data } = await http.post<EnqueueBuildRunResponse>(
      `/builder/deliveries/${deliveryId}/run`,
    );
    return data;
  },

  async detail(buildRunId: string): Promise<BuildRunEntity> {
    const { data } = await http.get<BuildRunEntity>(
      `/builder/runs/${buildRunId}`,
    );
    return data;
  },

  async listByDelivery(input: {
    deliveryId: string;
    page?: number;
    limit?: number;
    status?: string;
    sortOrder?: "ASC" | "DESC";
  }): Promise<PaginatedResponse<BuildRunEntity>> {
    const { data } = await http.get<PaginatedResponse<BuildRunEntity>>(
      `/builder/deliveries/${input.deliveryId}/runs`,
      {
        params: toParams({
          page: input.page,
          limit: input.limit,
          status: input.status,
          sortOrder: input.sortOrder,
        }),
      },
    );
    return data;
  },

  async cancel(
    buildRunId: string,
  ): Promise<{ buildRunId: string; status: string }> {
    const { data } = await http.post<{ buildRunId: string; status: string }>(
      `/builder/runs/${buildRunId}/cancel`,
    );
    return data;
  },

  async listEvents(input: {
    buildRunId: string;
    afterSequence?: number;
    limit?: number;
  }): Promise<BuildRunEventsPage> {
    const { data } = await http.get<BuildRunEventsPage>(
      `/builder/runs/${input.buildRunId}/events`,
      {
        params: toParams({
          afterSequence: input.afterSequence,
          limit: input.limit,
        }),
      },
    );
    return data;
  },

  async listEvidenceArtifacts(buildRunId: string): Promise<EvidenceArtifactDto[]> {
    const { data } = await http.get<EvidenceArtifactDto[]>(
      `/builder/runs/${buildRunId}/evidence`,
    );
    return data;
  },

  async getEvidenceDownloadUrl(
    buildRunId: string,
    artifactId: string,
  ): Promise<DownloadUrlResponse> {
    const { data } = await http.get<DownloadUrlResponse>(
      `/builder/runs/${buildRunId}/evidence/${artifactId}/download-url`,
    );
    return data;
  },

  async getQualityInsights(assignmentId: string): Promise<{
    totalDeliveriesAnalyzed: number;
    insights: Array<{ title: string; count: number; category: string }>;
  }> {
    const { data } = await http.get(
      `/builder/assignments/${assignmentId}/quality-insights`,
    );
    return data;
  },
};
