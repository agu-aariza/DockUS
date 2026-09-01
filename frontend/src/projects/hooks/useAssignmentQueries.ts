import { useQuery } from "@tanstack/react-query";
import { assignmentsApi } from "../api/assignmentsApi";
import { queryKeys } from "../../shared/query/queryKeys";
import { groupsApi } from "../../groups/api/groupsApi";

interface UseAssignmentQueriesInput {
  canWrite: boolean;
  focusedGroupId: string;
  selectedProjectId: string;
}

export function useAssignmentQueries({
  canWrite,
  focusedGroupId,
  selectedProjectId,
}: UseAssignmentQueriesInput) {
  const groupsQuery = useQuery({
    queryKey: queryKeys.groups.list(),
    queryFn: ({ signal }) => groupsApi.list(signal),
    enabled: canWrite,
  });
  const assignmentsQuery = useQuery({
    queryKey: queryKeys.assignments.byProject(selectedProjectId),
    queryFn: ({ signal }) => assignmentsApi.listByProject(selectedProjectId, signal),
    enabled: canWrite && !!selectedProjectId,
  });
  const groupEnrollmentsQuery = useQuery({
    queryKey: queryKeys.groups.enrollments(focusedGroupId),
    queryFn: () => groupsApi.listEnrollments(focusedGroupId),
    enabled: canWrite && !!focusedGroupId,
  });

  return {
    groupsQuery,
    assignmentsQuery,
    groupEnrollmentsQuery,
    groups: groupsQuery.data ?? [],
    assignmentsResult: assignmentsQuery.data ?? null,
    groupEnrollments: groupEnrollmentsQuery.data ?? null,
    loadingGroups: groupsQuery.isFetching,
  };
}
