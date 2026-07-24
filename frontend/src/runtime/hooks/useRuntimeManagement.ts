import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { getErrorMessage } from "../../shared/utils/errors";
import { useSession } from "../../shared/session/SessionContext";
import { useVisibilityAwareInterval } from "../../shared/hooks/useVisibilityAwareInterval";
import { useBuilderRunStream } from "../../builder/hooks/useBuilderRunStream";

type NoticeTone = "info" | "warning";
interface NoticeState {
  text: string;
  tone: NoticeTone;
}

export function useRuntimeManagement() {
  const { activeSession: session } = useSession();
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

  const loadProjects = async (signal?: AbortSignal) => {
    try {
      const response = await projectsApi.list({ page: 1, limit: 50, sortBy: "updatedAt", sortOrder: "DESC" }, signal);
      if (signal?.aborted) return;
      setProjectOptions(response.data);
      setSelectedProjectId(curr => (curr && response.data.some(p => p.id === curr)) ? curr : (reqProjectId && response.data.some(p => p.id === reqProjectId) ? reqProjectId : (response.data[0]?.id ?? "")));
    } catch (e) {
      if (signal?.aborted) return;
      setMessage({ text: getErrorMessage(e), tone: "warning" });
    }
  };

  const loadRuns = async (deliveryId = selectedDeliveryId, signal?: AbortSignal) => {
    if (!deliveryId) return;
    try {
      const response = await builderApi.listByDelivery({ deliveryId, page: 1, limit: 20, sortOrder: "DESC", signal });
      if (signal?.aborted) return;
      setRunsResponse(response);
      setSelectedRunId(curr => (curr && response.data.some(r => r.id === curr)) ? curr : (response.data[0]?.id ?? ""));
    } catch (e) {
      if (signal?.aborted) return;
      setMessage({ text: getErrorMessage(e), tone: "warning" });
    }
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
  // Cada etapa de la cascada proyecto→asignación→entrega→runs aborta su
  // petición al desmontar o al re-disparar el efecto (cambio rápido de
  // selección), para que una respuesta tardía de la selección anterior no
  // sobreescriba el estado de la actual (FE-BAJO-03).
  useEffect(() => {
    const controller = new AbortController();
    void loadProjects(controller.signal);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!selectedProjectId) {
      setAssignmentOptions([]);
      return;
    }
    const controller = new AbortController();
    const sync = async () => {
      try {
        const as = await assignmentsApi.listByProject(selectedProjectId, controller.signal);
        if (controller.signal.aborted) return;
        setAssignmentOptions(as);
        setSelectedAssignmentId(curr => (curr && as.some(a => a.id === curr)) ? curr : (reqAssignmentId && as.some(a => a.id === reqAssignmentId) ? reqAssignmentId : (as[0]?.id ?? "")));
      } catch (e) {
        if (controller.signal.aborted) return;
        setMessage({ text: getErrorMessage(e), tone: "warning" });
      }
    };
    void sync();
    return () => controller.abort();
  }, [reqAssignmentId, selectedProjectId]);

  useEffect(() => {
    if (!selectedAssignmentId) { setDeliveryOptions([]); return; }
    const controller = new AbortController();
    deliveriesApi.list({ assignmentId: selectedAssignmentId, page: 1, limit: 50, sortBy: "createdAt", sortOrder: "DESC" }, controller.signal)
      .then(r => {
        if (controller.signal.aborted) return;
        setDeliveryOptions(r.data);
        setSelectedDeliveryId(curr => (curr && r.data.some(d => d.id === curr)) ? curr : (reqDeliveryId && r.data.some(d => d.id === reqDeliveryId) ? reqDeliveryId : (r.data[0]?.id ?? "")));
      })
      .catch((e) => {
        if (controller.signal.aborted) return;
        setMessage({ text: getErrorMessage(e), tone: "warning" });
      });
    return () => controller.abort();
  }, [reqDeliveryId, selectedAssignmentId]);

  useEffect(() => {
    if (!selectedDeliveryId) return;
    const controller = new AbortController();
    void loadRuns(selectedDeliveryId, controller.signal);
    return () => controller.abort();
  }, [selectedDeliveryId]);

  /**
   * Puente entre el efecto que construye el sincronizador de evidencia —con su
   * estado local de cancelación y de "primera carga"— y el intervalo consciente
   * de visibilidad, que vive fuera del efecto. Se limpia al desmontar para que
   * el intervalo no invoque a un cierre de un run que ya no se observa.
   */
  const evidenceSyncRef = useRef<(() => void) | null>(null);

  const syncSelectedRun = useCallback(() => {
    if (!selectedRunId) { return; }
    void builderApi.detail(selectedRunId).then(setSelectedRun).catch(() => {});
  }, [selectedRunId]);

  useEffect(() => {
    if (!selectedRunId) { setSelectedRun(null); return; }
    syncSelectedRun();
  }, [selectedRunId, syncSelectedRun]);

  // Sondeo de detalle del run: suspendido con la pestaña oculta (ESC-ALTO-10)
  // y, además, en estado terminal (FE-ALTO-02) — un run ya terminado no cambia
  // más, así que seguir repescándolo cada 3s es tráfico puro. El polling de
  // evidencias de abajo ya aplicaba este mismo corte; aquí faltaba.
  useVisibilityAwareInterval(
    syncSelectedRun,
    3000,
    Boolean(selectedRunId) && !selectedRun?.isTerminal,
  );

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
    evidenceSyncRef.current = () => {
      firstFetch = false;
      void sync();
    };

    return () => {
      cancelled = true;
      evidenceSyncRef.current = null;
    };
  }, [selectedRun?.isTerminal, selectedRunId]);

  // Artefactos de evidencia: solo mientras el run siga vivo y la pestaña esté
  // visible. Un run terminal ya no genera artefactos nuevos, de modo que seguir
  // sondeándolo era tráfico puro (ESC-ALTO-10).
  useVisibilityAwareInterval(
    () => evidenceSyncRef.current?.(),
    4000,
    Boolean(selectedRunId) && !selectedRun?.isTerminal,
  );

  const handleDownloadArtifact = async (artifactId: string) => {
    if (!selectedRunId) return;

    setDownloadingArtifactId(artifactId);
    try {
      const blob = await builderApi.getEvidenceContentAsBlob(
        selectedRunId,
        artifactId,
      );
      const artifact = evidenceArtifacts.find((a) => a.id === artifactId);
      const ext = artifact?.contentType.includes("json") ? "json" : "txt";
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
