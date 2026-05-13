import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  assignmentsApi,
  builderApi,
  deliveriesApi,
  projectsApi,
} from "../../shared/api/services";
import { useWorkspace } from "../../shared/workspace/WorkspaceContext";
import type {
  BuildRunEntity,
  DeliveryEntity,
  DeliveryStatus,
  PaginatedResponse,
  ProjectAssignmentEntity,
  ProjectEntity,
  SessionRecord,
} from "../../shared/types";
import { getErrorMessage } from "../../shared/utils/errors";
import { useManagementPermissions } from "../../shared/session/useManagementPermissions";
import {
  extractLegacyAiEvidence,
  mergeManualAndLegacyNotes,
} from "../teacherReviewNavigation";

export type NoticeTone = "info" | "warning";
export interface NoticeState {
  text: string;
  tone: NoticeTone;
}

export function useDeliveryManagement(
  session: SessionRecord | null,
  options?: { initialDeliveryId?: string | null },
) {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectEntity[]>([]);
  const [assignments, setAssignments] = useState<ProjectAssignmentEntity[]>([]);
  const [myAssignments, setMyAssignments] = useState<ProjectAssignmentEntity[]>([]);
  const [deliveries, setDeliveries] = useState<PaginatedResponse<DeliveryEntity> | null>(null);
  const { selection, setAssignment, setDelivery } = useWorkspace();
  const selectedProjectId = selection.projectId || "";
  const selectedAssignmentId = selection.assignmentId || "";
  const selectedDeliveryId = selection.deliveryId || "";
  
  const lastFetchedAssignmentId = useRef<string | null>(null);

  const [createForm, setCreateForm] = useState({
    assignmentId: "",
    status: "DRAFT" as DeliveryStatus,
    notes: "",
  });
  
  const [updateForm, setUpdateForm] = useState({ id: "", status: "", notes: "" });
  const [statusForm, setStatusForm] = useState({ id: "", status: "SUBMITTED" as DeliveryStatus });
  const [gradingForm, setGradingForm] = useState({
    id: "",
    grade: "",
    graderNotes: "",
  });
  
  const [workspaceNotice, setWorkspaceNotice] = useState<NoticeState | null>(null);
  const [editorNotice, setEditorNotice] = useState<NoticeState | null>(null);
  const [reportNotice, setReportNotice] = useState<NoticeState | null>(null);
  const [debugPayload, setDebugPayload] = useState<unknown>(null);
  
  const [reportRun, setReportRun] = useState<BuildRunEntity | null>(null);
  const [reportDelivery, setReportDelivery] = useState<DeliveryEntity | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [loadingDeliveries, setLoadingDeliveries] = useState(false);

  const reportAbortRef = useRef<AbortController | null>(null);
  const lastReportDeliveryIdRef = useRef<string | null>(null);
  const reportInFlightRef = useRef(false);

  const { canRead, canWrite, canAdmin } = useManagementPermissions(session);

  const selectedDelivery = deliveries?.data.find(d => d.id === selectedDeliveryId) ?? null;
  const selectedDeliveryReviewNotes = useMemo(
    () => extractLegacyAiEvidence(selectedDelivery?.graderNotes),
    [selectedDelivery?.graderNotes],
  );

  const refreshDeliveries = async (assignmentId = selectedAssignmentId) => {
    if (!assignmentId || !canRead) return;
    setLoadingDeliveries(true);
    try {
      lastFetchedAssignmentId.current = assignmentId;
      const response = await deliveriesApi.list({ assignmentId, page: 1, limit: 50, sortBy: "createdAt", sortOrder: "DESC" });
      setDeliveries(response);
      // Invalidate the report cache so the next handleViewReport
      // re-fetches the latest run (a new run may have completed).
      lastReportDeliveryIdRef.current = null;
      setWorkspaceNotice({ text: "Entregas actualizadas.", tone: "info" });
      
      // Determine which delivery should be active
      const activeId = selectedDeliveryId || options?.initialDeliveryId;
      
      // Only auto-select if no relevant delivery is selected or the selected one is gone
      if (!activeId || !response.data.some(d => d.id === activeId)) {
        const firstId = response.data[0]?.id;
        if (firstId) {
          setDelivery(firstId, `v${response.data[0].version} - ${response.data[0].studentEmail}`);
        }
      } else if (activeId && !selectedDeliveryId) {
        // If we have an initial ID but it's not yet in workspace context, sync it now that we have labels
        const match = response.data.find(d => d.id === activeId);
        if (match) {
          setDelivery(activeId, `v${match.version} - ${match.studentEmail}`);
        }
      }
    } catch (e) {
      setWorkspaceNotice({ text: getErrorMessage(e), tone: "warning" });
    } finally {
      setLoadingDeliveries(false);
    }
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canRead || !createForm.assignmentId.trim()) return;
    try {
      const response = await deliveriesApi.create({ ...createForm, notes: createForm.notes || undefined });
      setEditorNotice({ text: "Entrega creada correctamente.", tone: "info" });
      await refreshDeliveries(createForm.assignmentId);
      setDelivery(response.id);
    } catch (e) {
      setEditorNotice({ text: getErrorMessage(e), tone: "warning" });
    }
  };

  const handleUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canWrite || !updateForm.id.trim()) return;
    try {
      await deliveriesApi.update(updateForm.id.trim(), { 
        status: updateForm.status ? (updateForm.status as DeliveryStatus) : undefined, 
        notes: updateForm.notes || undefined 
      });
      setEditorNotice({ text: "Entrega actualizada.", tone: "info" });
      await refreshDeliveries();
    } catch (e) {
      setEditorNotice({ text: getErrorMessage(e), tone: "warning" });
    }
  };

  const handleStatusUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canWrite || !statusForm.id.trim()) return;
    try {
      await deliveriesApi.updateStatus(statusForm.id.trim(), statusForm.status);
      setEditorNotice({ text: "Estado actualizado.", tone: "info" });
      await refreshDeliveries();
    } catch (e) {
      setEditorNotice({ text: getErrorMessage(e), tone: "warning" });
    }
  };

  const handleViewReport = useCallback(async (deliveryId = selectedDeliveryId, { force = false }: { force?: boolean } = {}) => {
    if (!deliveryId || !canRead) return;
    if (reportInFlightRef.current) return;
    // Only skip when the same delivery was JUST loaded (debounce rapid clicks).
    // After a refreshDeliveries() call, the ref is cleared so we always re-fetch.
    if (!force && lastReportDeliveryIdRef.current === deliveryId && reportRun?.deliveryId === deliveryId) return;

    reportAbortRef.current?.abort();
    const controller = new AbortController();
    reportAbortRef.current = controller;
    reportInFlightRef.current = true;

    setReportLoading(true);
    try {
      const delivery = await deliveriesApi.detail(deliveryId);
      if (controller.signal.aborted) return;

      setReportDelivery(delivery);
      const runs = await builderApi.listByDelivery({ deliveryId, limit: 1, sortOrder: "DESC" });
      if (controller.signal.aborted) return;

      const latestRun = runs.data[0] ?? null;
      if (!latestRun) {
        lastReportDeliveryIdRef.current = deliveryId;
        setReportRun(null);
        setReportNotice({ text: "No hay runs registrados.", tone: "warning" });
        return;
      }

      const fullRun = await builderApi.detail(latestRun.id);
      if (controller.signal.aborted) return;

      lastReportDeliveryIdRef.current = deliveryId;
      setReportRun(fullRun);
      setReportNotice({ text: "Informe cargado.", tone: "info" });
    } catch (e) {
      if (controller.signal.aborted) return;
      lastReportDeliveryIdRef.current = deliveryId;
      setReportNotice({ text: getErrorMessage(e), tone: "warning" });
    } finally {
      if (!controller.signal.aborted) {
        reportInFlightRef.current = false;
        setReportLoading(false);
      }
    }
  }, [selectedDeliveryId, canRead, reportRun]);

  const handleGradingUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canWrite || !gradingForm.id.trim()) return;
    try {
      const response = await deliveriesApi.updateGrading(gradingForm.id.trim(), {
        grade: gradingForm.grade.trim() ? Number(gradingForm.grade) : null,
        graderNotes: mergeManualAndLegacyNotes(
          gradingForm.graderNotes,
          selectedDeliveryReviewNotes.legacyRaw,
        ),
      });
      setEditorNotice({ text: "Calificación actualizada.", tone: "info" });
      setDelivery(response.id);
      await refreshDeliveries();
    } catch (e) {
      setEditorNotice({ text: getErrorMessage(e), tone: "warning" });
    }
  };

  // Initial loads
  useEffect(() => {
    if (!canRead) return;
    projectsApi.list({ page: 1, limit: 50, sortBy: "updatedAt", sortOrder: "DESC" })
      .then(r => {
        setProjects(r.data);
      })
      .catch(e => setWorkspaceNotice({ text: getErrorMessage(e), tone: "warning" }));
  }, [canRead]);

  useEffect(() => {
    if (!session || session.role !== "STUDENT") return;
    assignmentsApi.listMine()
      .then(r => {
        setMyAssignments(r);
      })
      .catch(e => setWorkspaceNotice({ text: getErrorMessage(e), tone: "warning" }));
  }, [session]);

  useEffect(() => {
    if (!selectedProjectId || !canRead) return;
    const loadAssignments = async () => {
      try {
        const response = canWrite 
          ? await assignmentsApi.listByProject(selectedProjectId) 
          : myAssignments.filter(a => a.projectId === selectedProjectId);
        setAssignments(response);
      } catch (e) {
        setWorkspaceNotice({ text: getErrorMessage(e), tone: "warning" });
      }
    };
    void loadAssignments();
  }, [canRead, canWrite, myAssignments, selectedProjectId]);

  useEffect(() => {
    if (!selectedAssignmentId) {
      setDeliveries(null);
      setReportRun(null);
      setReportDelivery(null);
      lastFetchedAssignmentId.current = null;
      lastReportDeliveryIdRef.current = null;
      reportAbortRef.current?.abort();
      reportInFlightRef.current = false;
      setCreateForm(prev => ({ ...prev, assignmentId: "" }));
      return;
    }
    
    if (!canRead) return;
    
    // Prevent redundant fetches if we already have this data
    if (lastFetchedAssignmentId.current === selectedAssignmentId && deliveries) {
      return;
    }

    setCreateForm(prev => ({ ...prev, assignmentId: selectedAssignmentId }));
    void refreshDeliveries(selectedAssignmentId);
  }, [canRead, selectedAssignmentId]);

  useEffect(() => {
    if (!selectedDeliveryId) return;
    const d = deliveries?.data.find(d => d.id === selectedDeliveryId);
    if (d) {
      setUpdateForm({ id: d.id, status: d.status, notes: d.notes ?? "" });
      setStatusForm({ id: d.id, status: d.status });
      setGradingForm({
        id: d.id,
        grade: d.grade !== null ? String(d.grade) : "",
        graderNotes: extractLegacyAiEvidence(d.graderNotes).manualNotes ?? "",
      });
    }
  }, [deliveries, selectedDeliveryId]);

  return {
    projects, assignments, myAssignments, deliveries,
    selectedProjectId,
    selectedAssignmentId,
    selectedDeliveryId,
    selectedDelivery,
    selectedDeliveryReviewNotes,
    createForm, setCreateForm,
    updateForm, setUpdateForm,
    statusForm, setStatusForm,
    gradingForm, setGradingForm,
    workspaceNotice, editorNotice, reportNotice,
    debugPayload, setDebugPayload,
    reportRun, reportDelivery, reportLoading, loadingDeliveries,
    canRead, canWrite, canAdmin,
    refreshDeliveries, handleCreate, handleUpdate, handleStatusUpdate, handleViewReport, handleGradingUpdate,
    navigate
  };
}
