/**
 * @fileoverview Hook de lógica de negocio para el espacio del estudiante (useStudentWorkspaceData).
 *
 * @module useStudentWorkspaceData
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { assignmentsApi, deliveriesApi } from "../../shared/api/services";
import { builderApi } from "../../shared/api/builderApi";
import type { BuildRunEntity } from "../../features/builder/types";
import type { ProjectAssignmentEntity } from "../../features/projects/types";
import type { DeliveryEntity } from "../../features/deliveries/types";
import { getErrorMessage } from "../../shared/utils/errors";
import { queryKeys } from "../../shared/query/queryKeys";

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
  const assignmentsQuery = useQuery({
    queryKey: queryKeys.assignments.mine(),
    queryFn: () => assignmentsApi.listMine(),
  });
  const deliveriesQuery = useQuery({
    queryKey: queryKeys.deliveries.mine(),
    queryFn: () => deliveriesApi.list({ limit: 50, sortBy: "createdAt", sortOrder: "DESC" }),
  });

  const assignments = assignmentsQuery.data ?? [];
  const deliveries = useMemo(() => deliveriesQuery.data?.data ?? [], [deliveriesQuery.data]);

  const deliveryIds = useMemo(() => deliveries.map((d) => d.id), [deliveries]);
  const latestRunsQuery = useQuery({
    queryKey: queryKeys.deliveries.latestRuns(deliveryIds),
    queryFn: () => builderApi.listLatestRunsByDeliveries(deliveryIds),
    enabled: deliveryIds.length > 0,
  });
  const latestRunByDeliveryId = latestRunsQuery.data ?? {};

  const loading = assignmentsQuery.isPending || deliveriesQuery.isPending;
  const error = assignmentsQuery.isError
    ? getErrorMessage(assignmentsQuery.error)
    : deliveriesQuery.isError
      ? getErrorMessage(deliveriesQuery.error)
      : null;

  const latestDelivery = deliveries.length > 0 ? deliveries[0] : null;

  const refresh = async () => {
    await Promise.all([assignmentsQuery.refetch(), deliveriesQuery.refetch()]);
  };

  return {
    assignments,
    deliveries,
    latestDelivery,
    latestRunByDeliveryId,
    loading,
    error,
    refresh,
  };
}
