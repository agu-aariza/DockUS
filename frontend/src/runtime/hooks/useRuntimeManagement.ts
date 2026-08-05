/**
 * @fileoverview Panel de estado del runtime y Docker daemon (useRuntimeManagement).
 *
 * @module useRuntimeManagement
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import {
  assignmentsApi,
  builderApi,
  deliveriesApi,
  projectsApi,
} from "../../shared/api/services";
import type { BuildRunEntity, EvidenceArtifactDto } from "../../features/builder/types";
import { getErrorMessage } from "../../shared/utils/errors";
import { useSession } from "../../shared/session/SessionContext";
import { queryKeys } from "../../shared/query/queryKeys";
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

  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedAssignmentId, setSelectedAssignmentId] = useState("");
  const [selectedDeliveryId, setSelectedDeliveryId] = useState("");

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

  // Cascada proyecto→asignación→entrega→runs: cada etapa es su propia query,
  // habilitada solo cuando el id del que depende existe. React Query aborta
  // por su cuenta la petición obsoleta cuando la key cambia antes de resolver
  // (lo que antes hacía el AbortController manual de cada etapa), y las keys
  // de proyectos/asignaciones/entregas son las mismas que usan
  // Deliveries/Proyectos/WorkspaceBar, así que comparten caché al navegar
  // entre paneles.
  const projectsQuery = useQuery({
    queryKey: queryKeys.projects.list(),
    queryFn: ({ signal }) =>
      projectsApi.list({ page: 1, limit: 50, sortBy: "updatedAt", sortOrder: "DESC" }, signal),
  });
  const projectOptions = projectsQuery.data?.data ?? [];

  const assignmentsQuery = useQuery({
    queryKey: queryKeys.assignments.byProject(selectedProjectId),
    queryFn: ({ signal }) => assignmentsApi.listByProject(selectedProjectId, signal),
    enabled: !!selectedProjectId,
  });
  const assignmentOptions = assignmentsQuery.data ?? [];

  const deliveriesQuery = useQuery({
    queryKey: queryKeys.deliveries.list(selectedAssignmentId),
    queryFn: ({ signal }) =>
      deliveriesApi.list(
        { assignmentId: selectedAssignmentId, page: 1, limit: 50, sortBy: "createdAt", sortOrder: "DESC" },
        signal,
      ),
    enabled: !!selectedAssignmentId,
  });
  const deliveryOptions = deliveriesQuery.data?.data ?? [];

  const runsQuery = useQuery({
    queryKey: queryKeys.runtime.runsByDelivery(selectedDeliveryId),
    queryFn: ({ signal }) =>
      builderApi.listByDelivery({ deliveryId: selectedDeliveryId, page: 1, limit: 20, sortOrder: "DESC", signal }),
    enabled: !!selectedDeliveryId,
  });
  const runsResponse = runsQuery.data ?? null;

  const loadRuns = async () => {
    await runsQuery.refetch();
  };

  const handleStartRun = async () => {
    if (!selectedDeliveryId) return;
    setBusyAction("run");
    try {
      const response = await builderApi.runForDelivery(selectedDeliveryId);
      setSelectedRunId(response.buildRunId);
      await loadRuns();
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

  // Sincroniza la selección con los datos frescos de cada etapa, prefiriendo
  // el id pedido por la URL si es válido en el listado recién cargado.
  useEffect(() => {
    const data = projectsQuery.data?.data;
    if (!data) return;
    setSelectedProjectId(curr =>
      (curr && data.some(p => p.id === curr)) ? curr :
        (reqProjectId && data.some(p => p.id === reqProjectId) ? reqProjectId : (data[0]?.id ?? "")));
  }, [projectsQuery.data, reqProjectId]);

  useEffect(() => {
    const data = assignmentsQuery.data;
    if (!selectedProjectId || !data) return;
    setSelectedAssignmentId(curr =>
      (curr && data.some(a => a.id === curr)) ? curr :
        (reqAssignmentId && data.some(a => a.id === reqAssignmentId) ? reqAssignmentId : (data[0]?.id ?? "")));
  }, [selectedProjectId, assignmentsQuery.data, reqAssignmentId]);

  useEffect(() => {
    const data = deliveriesQuery.data?.data;
    if (!selectedAssignmentId || !data) return;
    setSelectedDeliveryId(curr =>
      (curr && data.some(d => d.id === curr)) ? curr :
        (reqDeliveryId && data.some(d => d.id === reqDeliveryId) ? reqDeliveryId : (data[0]?.id ?? "")));
  }, [selectedAssignmentId, deliveriesQuery.data, reqDeliveryId]);

  useEffect(() => {
    const data = runsQuery.data?.data;
    if (!selectedDeliveryId || !data) return;
    setSelectedRunId(curr => (curr && data.some(r => r.id === curr)) ? curr : (data[0]?.id ?? ""));
  }, [selectedDeliveryId, runsQuery.data]);

  useEffect(() => {
    const error = projectsQuery.error ?? assignmentsQuery.error ?? deliveriesQuery.error ?? runsQuery.error;
    if (error) setMessage({ text: getErrorMessage(error), tone: "warning" });
  }, [projectsQuery.error, assignmentsQuery.error, deliveriesQuery.error, runsQuery.error]);

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

  // Sondeo de detalle del run: suspendido con la pestaña oculta
  // y, además, en estado terminal — un run ya terminado no cambia
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
  // sondeándolo era tráfico puro.
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
