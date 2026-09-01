import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { assignmentsApi } from "../../projects/api/assignmentsApi";
import { projectsApi } from "../../projects/api/projectsApi";
import { deliveriesApi } from "../../deliveries/api/deliveriesApi";
import { builderApi } from "../../builder/api/builderApi";
import { queryKeys } from "../../shared/query/queryKeys";
import type { ProjectAssignmentEntity } from "../../features/projects/types";
import type { ProjectEntity } from "../../features/projects/types";
import type { DeliveryEntity } from "../../features/deliveries/types";
import type { BuildRunEntity } from "../../features/builder/types";
import type { StorageFilterQuery } from "./storageManagement.types";

interface StorageFiltersInput {
  canRead: boolean;
  canTeacherOrAdmin: boolean;
}

export function useStorageFilters({ canRead, canTeacherOrAdmin }: StorageFiltersInput) {
  const [query, setQuery] = useState<StorageFilterQuery>({
    page: "1",
    limit: "20",
    projectId: "",
    deliveryId: "",
    runId: "",
    uploaderId: "",
    createdFrom: "",
    createdTo: "",
    sortBy: "createdAt",
    sortOrder: "DESC",
  });

  const projectsForFilterQuery = useQuery({
    queryKey: queryKeys.storage.projectsFilter(),
    queryFn: () => projectsApi.list({ limit: 100 }),
    enabled: canRead && canTeacherOrAdmin,
  });
  const myAssignmentsForFilterQuery = useQuery({
    queryKey: queryKeys.assignments.mine(),
    queryFn: () => assignmentsApi.listMine(),
    enabled: canRead && !canTeacherOrAdmin,
  });

  const projectsList = useMemo(() => {
    if (canTeacherOrAdmin) {
      return (projectsForFilterQuery.data?.data ?? []).map((project: ProjectEntity) => ({
        id: project.id,
        title: project.title,
      }));
    }
    return (myAssignmentsForFilterQuery.data ?? []).map((assignment: ProjectAssignmentEntity) => ({
      id: assignment.projectId,
      title: assignment.projectTitle,
    }));
  }, [canTeacherOrAdmin, projectsForFilterQuery.data, myAssignmentsForFilterQuery.data]);

  useEffect(() => {
    if (projectsForFilterQuery.isError) {
      console.error("Error fetching projects for filters:", projectsForFilterQuery.error);
    }
  }, [projectsForFilterQuery.isError, projectsForFilterQuery.error]);

  useEffect(() => {
    if (myAssignmentsForFilterQuery.isError) {
      console.error("Error fetching projects for filters:", myAssignmentsForFilterQuery.error);
    }
  }, [myAssignmentsForFilterQuery.isError, myAssignmentsForFilterQuery.error]);

  const deliveriesForFilterQuery = useQuery({
    queryKey: queryKeys.storage.deliveriesFilter(query.projectId),
    queryFn: () => deliveriesApi.list({ projectId: query.projectId, limit: 100 }),
    enabled: canRead && !!query.projectId,
  });
  const deliveriesList: DeliveryEntity[] = deliveriesForFilterQuery.data?.data ?? [];

  useEffect(() => {
    if (deliveriesForFilterQuery.isError) {
      console.error("Error fetching deliveries for filters:", deliveriesForFilterQuery.error);
    }
  }, [deliveriesForFilterQuery.isError, deliveriesForFilterQuery.error]);

  useEffect(() => {
    setQuery((previous) => ({ ...previous, deliveryId: "", runId: "" }));
  }, [query.projectId]);

  const runsForFilterQuery = useQuery({
    queryKey: queryKeys.storage.runsFilter(query.deliveryId),
    queryFn: () => builderApi.listByDelivery({ deliveryId: query.deliveryId, limit: 100 }),
    enabled: canRead && !!query.deliveryId,
  });
  const runsList: BuildRunEntity[] = runsForFilterQuery.data?.data ?? [];

  useEffect(() => {
    if (runsForFilterQuery.isError) {
      console.error("Error fetching runs for filters:", runsForFilterQuery.error);
    }
  }, [runsForFilterQuery.isError, runsForFilterQuery.error]);

  useEffect(() => {
    setQuery((previous) => ({ ...previous, runId: "" }));
  }, [query.deliveryId]);

  return { query, setQuery, projectsList, deliveriesList, runsList };
}
