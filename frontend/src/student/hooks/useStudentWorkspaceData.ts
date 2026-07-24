/**
 * @fileoverview Hook de lógica de negocio para el espacio del estudiante (useStudentWorkspaceData).
 *
 * @module useStudentWorkspaceData
 */

import { useState, useEffect, useCallback } from "react";
import { assignmentsApi, deliveriesApi } from "../../shared/api/services";
import { builderApi } from "../../shared/api/builderApi";
import type {
  BuildRunEntity,
  ProjectAssignmentEntity,
  DeliveryEntity,
} from "../../shared/types";
import { getErrorMessage } from "../../shared/utils/errors";

export interface StudentWorkspaceData {
  assignments: ProjectAssignmentEntity[];
  deliveries: DeliveryEntity[];
  latestDelivery: DeliveryEntity | null;
  latestRunByDeliveryId: Record<string, BuildRunEntity | null>;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useStudentWorkspaceData(): StudentWorkspaceData {
  const [assignments, setAssignments] = useState<ProjectAssignmentEntity[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryEntity[]>([]);
  const [latestRunByDeliveryId, setLatestRunByDeliveryId] = useState<
    Record<string, BuildRunEntity | null>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [asgs, dels] = await Promise.all([
        assignmentsApi.listMine(),
        deliveriesApi.list({ limit: 50, sortBy: "createdAt", sortOrder: "DESC" }),
      ]);
      setAssignments(asgs);
      setDeliveries(dels.data);
      try {
        const latestRuns = await builderApi.listLatestRunsByDeliveries(
          dels.data.map((delivery) => delivery.id),
        );
        setLatestRunByDeliveryId(latestRuns);
      } catch {
        setLatestRunByDeliveryId({});
      }
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const latestDelivery = deliveries.length > 0 ? deliveries[0] : null;

  return {
    assignments,
    deliveries,
    latestDelivery,
    latestRunByDeliveryId,
    loading,
    error,
    refresh: loadData,
  };
}
