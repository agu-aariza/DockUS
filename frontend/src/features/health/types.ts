/**
 * @fileoverview Definiciones de tipos y componentes de características (types).
 *
 * @module types
 */

/**
 * Espejo del `ReadinessReport` del backend (`modules/health/health.service.ts`).
 */

export type DependencyStatus = "up" | "down";

export interface DependencyHealth {
  status: DependencyStatus;
  latencyMs: number;
  info?: string;
}

export type ReadinessDependency = "database" | "redis" | "docker" | "bedrock";

export interface ReadinessReport {
  status: "ok" | "error";
  timestamp: string;
  checks: Record<ReadinessDependency, DependencyHealth>;
}

/** Etiqueta legible de cada dependencia. La UI nunca muestra la clave cruda. */
export const DEPENDENCY_LABEL: Record<ReadinessDependency, string> = {
  database: "postgres",
  redis: "redis",
  docker: "docker",
  bedrock: "bedrock",
};
