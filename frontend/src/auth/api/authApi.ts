/**
 * @fileoverview Módulo de integración con la API REST (authApi).
 *
 * @module authApi
 */

import { http } from "../../shared/api/http";
import type { AuthResponse } from "../../features/auth/types";
import type { UserRole } from "../../shared/types";

export const authApi = {
  async register(payload: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }): Promise<AuthResponse> {
    const { data } = await http.post<AuthResponse>("/auth/register", payload);
    return data;
  },

  async login(payload: {
    email: string;
    password: string;
  }): Promise<AuthResponse> {
    const { data } = await http.post<AuthResponse>("/auth/login", payload);
    return data;
  },

  async profile(): Promise<{ userId: string; email: string; role: UserRole }> {
    const { data } = await http.get<{
      userId: string;
      email: string;
      role: UserRole;
    }>("/auth/profile");
    return data;
  },

  async refresh(refreshToken: string): Promise<AuthResponse> {
    const { data } = await http.post<AuthResponse>("/auth/refresh", {
      refreshToken,
    });
    return data;
  },
};
