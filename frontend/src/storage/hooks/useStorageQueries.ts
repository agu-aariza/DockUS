import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { storageApi } from "../api/storageApi";
import { queryKeys } from "../../shared/query/queryKeys";
import type { StorageListQuery, StorageListResponse } from "./storageManagement.types";

interface StorageQueriesInput {
  canRead: boolean;
}

export function useStorageQueries({ canRead }: StorageQueriesInput) {
  const queryClient = useQueryClient();
  const [submittedQuery, setSubmittedQuery] = useState<StorageListQuery | null>(null);

  const storageQuery = useQuery({
    queryKey: queryKeys.storage.list(submittedQuery ?? {}),
    queryFn: () => storageApi.list(submittedQuery!),
    enabled: canRead && submittedQuery !== null,
  });

  const fetchStorageList = async (nextQuery: StorageListQuery): Promise<StorageListResponse> => {
    setSubmittedQuery(nextQuery);
    return queryClient.fetchQuery({
      queryKey: queryKeys.storage.list(nextQuery),
      queryFn: () => storageApi.list(nextQuery),
      staleTime: 0,
    });
  };

  return {
    submittedQuery,
    setSubmittedQuery,
    listResponse: storageQuery.data ?? null,
    fetchStorageList,
  };
}
