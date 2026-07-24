import { http } from "./http";
import { toParams } from "./query-params";
import type { DeliveryEntity, DeliveryStatus } from "../../features/deliveries/types";
import type { PaginatedResponse } from "../types";

export const deliveriesApi = {
  async list(
    query: {
      page?: number;
      limit?: number;
      projectId?: string;
      assignmentId?: string;
      authorId?: string;
      status?: DeliveryStatus;
      sortBy?: string;
      sortOrder?: "ASC" | "DESC";
    },
    signal?: AbortSignal,
  ): Promise<PaginatedResponse<DeliveryEntity>> {
    const { data } = await http.get<PaginatedResponse<DeliveryEntity>>(
      "/deliveries",
      { params: toParams(query), signal },
    );
    return data;
  },

  async detail(id: string): Promise<DeliveryEntity> {
    const { data } = await http.get<DeliveryEntity>(`/deliveries/${id}`);
    return data;
  },

  async create(payload: {
    assignmentId: string;
    status?: DeliveryStatus;
    notes?: string;
  }): Promise<DeliveryEntity> {
    const { data } = await http.post<DeliveryEntity>("/deliveries", payload);
    return data;
  },

  async update(
    id: string,
    payload: Partial<{
      assignmentId: string;
      status: DeliveryStatus;
      notes: string;
    }>,
  ): Promise<DeliveryEntity> {
    const { data } = await http.patch<DeliveryEntity>(
      `/deliveries/${id}`,
      payload,
    );
    return data;
  },

  async updateStatus(
    id: string,
    status: DeliveryStatus,
  ): Promise<DeliveryEntity> {
    const { data } = await http.patch<DeliveryEntity>(
      `/deliveries/${id}/status/${status}`,
    );
    return data;
  },

  async updateGrading(
    id: string,
    payload: Partial<{
      grade: number | null;
      graderNotes: string;
    }>,
  ): Promise<DeliveryEntity> {
    const { data } = await http.patch<DeliveryEntity>(
      `/deliveries/${id}/grading`,
      payload,
    );
    return data;
  },

  async remove(id: string): Promise<void> {
    await http.delete(`/deliveries/${id}`);
  },

  async restore(id: string): Promise<DeliveryEntity> {
    const { data } = await http.patch<DeliveryEntity>(
      `/deliveries/${id}/restore`,
    );
    return data;
  },

  async preview(id: string): Promise<Array<{ path: string; content: string }>> {
    const { data } = await http.get<Array<{ path: string; content: string }>>(
      `/deliveries/${id}/preview`,
    );
    return data;
  },
};
