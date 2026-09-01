/**
 * @fileoverview Módulo de integración con la API REST (builderApi).
 *
 * @module builderApi
 */

import { http } from "../../shared/api/http";
import type { BuildRunEntity, BuildRunEventsPage, EvidenceArtifactDto, EnqueueBuildRunResponse, BuildRunChatMessage } from "../../features/builder/types";
import type { DownloadUrlResponse } from "../../features/storage/types";
import type { PaginatedResponse } from "../../shared/types";
import { toParams } from "../../shared/api/query-params";

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
    signal?: AbortSignal;
  }): Promise<PaginatedResponse<BuildRunEntity>> {
    const { data } = await http.get<PaginatedResponse<BuildRunEntity>>(
      `/builder/deliveries/${input.deliveryId}/runs`,
      {
        signal: input.signal,
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

  // Consulta en lote de las últimas ejecuciones para múltiples entregas.
  async listLatestRunsByDeliveries(
    deliveryIds: string[],
  ): Promise<Record<string, BuildRunEntity | null>> {
    if (deliveryIds.length === 0) {
      return {};
    }
    const { data } = await http.get<{
      data: Record<string, BuildRunEntity | null>;
    }>("/builder/deliveries/latest-runs", {
      params: toParams({ deliveryIds: deliveryIds.join(",") }),
    });
    return data.data;
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
    signal?: AbortSignal;
  }): Promise<BuildRunEventsPage> {
    const { data } = await http.get<BuildRunEventsPage>(
      `/builder/runs/${input.buildRunId}/events`,
      {
        signal: input.signal,
        params: toParams({
          afterSequence: input.afterSequence,
          limit: input.limit,
        }),
      },
    );
    return data;
  },

  async listEvidenceArtifacts(
    buildRunId: string,
  ): Promise<EvidenceArtifactDto[]> {
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

  async getEvidenceContent(
    buildRunId: string,
    artifactId: string,
  ): Promise<string> {
    const { data } = await http.get<string>(
      `/builder/runs/${buildRunId}/evidence/${artifactId}/content`,
      { responseType: "text" },
    );
    return data;
  },

  async getEvidenceContentAsBlob(
    buildRunId: string,
    artifactId: string,
  ): Promise<Blob> {
    const { data } = await http.get<Blob>(
      `/builder/runs/${buildRunId}/evidence/${artifactId}/content`,
      { responseType: "blob" },
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

  async getChatMessages(buildRunId: string): Promise<BuildRunChatMessage[]> {
    const { data } = await http.get<BuildRunChatMessage[]>(
      `/builder/runs/${buildRunId}/chat/messages`,
    );
    return data;
  },

  async sendChatMessage(
    buildRunId: string,
    message: string,
  ): Promise<BuildRunChatMessage> {
    const { data } = await http.post<BuildRunChatMessage>(
      `/builder/runs/${buildRunId}/chat`,
      { message },
    );
    return data;
  },
};
