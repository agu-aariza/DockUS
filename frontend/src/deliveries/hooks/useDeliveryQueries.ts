import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { assignmentsApi } from "../../projects/api/assignmentsApi";
import { builderApi } from "../../builder/api/builderApi";
import { deliveriesApi } from "../api/deliveriesApi";
import { projectsApi } from "../../projects/api/projectsApi";
import { queryKeys } from "../../shared/query/queryKeys";
import type { SessionRecord } from "../../shared/session/session.types";

interface UseDeliveryQueriesInput {
  canRead: boolean;
  canWrite: boolean;
  selectedProjectId: string;
  session: SessionRecord | null;
}

export function useDeliveryQueries({
  canRead,
  canWrite,
  selectedProjectId,
  session,
}: UseDeliveryQueriesInput) {
  // Se pide por proyecto para permitir filtrar las entregas por alumno en
  // cliente sin disparar una consulta nueva por cada asignación.
  const deliveriesQuery = useQuery({
    queryKey: queryKeys.deliveries.list(selectedProjectId),
    queryFn: ({ signal }) =>
      deliveriesApi.list(
        {
          projectId: selectedProjectId,
          page: 1,
          limit: 100,
          sortBy: "createdAt",
          sortOrder: "DESC",
        },
        signal,
      ),
    enabled: canRead && !!selectedProjectId,
  });
  const deliveries = deliveriesQuery.data ?? null;

  const evaluatedIds = useMemo(
    () =>
      (deliveries?.data ?? [])
        .filter((delivery) => delivery.status === "EVALUATED")
        .map((delivery) => delivery.id),
    [deliveries],
  );
  const latestRunsQuery = useQuery({
    queryKey: queryKeys.deliveries.latestRuns(evaluatedIds),
    queryFn: () => builderApi.listLatestRunsByDeliveries(evaluatedIds),
    enabled: evaluatedIds.length > 0,
  });

  const projectsQuery = useQuery({
    queryKey: queryKeys.projects.list(),
    queryFn: ({ signal }) =>
      projectsApi.list(
        { page: 1, limit: 50, sortBy: "updatedAt", sortOrder: "DESC" },
        signal,
      ),
    enabled: canRead,
  });

  const myAssignmentsQuery = useQuery({
    queryKey: queryKeys.assignments.mine(),
    queryFn: () => assignmentsApi.listMine(),
    enabled: !!session && session.role === "STUDENT",
  });

  const assignmentsByProjectQuery = useQuery({
    queryKey: queryKeys.assignments.byProject(selectedProjectId),
    queryFn: ({ signal }) => assignmentsApi.listByProject(selectedProjectId, signal),
    enabled: canRead && canWrite && !!selectedProjectId,
  });

  const myAssignments = myAssignmentsQuery.data ?? [];
  const assignments = useMemo(() => {
    if (!selectedProjectId || !canRead) return [];
    if (canWrite) return assignmentsByProjectQuery.data ?? [];
    return myAssignments.filter((assignment) => assignment.projectId === selectedProjectId);
  }, [
    assignmentsByProjectQuery.data,
    canRead,
    canWrite,
    myAssignments,
    selectedProjectId,
  ]);

  return {
    deliveriesQuery,
    deliveries,
    latestRunsQuery,
    latestRunByDeliveryId: latestRunsQuery.data ?? {},
    projectsQuery,
    projects: projectsQuery.data?.data ?? [],
    myAssignmentsQuery,
    myAssignments,
    assignmentsByProjectQuery,
    assignments,
  };
}
