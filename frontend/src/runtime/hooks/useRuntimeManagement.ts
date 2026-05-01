import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  assignmentsApi,
  builderApi,
  deliveriesApi,
  projectsApi,
} from "../../shared/api/services";
import type {
  BuildRunEntity,
  DeliveryEntity,
  PaginatedResponse,
  ProjectAssignmentEntity,
  ProjectEntity,
  ProjectRuntimeStatusResponse,
  SessionRecord,
} from "../../shared/types";
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
  
  const [runtimeStatus, setRuntimeStatus] = useState<ProjectRuntimeStatusResponse | null>(null);
  const [runsResponse, setRunsResponse] = useState<PaginatedResponse<BuildRunEntity> | null>(null);
  const [selectedRunId, setSelectedRunId] = useState("");
  const [selectedRun, setSelectedRun] = useState<BuildRunEntity | null>(null);
  
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

  const refreshRuntimeStatus = async (projectId = selectedProjectId) => {
    if (!projectId) return;
    try {
      const response = await projectsApi.runtime(projectId);
      setRuntimeStatus(response);
    } catch (e) {
      setMessage({ text: getErrorMessage(e), tone: "warning" });
    }
  };

  const handleReconcile = async () => {
    if (!selectedProjectId) return;
    setBusyAction("reconcile");
    try {
      await projectsApi.reconcileRuntime(selectedProjectId);
      setMessage({ text: "Reconcile solicitado.", tone: "info" });
      await refreshRuntimeStatus(selectedProjectId);
    } catch (e) { setMessage({ text: getErrorMessage(e), tone: "warning" }); }
    finally { setBusyAction(null); }
  };

  // Sync effects
  useEffect(() => { void loadProjects(); }, []);

  useEffect(() => {
    if (!selectedProjectId) {
      setAssignmentOptions([]);
      setRuntimeStatus(null);
      return;
    }
    const sync = async () => {
      try {
        const [as, rs] = await Promise.all([assignmentsApi.listByProject(selectedProjectId), projectsApi.runtime(selectedProjectId)]);
        setAssignmentOptions(as);
        setRuntimeStatus(rs);
        setSelectedAssignmentId(curr => (curr && as.some(a => a.id === curr)) ? curr : (reqAssignmentId && as.some(a => a.id === reqAssignmentId) ? reqAssignmentId : (as[0]?.id ?? "")));
      } catch (e) { setMessage({ text: getErrorMessage(e), tone: "warning" }); }
    };
    void sync();
    const inv = setInterval(() => { projectsApi.runtime(selectedProjectId).then(setRuntimeStatus).catch(() => {}); }, 5000);
    return () => clearInterval(inv);
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
    const runtimeReady = runtimeStatus?.status === "READY";
    const nextAutorunKey = `${selectedProjectId}:${selectedAssignmentId}:${selectedDeliveryId}`;

    if (!autorunRequested || !runtimeReady || !selectedDeliveryId || busyAction === "run") {
      return;
    }

    if (autorunKeyRef.current === nextAutorunKey) {
      return;
    }

    autorunKeyRef.current = nextAutorunKey;
    void handleStartRun();
  }, [busyAction, runtimeStatus?.status, searchParams, selectedProjectId, selectedAssignmentId, selectedDeliveryId]);

  return {
    projectOptions, assignmentOptions, deliveryOptions,
    selectedProjectId, setSelectedProjectId,
    selectedAssignmentId, setSelectedAssignmentId,
    selectedDeliveryId, setSelectedDeliveryId,
    runtimeStatus, runsResponse, selectedRunId, setSelectedRunId, selectedRun, setSelectedRun,
    message, setMessage, busyAction, setBusyAction,
    streamState, latestSequence, streamError, liveEvents,
    handleStartRun, handleCancelRun, handleReconcile, loadRuns, refreshRuntimeStatus
  };
}
