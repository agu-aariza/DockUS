import axios from "axios";
import type { ApiErrorPayload } from "../types";

export const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL?.trim() || "http://localhost:3000/api";

let accessToken: string | null = null;
let refreshToken: string | null = null;
let isRefreshing = false;
let refreshSubscribers: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

const authWarningListeners = new Set<(message: string) => void>();
const tokenUpdateListeners = new Set<(access: string, refresh: string) => void>();

export const http = axios.create({
  baseURL: apiBaseUrl,
  timeout: 30000,
  headers: {
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    Expires: "0",
  },
});

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function setRefreshToken(token: string | null): void {
  refreshToken = token;
}

export function subscribeAuthWarning(
  listener: (message: string) => void,
): () => void {
  authWarningListeners.add(listener);
  return () => {
    authWarningListeners.delete(listener);
  };
}

export function subscribeTokenUpdate(
  listener: (access: string, refresh: string) => void,
): () => void {
  tokenUpdateListeners.add(listener);
  return () => {
    tokenUpdateListeners.delete(listener);
  };
}

function notifyAuthWarning(message: string): void {
  authWarningListeners.forEach((listener) => listener(message));
}

function notifyTokenUpdate(access: string, refresh: string): void {
  tokenUpdateListeners.forEach((listener) => listener(access, refresh));
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

function onRefreshed(newToken: string): void {
  refreshSubscribers.forEach(({ resolve }) => resolve(newToken));
  refreshSubscribers = [];
}

// Sin esto, cualquier peticion encolada detras de un refresh que termina
// fallando (token de refresh expirado en servidor) obtenia una promesa que
// nunca se resolvia ni rechazaba: quedaba colgada en estado de carga hasta
// que el usuario recargara la pagina manualmente.
function onRefreshFailed(error: unknown): void {
  refreshSubscribers.forEach(({ reject }) => reject(error));
  refreshSubscribers = [];
}

function addRefreshSubscriber(
  resolve: (token: string) => void,
  reject: (error: unknown) => void,
): void {
  refreshSubscribers.push({ resolve, reject });
}

http.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  return config;
});

http.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If 401 and we have a refresh token, try to refresh
    if (
      axios.isAxiosError(error) &&
      error.response?.status === 401 &&
      refreshToken &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/refresh') &&
      !originalRequest.url?.includes('/auth/login')
    ) {
      if (isRefreshing) {
        // Another refresh is in progress — queue this request
        return new Promise((resolve, reject) => {
          addRefreshSubscriber(
            (newToken: string) => {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
              resolve(http(originalRequest));
            },
            (refreshError: unknown) => reject(normalizeApiError(refreshError)),
          );
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const response = await axios.post(
          `${apiBaseUrl}/auth/refresh`,
          { refreshToken },
          { timeout: 15000 },
        );

        const newAccessToken = response.data.accessToken as string;
        const newRefreshToken = response.data.refreshToken as string;

        setAccessToken(newAccessToken);
        setRefreshToken(newRefreshToken);
        notifyTokenUpdate(newAccessToken, newRefreshToken);

        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        onRefreshed(newAccessToken);

        return http(originalRequest);
      } catch (refreshError) {
        // Refresh failed — session is truly expired
        setAccessToken(null);
        setRefreshToken(null);
        notifyAuthWarning(
          "Tu sesión ha expirado. Inicia sesión de nuevo.",
        );
        onRefreshFailed(refreshError);
        return Promise.reject(normalizeApiError(error));
      } finally {
        isRefreshing = false;
      }
    }

    const normalized = normalizeApiError(error);
    if (normalized.statusCode === 401) {
      // No refresh token available
      setAccessToken(null);
      setRefreshToken(null);
      notifyAuthWarning(
        `Tu sesión ha expirado. Inicia sesión de nuevo.`,
      );
    } else if (normalized.statusCode === 403) {
      notifyAuthWarning(
        `Permiso denegado (${normalized.statusCode}).`,
      );
    }

    return Promise.reject(normalized);
  },
);
