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

  const handleUploadTestSuite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canWrite || !selectedProjectId || !testSuiteFile) return;
    try {
      const response = await projectsApi.uploadTestSuite(
        selectedProjectId,
        testSuiteFile,
      );
      setTestSuiteResult(response);
      setSuiteNotice({ text: "Suite docente subida.", tone: "info" });
    } catch (error) {
      setSuiteNotice({ text: getErrorMessage(error), tone: "warning" });
    }
  };

  const handleFetchTestSuite = async () => {
    if (!canWrite || !selectedProjectId) return;
    try {
      const response = await projectsApi.getTestSuite(selectedProjectId);
      setTestSuiteResult(response);
      setSuiteNotice({ text: "Suite docente recuperada.", tone: "info" });
    } catch (error) {
      setSuiteNotice({ text: getErrorMessage(error), tone: "warning" });
    }
  };

  const handleRemoveTestSuite = async () => {
    if (!canWrite || !selectedProjectId) return;
    try {
      await projectsApi.removeTestSuite(selectedProjectId);
      setTestSuiteResult(null);
      setSuiteNotice({ text: "Suite docente eliminada.", tone: "info" });
    } catch (error) {
      setSuiteNotice({ text: getErrorMessage(error), tone: "warning" });
    }
  };

  useEffect(() => {
    if (!suiteNotice) return;
    const timer = setTimeout(() => setSuiteNotice(null), 15_000);
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
