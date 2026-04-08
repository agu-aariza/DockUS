import axios from "axios";
import type { ApiErrorPayload } from "../types";

export const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL?.trim() || "http://localhost:3000/api";

let accessToken: string | null = null;
const authWarningListeners = new Set<(message: string) => void>();

export const http = axios.create({
  baseURL: apiBaseUrl,
  timeout: 30000,
});

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function subscribeAuthWarning(
  listener: (message: string) => void,
): () => void {
  authWarningListeners.add(listener);
  return () => {
    authWarningListeners.delete(listener);
  };
}

function notifyAuthWarning(message: string): void {
  authWarningListeners.forEach((listener) => listener(message));
}

function normalizeApiError(error: unknown): ApiErrorPayload {
  if (!axios.isAxiosError(error)) {
    return {
      statusCode: 500,
      error: "Unknown Error",
      message: "Error inesperado en cliente.",
    };
  }

  const data = error.response?.data as
    | Partial<ApiErrorPayload>
    | undefined
    | null;

  if (data?.message) {
    return {
      message: data.message,
      error: data.error,
      statusCode: data.statusCode ?? error.response?.status,
    };
  }

  return {
    statusCode: error.response?.status,
    error: error.name,
    message: error.message || "Error de red o servidor no disponible.",
  };
}

http.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  return config;
});

http.interceptors.response.use(
  (response) => response,
  (error) => {
    const normalized = normalizeApiError(error);
    if (normalized.statusCode === 401 || normalized.statusCode === 403) {
      notifyAuthWarning(
        `Permiso denegado o sesión inválida (${normalized.statusCode}).`,
      );
    }

    return Promise.reject(normalized);
  },
);
