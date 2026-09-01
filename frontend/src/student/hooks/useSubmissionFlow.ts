/**
 * @fileoverview Hook de lógica de negocio para el espacio del estudiante (useSubmissionFlow).
 *
 * @module useSubmissionFlow
 */

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { builderApi } from "../../builder/api/builderApi";
import { deliveriesApi } from "../../deliveries/api/deliveriesApi";
import { storageApi } from "../../storage/api/storageApi";
import { getErrorMessage } from "../../shared/utils/errors";
import { computeSha256Hex } from "../../shared/utils/hash";
import { queryKeys } from "../../shared/query/queryKeys";
import { useWorkspaceSelection } from "../../shared/workspace/WorkspaceContext";
import { describeAssignmentTimeline, pickPrimaryAssignment } from "../deadlineUtils";
import { deriveStudentWorkflowState, describeStudentWorkflowState } from "../studentWorkflowState";
import { deriveStudentWorkspaceInsights } from "../studentWorkspaceInsights";
import type { SubmissionPreviewFile } from "../utils/validateSubmission";
import { validateSubmissionPreview } from "../utils/validateSubmission";
import type { StudentWorkspaceData } from "./useStudentWorkspaceData";

type Step = 1 | 2 | 3 | 4;

async function previewZipFile(file: File): Promise<SubmissionPreviewFile[]> {
  // jszip (~100 KB) solo se necesita al previsualizar un archivo comprimido,
  // no en la carga inicial del flujo de entrega.
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(file);
  const previewFiles: SubmissionPreviewFile[] = [];

  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir) {
      continue;
    }

    const bytes = await entry.async("uint8array");
    const normalizedPath = path.replace(/^\.?\//, "");
    const shouldReadContent =
      bytes.byteLength <= 32_000 &&
      /\.(c|h|py|js|ts|tsx|json|toml|ya?ml|txt|md|env|cfg|ini|makefile)$/i.test(
        normalizedPath,
      );

    previewFiles.push({
      path: normalizedPath,
      sizeBytes: bytes.byteLength,
      content: shouldReadContent ? new TextDecoder("utf-8").decode(bytes) : null,
    });
  }

  return previewFiles.sort((left, right) =>
    left.path.localeCompare(right.path, "es"),
  );
}

function computeMedianDurationMs(
  runs: Array<{ startedAt?: string | null; finishedAt?: string | null }>,
): number | null {
  const durations = runs
    .map((run) => {
      if (!run.startedAt || !run.finishedAt) {
        return null;
      }
      const duration =
        new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime();
      return duration > 0 ? duration : null;
    })
    .filter((duration): duration is number => duration !== null)
    .sort((left, right) => left - right);

  if (durations.length === 0) {
    return null;
  }

  const middle = Math.floor(durations.length / 2);
  if (durations.length % 2 === 1) {
    return durations[middle];
  }

  return Math.round((durations[middle - 1] + durations[middle]) / 2);
}

export type SubmissionFlowState = ReturnType<typeof useSubmissionFlow>;

export function useSubmissionFlow(data: StudentWorkspaceData) {
  const { selection, setDelivery, setProject, setAssignment } = useWorkspaceSelection();
  const { assignments, deliveries, latestRunByDeliveryId, refresh } = data;

  const initialAssignment =
    pickPrimaryAssignment(
      assignments,
      selection.assignmentId,
      selection.projectId,
    ) ?? assignments[0] ?? null;

  const [step, setStep] = useState<Step>(1);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState(
    initialAssignment?.id,
  );
  const [file, setFile] = useState<File | null>(null);
  const [fileSizeError, setFileSizeError] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<"idle" | "uploading" | "success" | "error">(
    "idle",
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [createdVersion, setCreatedVersion] = useState<number | null>(null);
  const [createdDeliveryId, setCreatedDeliveryId] = useState<string | null>(null);
  const [createdBuildRunId, setCreatedBuildRunId] = useState<string | null>(null);
  const [buildLaunched, setBuildLaunched] = useState(false);
  const [buildLaunching, setBuildLaunching] = useState(false);
  const [buildError, setBuildError] = useState<string | null>(null);
  const [previewFiles, setPreviewFiles] = useState<SubmissionPreviewFile[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const activeAssignment =
    assignments.find((assignment) => assignment.id === selectedAssignmentId) ?? null;
  const latestAssignmentDelivery =
    deliveries.find((delivery) => delivery.assignmentId === selectedAssignmentId) ??
    null;
  const latestAssignmentRun = latestAssignmentDelivery
    ? latestRunByDeliveryId[latestAssignmentDelivery.id] ?? null
    : null;

  const previousPreviewQuery = useQuery({
    queryKey: queryKeys.deliveries.preview(latestAssignmentDelivery?.id ?? ""),
    queryFn: () => deliveriesApi.preview(latestAssignmentDelivery!.id),
    enabled: !!latestAssignmentDelivery,
  });
  const previousPreviewFiles = previousPreviewQuery.data ?? [];
  const previousPreviewError = previousPreviewQuery.isError
    ? getErrorMessage(previousPreviewQuery.error)
    : null;

  const noAssignments = assignments.length === 0;
  const noRemainingDeliveries =
    activeAssignment !== null && activeAssignment.remainingDeliveries <= 0;
  const now = Date.now();
  const notYetOpen = Boolean(
    activeAssignment?.opensAt && new Date(activeAssignment.opensAt).getTime() > now,
  );
  const afterDeadline = Boolean(
    activeAssignment?.closesAt && new Date(activeAssignment.closesAt).getTime() < now,
  );
  const activeTimeline = activeAssignment
    ? describeAssignmentTimeline(activeAssignment, now)
    : null;
  const workflow = describeStudentWorkflowState(
    deriveStudentWorkflowState({
      assignment: activeAssignment,
      delivery: latestAssignmentDelivery,
      latestRun: latestAssignmentRun,
      now,
    }),
    {
      isLate: latestAssignmentDelivery?.isLate,
      projectTitle: activeAssignment?.projectTitle,
    },
  );

  const insights = deriveStudentWorkspaceInsights(
    activeAssignment ? [activeAssignment] : [],
    latestAssignmentDelivery ? [latestAssignmentDelivery] : [],
    latestRunByDeliveryId,
  );
  const previewValidation = validateSubmissionPreview({
    expectedType: activeAssignment?.projectExpectedType ?? null,
    files: previewFiles,
    previousFiles: previousPreviewFiles,
  });
  const shouldWarnBeforeContinue =
    step === 2 &&
    file !== null &&
    previewFiles.length > 0 &&
    previewValidation.warnings.length > 0;
  const canContinueFromStep1 =
    Boolean(selectedAssignmentId) &&
    !noAssignments &&
    !noRemainingDeliveries &&
    !notYetOpen;

  const createdRun =
    createdDeliveryId !== null
      ? (() => {
          const candidate = latestRunByDeliveryId[createdDeliveryId] ?? null;
          if (!candidate) {
            return null;
          }
          return createdBuildRunId && candidate.id !== createdBuildRunId
            ? null
            : candidate;
        })()
      : null;
  const historicalMedianMs = useMemo(
    () =>
      computeMedianDurationMs(
        Object.values(latestRunByDeliveryId)
          .filter((run): run is NonNullable<typeof run> => Boolean(run))
          .slice(0, 10),
      ),
    [latestRunByDeliveryId],
  );

  useEffect(() => {
    let cancelled = false;

    if (!file) {
      setPreviewFiles([]);
      setPreviewLoading(false);
      setPreviewError(null);
      return () => {
        cancelled = true;
      };
    }

    if (!file.name.toLowerCase().endsWith(".zip") && !file.name.toLowerCase().endsWith(".tar.gz") && !file.name.toLowerCase().endsWith(".tgz")) {
      setPreviewFiles([]);
      setPreviewLoading(false);
      setPreviewError(
        "La vista previa cliente-side solo esta disponible para archivos .zip en esta fase.",
      );
      return () => {
        cancelled = true;
      };
    }

    setPreviewLoading(true);
    setPreviewError(null);

    if (file.name.toLowerCase().endsWith(".zip")) {
        void previewZipFile(file)
        .then((files) => {
            if (!cancelled) {
            setPreviewFiles(files);
            }
        })
        .catch((error) => {
            if (!cancelled) {
            setPreviewFiles([]);
            setPreviewError(getErrorMessage(error));
            }
        })
        .finally(() => {
            if (!cancelled) {
            setPreviewLoading(false);
            }
        });
    } else {
        // Not supporting tar.gz preview here but resolving to allow upload
        setPreviewLoading(false);
        setPreviewFiles([]);
    }

    return () => {
      cancelled = true;
    };
  }, [file]);

  const handleNextStep = () => {
    if (step === 1 && canContinueFromStep1) {
      setStep(2);
      return;
    }

    if (step === 2 && file) {
      setStep(3);
    }
  };

  const handleFileSelection = (selectedFile: File | null) => {
    if (selectedFile && selectedFile.size > 50 * 1024 * 1024) {
      setFileSizeError(true);
      setFile(null);
      setPreviewFiles([]);
      return;
    }

    setFileSizeError(false);
    setPreviewError(null);
    setFile(selectedFile);
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
    handleFileSelection(event.dataTransfer.files?.[0]);
  };

  const handleSubmit = async () => {
    if (!selectedAssignmentId || !file) {
      return;
    }

    setStatus("uploading");
    setErrorMessage("");

    try {
      const delivery = await deliveriesApi.create({
        assignmentId: selectedAssignmentId,
      });

      const hash = await computeSha256Hex(file);

      await storageApi.upload({
        deliveryId: delivery.id,
        logicalName: file.name,
        logicalPath: `student-uploads/${file.name}`,
        contentType: file.type || "application/octet-stream",
        hash,
        sizeBytes: file.size,
        file,
      });

      if (activeAssignment) {
        setProject(activeAssignment.projectId, activeAssignment.projectTitle);
        setAssignment(activeAssignment.id, activeAssignment.projectTitle);
      }
      setDelivery(delivery.id, `v${delivery.version}`);
      setCreatedVersion(delivery.version);
      setCreatedDeliveryId(delivery.id);

      await refresh();
      setStatus("success");
      setStep(4);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setStatus("error");
    }
  };

  const handleLaunchBuilder = async () => {
    if (!createdDeliveryId) {
      return;
    }

    setBuildLaunching(true);
    setBuildError(null);

    try {
      const response = await builderApi.runForDelivery(createdDeliveryId);
      setCreatedBuildRunId(response.buildRunId);
      setBuildLaunched(true);
      await refresh();
    } catch (error) {
      setBuildError(getErrorMessage(error));
    } finally {
      setBuildLaunching(false);
    }
  };

  return {
    step,
    setStep,
    selectedAssignmentId,
    setSelectedAssignmentId,
    file,
    fileSizeError,
    isDragging,
    status,
    errorMessage,
    createdVersion,
    buildLaunched,
    buildLaunching,
    buildError,
    previewFiles,
    previewLoading,
    previewError,
    previousPreviewError,
    activeAssignment,
    latestAssignmentDelivery,
    latestAssignmentRun,
    noAssignments,
    noRemainingDeliveries,
    notYetOpen,
    afterDeadline,
    activeTimeline,
    workflow,
    insights,
    previewValidation,
    shouldWarnBeforeContinue,
    canContinueFromStep1,
    createdRun,
    historicalMedianMs,
    handleNextStep,
    handleFileSelection,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleSubmit,
    handleLaunchBuilder,
    now,
    assignments,
  };
}
