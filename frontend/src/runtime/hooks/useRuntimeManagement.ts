import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  assignmentsApi,
  builderApi,
  deliveriesApi,
  projectsApi,
} from "../../shared/api/services";
import type { BuildRunEntity, EvidenceArtifactDto } from "../../features/builder/types";
import type { DeliveryEntity } from "../../features/deliveries/types";
import type { PaginatedResponse } from "../../shared/types";
import type { ProjectAssignmentEntity, ProjectEntity } from "../../features/projects/types";
import type { SessionRecord } from "../../features/auth/types";
import { getErrorMessage } from "../../shared/utils/errors";
import { useBuilderRunStream } from "../../builder/hooks/useBuilderRunStream";

export type NoticeTone = "info" | "warning";
export interface NoticeState {
  text: string;
  tone: NoticeTone;
}

export function useRuntimeManagement(session: SessionRecord | null) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [projectOptions, setProjectOptions] = useState<ProjectEntity[]>([]);
  const [assignmentOptions, setAssignmentOptions] = useState<ProjectAssignmentEntity[]>([]);
  const [deliveryOptions, setDeliveryOptions] = useState<DeliveryEntity[]>([]);
  
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedAssignmentId, setSelectedAssignmentId] = useState("");
  const [selectedDeliveryId, setSelectedDeliveryId] = useState("");
  
  const [runsResponse, setRunsResponse] = useState<PaginatedResponse<BuildRunEntity> | null>(null);
  const [selectedRunId, setSelectedRunId] = useState("");
  const [selectedRun, setSelectedRun] = useState<BuildRunEntity | null>(null);
  const [evidenceArtifacts, setEvidenceArtifacts] = useState<EvidenceArtifactDto[]>([]);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);
  const [downloadingArtifactId, setDownloadingArtifactId] = useState<string | null>(null);
  const [previewingArtifact, setPreviewingArtifact] = useState<{
    id: string;
    type: string;
    contentType: string;
    content: string;
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState<string | null>(null);
  
  const [message, setMessage] = useState<NoticeState | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const autorunKeyRef = useRef("");

  const { events, streamError, streamState, latestSequence } = useBuilderRunStream(selectedRunId, session);
  const liveEvents = useMemo(() => [...events].slice(-80).reverse(), [events]);

  const reqProjectId = searchParams.get("projectId");
  const reqAssignmentId = searchParams.get("assignmentId");
  const reqDeliveryId = searchParams.get("deliveryId");

  const loadProjects = async () => {
    try {
      const response = await projectsApi.list({ page: 1, limit: 50, sortBy: "updatedAt", sortOrder: "DESC" });
      setProjectOptions(response.data);
      setSelectedProjectId(curr => (curr && response.data.some(p => p.id === curr)) ? curr : (reqProjectId && response.data.some(p => p.id === reqProjectId) ? reqProjectId : (response.data[0]?.id ?? "")));
    } catch (e) { setMessage({ text: getErrorMessage(e), tone: "warning" }); }
  };

  const loadRuns = async (deliveryId = selectedDeliveryId) => {
    if (!deliveryId) return;
    try {
      const response = await builderApi.listByDelivery({ deliveryId, page: 1, limit: 20, sortOrder: "DESC" });
      setRunsResponse(response);
      setSelectedRunId(curr => (curr && response.data.some(r => r.id === curr)) ? curr : (response.data[0]?.id ?? ""));
    } catch (e) { setMessage({ text: getErrorMessage(e), tone: "warning" }); }
  };

  const handleStartRun = async () => {
    if (!selectedDeliveryId) return;
    setBusyAction("run");
    try {
      const response = await builderApi.runForDelivery(selectedDeliveryId);
      setSelectedRunId(response.buildRunId);
      await loadRuns(selectedDeliveryId);
      setMessage({ text: `Run encolado: ${response.buildRunId}`, tone: "info" });
    } catch (e) { setMessage({ text: getErrorMessage(e), tone: "warning" }); }
    finally {
      setBusyAction(null);
      const next = new URLSearchParams(searchParams);
      next.delete("autorun");
      setSearchParams(next, { replace: true });
    }
  };

  const handleCancelRun = async () => {
    if (!selectedRunId) return;
    setBusyAction("cancel");
    try {
      await builderApi.cancel(selectedRunId);
      setMessage({ text: "Run cancelado.", tone: "info" });
      await loadRuns();
    } catch (e) { setMessage({ text: getErrorMessage(e), tone: "warning" }); }
    finally { setBusyAction(null); }
  };

  // Sync effects
  useEffect(() => { void loadProjects(); }, []);

  useEffect(() => {
    if (!selectedProjectId) {
      setAssignmentOptions([]);
      return;
    }
    const sync = async () => {
      try {
        const as = await assignmentsApi.listByProject(selectedProjectId);
        setAssignmentOptions(as);
        setSelectedAssignmentId(curr => (curr && as.some(a => a.id === curr)) ? curr : (reqAssignmentId && as.some(a => a.id === reqAssignmentId) ? reqAssignmentId : (as[0]?.id ?? "")));
      } catch (e) { setMessage({ text: getErrorMessage(e), tone: "warning" }); }
    };
    void sync();
  }, [reqAssignmentId, selectedProjectId]);

  useEffect(() => {
    if (!selectedAssignmentId) { setDeliveryOptions([]); return; }
    deliveriesApi.list({ assignmentId: selectedAssignmentId, page: 1, limit: 50, sortBy: "createdAt", sortOrder: "DESC" })
      .then(r => {
        setDeliveryOptions(r.data);
        setSelectedDeliveryId(curr => (curr && r.data.some(d => d.id === curr)) ? curr : (reqDeliveryId && r.data.some(d => d.id === reqDeliveryId) ? reqDeliveryId : (r.data[0]?.id ?? "")));
      });
  }, [reqDeliveryId, selectedAssignmentId]);

  useEffect(() => { if (selectedDeliveryId) void loadRuns(selectedDeliveryId); }, [selectedDeliveryId]);

  useEffect(() => {
    if (!selectedRunId) { setSelectedRun(null); return; }
    const sync = () => builderApi.detail(selectedRunId).then(setSelectedRun).catch(() => {});
    void sync();
    const inv = setInterval(sync, 3000);
    return () => clearInterval(inv);
  }, [selectedRunId]);

  useEffect(() => {
    if (!selectedRunId) {
      setEvidenceArtifacts([]);
      setEvidenceError(null);
      setEvidenceLoading(false);
      return;
    }

    let cancelled = false;
    let firstFetch = true;

    const sync = async () => {
      if (firstFetch) {
        setEvidenceLoading(true);
      }

      try {
        const artifacts = await builderApi.listEvidenceArtifacts(selectedRunId);
        if (!cancelled) {
          setEvidenceArtifacts(artifacts);
          setEvidenceError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setEvidenceError(getErrorMessage(e));
        }
      } finally {
        if (!cancelled && firstFetch) {
          setEvidenceLoading(false);
        }
        firstFetch = false;
      }
    };

    void sync();

    if (selectedRun?.isTerminal) {
      return () => {
        cancelled = true;
      };
    }

    const inv = setInterval(() => {
      firstFetch = false;
      void sync();
    }, 4000);

    return () => {
      cancelled = true;
      clearInterval(inv);
    };
  }, [selectedRun?.isTerminal, selectedRunId]);

  const handleDownloadArtifact = async (artifactId: string) => {
    if (!selectedRunId) return;

    setDownloadingArtifactId(artifactId);
    try {
      const blob = await builderApi.getEvidenceContentAsBlob(
        selectedRunId,
        artifactId,
      );
      const artifact = evidenceArtifacts.find((a) => a.id === artifactId);
      const ext = artifact?.contentType?.includes("json") ? "json" : "txt";
      const filename = `${artifact?.type ?? "artifact"}-${artifactId.slice(0, 8)}.${ext}`;

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      setMessage({ text: getErrorMessage(e), tone: "warning" });
    } finally {
      setDownloadingArtifactId(null);
    }
  };

  const handlePreviewArtifact = async (artifactId: string) => {
    if (!selectedRunId) return;

    // Toggle off if already previewing this artifact
    if (previewingArtifact?.id === artifactId) {
      setPreviewingArtifact(null);
      return;
    }

    setPreviewLoading(artifactId);
    try {
      const content = await builderApi.getEvidenceContent(
        selectedRunId,
        artifactId,
      );
      const artifact = evidenceArtifacts.find((a) => a.id === artifactId);
      setPreviewingArtifact({
        id: artifactId,
        type: artifact?.type ?? "UNKNOWN",
        contentType: artifact?.contentType ?? "text/plain",
        content,
      });
    } catch (e) {
      setMessage({ text: getErrorMessage(e), tone: "warning" });
    } finally {
      setPreviewLoading(null);
    }
  };

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    let changed = false;
    
    if (selectedProjectId && next.get("projectId") !== selectedProjectId) {
      next.set("projectId", selectedProjectId);
      changed = true;
    }
    if (selectedAssignmentId && next.get("assignmentId") !== selectedAssignmentId) {
      next.set("assignmentId", selectedAssignmentId);
      changed = true;
    }
    if (selectedDeliveryId && next.get("deliveryId") !== selectedDeliveryId) {
      next.set("deliveryId", selectedDeliveryId);
      changed = true;
    }
    
    if (changed) {
      setSearchParams(next, { replace: true });
    }
  }, [selectedProjectId, selectedAssignmentId, selectedDeliveryId, searchParams, setSearchParams]);

  useEffect(() => {
    const autorunRequested = searchParams.get("autorun") === "1";
    const nextAutorunKey = `${selectedProjectId}:${selectedAssignmentId}:${selectedDeliveryId}`;

    if (!autorunRequested || !selectedDeliveryId || busyAction === "run") {
      return;
    }

    if (autorunKeyRef.current === nextAutorunKey) {
      return;
    }

    autorunKeyRef.current = nextAutorunKey;
    void handleStartRun();
  }, [busyAction, searchParams, selectedProjectId, selectedAssignmentId, selectedDeliveryId]);

  return {
    projectOptions, assignmentOptions, deliveryOptions,
    selectedProjectId, setSelectedProjectId,
    selectedAssignmentId, setSelectedAssignmentId,
    selectedDeliveryId, setSelectedDeliveryId,
    runsResponse, selectedRunId, setSelectedRunId, selectedRun, setSelectedRun,
    evidenceArtifacts, evidenceLoading, evidenceError, downloadingArtifactId,
    previewingArtifact, setPreviewingArtifact, previewLoading,
    message, setMessage, busyAction, setBusyAction,
    streamState, latestSequence, streamError, liveEvents,
    handleStartRun, handleCancelRun, loadRuns,
    handleDownloadArtifact, handlePreviewArtifact,
  };
}
