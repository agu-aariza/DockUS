/**
 * @fileoverview Vista y gestión de entregas de código de alumnos (useDeliveryManagement).
 *
 * @module useDeliveryManagement
 */

import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  assignmentsApi,
  builderApi,
  deliveriesApi,
  projectsApi,
} from "../../shared/api/services";
import { useWorkspaceSelection } from "../../shared/workspace/WorkspaceContext";
import type {
  BuildRunEntity,
  DeliveryEntity,
  DeliveryStatus,
  ProjectAssignmentEntity,
  ProjectEntity,
} from "../../shared/types";
import { getErrorMessage } from "../../shared/utils/errors";
import { useSession } from "../../shared/session/SessionContext";
import { useManagementPermissions } from "../../shared/session/useManagementPermissions";
import { useCrudResource } from "../../shared/hooks/useCrudResource";
import {
  extractLegacyAiEvidence,
  mergeManualAndLegacyNotes,
} from "../teacherReviewNavigation";

type NoticeTone = "info" | "warning";
interface NoticeState {
  text: string;
  tone: NoticeTone;
}

export function useDeliveryManagement(
  options?: { initialDeliveryId?: string | null },
) {
  const { activeSession: session } = useSession();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectEntity[]>([]);
  const [assignments, setAssignments] = useState<ProjectAssignmentEntity[]>([]);
  const [myAssignments, setMyAssignments] = useState<ProjectAssignmentEntity[]>([]);
  const { selection, setAssignment, setDelivery } = useWorkspaceSelection();
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
  const [latestRunByDeliveryId, setLatestRunByDeliveryId] = useState<
    Record<string, BuildRunEntity | null>
  >({});

  const reportAbortRef = useRef<AbortController | null>(null);
  const lastReportDeliveryIdRef = useRef<string | null>(null);
  const reportInFlightRef = useRef(false);

  const { canRead, canWrite, canAdmin } = useManagementPermissions(session);

  type CreateDeliveryPayload = Parameters<typeof deliveriesApi.create>[0];
  type UpdateDeliveryPayload = Parameters<typeof deliveriesApi.update>[1];

  const deliveriesCrud = useCrudResource<DeliveryEntity, CreateDeliveryPayload, UpdateDeliveryPayload>({
    api: {
      list: deliveriesApi.list,
      create: deliveriesApi.create,
      update: deliveriesApi.update,
    },
    canRead,
    initialQuery: {
      assignmentId: selectedAssignmentId,
      page: 1,
      limit: 50,
      sortBy: "createdAt",
      sortOrder: "DESC",
    },
  });

  const deliveries = deliveriesCrud.listResponse;

  const selectedDelivery = deliveries?.data.find(d => d.id === selectedDeliveryId) ?? null;
  const selectedDeliveryReviewNotes = useMemo(
    () => extractLegacyAiEvidence(selectedDelivery?.graderNotes),
    [selectedDelivery?.graderNotes],
  );

  const refreshDeliveries = async (
    assignmentId = selectedAssignmentId,
    refreshOptions?: { silent?: boolean },
  ) => {
    if (!assignmentId || !canRead) return;
    const response = await deliveriesCrud.refresh(undefined, {
      assignmentId,
      page: 1,
      limit: 50,
      sortBy: "createdAt",
      sortOrder: "DESC",
    });
    if (!response) return;

    lastFetchedAssignmentId.current = assignmentId;
    if (!refreshOptions?.silent) {
      setWorkspaceNotice({ text: "Entregas actualizadas.", tone: "info" });
    }
    lastReportDeliveryIdRef.current = null;

    const activeId = selectedDeliveryId || options?.initialDeliveryId;

    if (!activeId || !response.data.some(d => d.id === activeId)) {
      const firstId = response.data[0]?.id;
      if (firstId) {
        setDelivery(firstId, `v${response.data[0].version} - ${response.data[0].studentEmail}`);
      }
    } else if (activeId && !selectedDeliveryId) {
      const match = response.data.find(d => d.id === activeId);
      if (match) {
        setDelivery(activeId, `v${match.version} - ${match.studentEmail}`);
      }
    }
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canRead || !createForm.assignmentId.trim()) return;
    const response = await deliveriesCrud.create({
      ...createForm,
      notes: createForm.notes || undefined,
    });
    if (response) {
      setEditorNotice({ text: "Entrega creada correctamente.", tone: "info" });
      await refreshDeliveries(createForm.assignmentId);
      setDelivery(response.id);
    } else if (deliveriesCrud.notice) {
      setEditorNotice({ text: deliveriesCrud.notice.text, tone: "warning" });
    }
  };

  const handleUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canWrite || !updateForm.id.trim()) return;
    const response = await deliveriesCrud.update(updateForm.id.trim(), {
      status: updateForm.status ? (updateForm.status as DeliveryStatus) : undefined,
      notes: updateForm.notes || undefined,
    });
    if (response) {
      setEditorNotice({ text: "Entrega actualizada.", tone: "info" });
      await refreshDeliveries();
    } else if (deliveriesCrud.notice) {
      setEditorNotice({ text: deliveriesCrud.notice.text, tone: "warning" });
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
    // El ref es la marca de "esta entrega ya se cargó", y por sí solo. Exigir
    // además que `reportRun` case con la entrega hacía que una entrega SIN runs
    // (donde `reportRun` queda en null) nunca satisficiese la condición: cada
    // render volvía a pedir /deliveries/:id y /runs, en bucle.
    if (!force && lastReportDeliveryIdRef.current === deliveryId) return;

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
  }, [selectedDeliveryId, canRead]);

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
      deliveriesCrud.setListResponse(null);
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
    
    if (lastFetchedAssignmentId.current === selectedAssignmentId && deliveries) {
      return;
    }

    setCreateForm(prev => ({ ...prev, assignmentId: selectedAssignmentId }));
    void refreshDeliveries(selectedAssignmentId, { silent: true });
  }, [canRead, selectedAssignmentId]);

  useEffect(() => {
    const evaluatedIds = (deliveries?.data ?? [])
      .filter((d) => d.status === "EVALUATED")
      .map((d) => d.id);

    if (evaluatedIds.length === 0) {
      setLatestRunByDeliveryId({});
      return;
    }

    let active = true;
    builderApi
      .listLatestRunsByDeliveries(evaluatedIds)
      .then((runsById) => {
        if (active) setLatestRunByDeliveryId(runsById);
      })
      .catch(() => {
        if (active) setLatestRunByDeliveryId({});
      });

    return () => {
      active = false;
    };
  }, [deliveries]);

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
    reportRun, reportDelivery, reportLoading, loadingDeliveries: deliveriesCrud.loading,
    latestRunByDeliveryId,
    canRead, canWrite, canAdmin,
    refreshDeliveries, handleCreate, handleUpdate, handleStatusUpdate, handleViewReport, handleGradingUpdate,
    navigate
  };
}
