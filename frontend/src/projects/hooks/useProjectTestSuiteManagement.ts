import { type FormEvent, useEffect, useState } from "react";
import { projectsApi } from "../../shared/api/services";
import type { StorageObjectEntity } from "../../shared/types";
import { getErrorMessage } from "../../shared/utils/errors";
import type { NoticeState } from "./projectManagement.types";

interface UseProjectTestSuiteManagementInput {
  canWrite: boolean;
  selectedProjectId: string;
}

export function useProjectTestSuiteManagement({
  canWrite,
  selectedProjectId,
}: UseProjectTestSuiteManagementInput) {
  const [testSuiteFile, setTestSuiteFile] = useState<File | null>(null);
  const [testSuiteResult, setTestSuiteResult] =
    useState<StorageObjectEntity | { message: string } | null>(null);
  const [suiteNotice, setSuiteNotice] = useState<NoticeState | null>(null);

  const handleUploadTestSuite = async (file: File) => {
    if (!canWrite || !selectedProjectId || !file) return;
    try {
      const response = await projectsApi.uploadTestSuite(
        selectedProjectId,
        file,
      );
      setTestSuiteResult(response);
      setSuiteNotice({ text: "Suite docente subida correctamente.", tone: "info" });
    } catch (error) {
      setSuiteNotice({ text: getErrorMessage(error), tone: "warning" });
    }
  };

  const handleFetchTestSuite = async (silent = false, signal?: AbortSignal) => {
    if (!canWrite || !selectedProjectId) return;
    try {
      const response = await projectsApi.getTestSuite(selectedProjectId, signal);
      if (signal?.aborted) return;
      setTestSuiteResult(response);
      if (!silent) {
        setSuiteNotice({ text: "Suite docente recuperada.", tone: "info" });
      }
    } catch (error) {
      if (signal?.aborted) return;
      if (!silent) {
        setSuiteNotice({ text: getErrorMessage(error), tone: "warning" });
      }
    }
  };

  const handleRemoveTestSuite = async () => {
    if (!canWrite || !selectedProjectId) return;
    try {
      await projectsApi.removeTestSuite(selectedProjectId);
      setTestSuiteResult(null);
      setSuiteNotice({ text: "Suite docente eliminada correctamente.", tone: "info" });
    } catch (error) {
      setSuiteNotice({ text: getErrorMessage(error), tone: "warning" });
    }
  };

  useEffect(() => {
    if (!selectedProjectId) {
      setTestSuiteResult(null);
      return;
    }
    const controller = new AbortController();
    void handleFetchTestSuite(true, controller.signal);
    return () => controller.abort();
  }, [selectedProjectId]);

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
