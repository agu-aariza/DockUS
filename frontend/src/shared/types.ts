export type UserRole = "ADMIN" | "TEACHER" | "STUDENT";

export interface ApiErrorPayload {
  message: string | string[];
  error?: string;
  statusCode?: number;
}

export interface PaginatedMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginatedMeta;
}

export * from "../features/auth/types";
export * from "../features/builder/types";
export * from "../features/deliveries/types";
export * from "../features/groups/types";
export * from "../features/projects/types";
export * from "../features/storage/types";
