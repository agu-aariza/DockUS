/**
 * @fileoverview Vista y gestión de proyectos académicos (useProjectTestSuiteManagement).
 *
 * @module useProjectTestSuiteManagement
 */

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { projectsApi } from "../api/projectsApi";
import { getErrorMessage } from "../../shared/utils/errors";
import { queryKeys } from "../../shared/query/queryKeys";
import type { NoticeState } from "./projectManagement.types";

interface UseProjectTestSuiteManagementInput {
  canWrite: boolean;
  selectedProjectId: string;
}

export function useProjectTestSuiteManagement({
  canWrite,
  selectedProjectId,
}: UseProjectTestSuiteManagementInput) {
  const queryClient = useQueryClient();
  const [testSuiteFile, setTestSuiteFile] = useState<File | null>(null);
  const [suiteNotice, setSuiteNotice] = useState<NoticeState | null>(null);

  // Carga automática al cambiar de proyecto: silenciosa (sin notice), y la
  // caché por queryKey ya resuelve lo que antes hacía el AbortController
  // manual al cambiar rápido de proyecto (React Query aborta la petición
  // obsoleta por su cuenta cuando la key cambia antes de resolver).
  const testSuiteQuery = useQuery({
    queryKey: queryKeys.projects.testSuite(selectedProjectId),
    queryFn: ({ signal }) => projectsApi.getTestSuite(selectedProjectId, signal),
    enabled: canWrite && !!selectedProjectId,
  });
  const testSuiteResult = testSuiteQuery.data ?? null;

  const uploadMutation = useMutation({
    mutationFn: (file: File) => projectsApi.uploadTestSuite(selectedProjectId, file),
  });
  const removeMutation = useMutation({
    mutationFn: () => projectsApi.removeTestSuite(selectedProjectId),
  });

  const handleUploadTestSuite = async (file: File) => {
    if (!canWrite || !selectedProjectId || !file) return;
    try {
      const response = await uploadMutation.mutateAsync(file);
      queryClient.setQueryData(queryKeys.projects.testSuite(selectedProjectId), response);
      setSuiteNotice({ text: "Suite docente subida correctamente.", tone: "info" });
    } catch (error) {
      setSuiteNotice({ text: getErrorMessage(error), tone: "warning" });
    }
  };

  // Único punto que muestra un aviso de fetch de suite: la acción manual
  // explícita (botón "Comprobar suite"); la carga automática de arriba nunca
  // notifica.
  const handleFetchTestSuite = async () => {
    if (!canWrite || !selectedProjectId) return;
    const result = await testSuiteQuery.refetch();
    if (result.data !== undefined) {
      setSuiteNotice({ text: "Suite docente recuperada.", tone: "info" });
    } else if (result.error) {
      setSuiteNotice({ text: getErrorMessage(result.error), tone: "warning" });
    }
  };

  const handleRemoveTestSuite = async () => {
    if (!canWrite || !selectedProjectId) return;
    try {
      await removeMutation.mutateAsync();
      queryClient.setQueryData(queryKeys.projects.testSuite(selectedProjectId), null);
      setSuiteNotice({ text: "Suite docente eliminada correctamente.", tone: "info" });
    } catch (error) {
      setSuiteNotice({ text: getErrorMessage(error), tone: "warning" });
    }
  };

  useEffect(() => {
    if (!suiteNotice) return;
    const timer = setTimeout(() => setSuiteNotice(null), 10_000);
    return () => clearTimeout(timer);
  }, [suiteNotice]);

  return {
    testSuiteFile,
    setTestSuiteFile,
    testSuiteResult,
    suiteNotice,
    setSuiteNotice,
    handleUploadTestSuite,
    handleFetchTestSuite,
    handleRemoveTestSuite,
  };
}
