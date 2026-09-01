/**
 * @fileoverview Módulo de integración con la API REST (usersApi).
 *
 * @module usersApi
 */

import { http } from "../../shared/api/http";
import { toParams } from "../../shared/api/query-params";
import type { PaginatedResponse, UserRole } from "../../shared/types";
import type { UserEntity, UserStatus } from "../../features/auth/types";

export const usersApi = {
  async list(query: {
    page?: number;
    limit?: number;
    role?: UserRole;
    status?: UserStatus;
    search?: string;
    sortBy?: string;
    sortOrder?: "ASC" | "DESC";
  }): Promise<PaginatedResponse<UserEntity>> {
    const { data } = await http.get<PaginatedResponse<UserEntity>>("/users", {
      params: toParams(query),
    });
    return data;
  },

  async detail(id: string): Promise<UserEntity> {
    const { data } = await http.get<UserEntity>(`/users/${id}`);
    return data;
  },

  async create(payload: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role?: UserRole;
    status?: UserStatus;
  }): Promise<UserEntity> {
    const { data } = await http.post<UserEntity>("/users", payload);
    return data;
  },

  async update(
    id: string,
    payload: Partial<{
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      role: UserRole;
      status: UserStatus;
    }>,
  ): Promise<UserEntity> {
    const { data } = await http.patch<UserEntity>(`/users/${id}`, payload);
    return data;
  },

  async updateStatus(id: string, status: UserStatus): Promise<UserEntity> {
    const { data } = await http.patch<UserEntity>(
      `/users/${id}/status/${status}`,
    );
    return data;
  },

  async remove(id: string): Promise<void> {
    await http.delete(`/users/${id}`);
  },

  async restore(id: string): Promise<UserEntity> {
    const { data } = await http.patch<UserEntity>(`/users/${id}/restore`);
    return data;
  },
};
