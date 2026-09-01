import type { FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { storageApi } from "../api/storageApi";
import { queryKeys } from "../../shared/query/queryKeys";
import { computeSha256Hex } from "../../shared/utils/hash";
import { getErrorMessage } from "../../shared/utils/errors";
import type {
  DangerAction,
  StorageFilterQuery,
  StorageListQuery,
  StorageUploadForm,
} from "./storageManagement.types";

interface StorageCommandsInput {
  actionId: string;
  canUpload: boolean;
  dangerAction: DangerAction;
  file: File | null;
  handleList: () => Promise<void>;
  setMessage: (message: string) => void;
  setResult: (result: unknown) => void;
  uploadForm: StorageUploadForm;
}

export function buildStorageListQuery(query: StorageFilterQuery): StorageListQuery {
  return {
    page: Number(query.page) || 1,
    limit: Number(query.limit) || 20,
    deliveryId: query.deliveryId || undefined,
    projectId: query.projectId || undefined,
    uploaderId: query.uploaderId || undefined,
    createdFrom: query.createdFrom || undefined,
    createdTo: query.createdTo || undefined,
    sortBy: query.sortBy,
    sortOrder: query.sortOrder,
  };
}

export function useStorageCommands({
  actionId,
  canUpload,
  dangerAction,
  file,
  handleList,
  setMessage,
  setResult,
  uploadForm,
}: StorageCommandsInput) {
  const queryClient = useQueryClient();

  const handleUpload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canUpload || !file) return;
    try {
      const hash = await computeSha256Hex(file);
      const response = await storageApi.upload({
        ...uploadForm,
        hash,
        file,
        sizeBytes: uploadForm.includeSizeBytes ? file.size : undefined,
      });
      setResult(response);
      setMessage("Objeto subido correctamente.");
      await handleList();
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  };

  const removeMutation = useMutation({
    mutationFn: (id: string) => storageApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.storage.all }),
  });
  const purgeMutation = useMutation({
    mutationFn: (id: string) => storageApi.purge(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.storage.all }),
  });

  const executeDanger = async () => {
    if (!actionId.trim()) return;
    try {
      if (dangerAction === "DELETE") {
        await removeMutation.mutateAsync(actionId.trim());
      } else {
        await purgeMutation.mutateAsync(actionId.trim());
      }
      setMessage("Acción completada.");
      await handleList();
    } catch (error) {
      setMessage(getErrorMessage(error));
      throw error;
    }
  };

  return { handleUpload, executeDanger };
}
