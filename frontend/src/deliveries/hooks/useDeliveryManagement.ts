/**
 * @fileoverview Vista y gestión de entregas de código de alumnos (useDeliveryManagement).
 *
 * @module useDeliveryManagement
 */

import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
} from "../../shared/types";
import { getErrorMessage } from "../../shared/utils/errors";
import { useSession } from "../../shared/session/SessionContext";
import { useManagementPermissions } from "../../shared/session/useManagementPermissions";
import { queryKeys } from "../../shared/query/queryKeys";
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
  const queryClient = useQueryClient();
  const { selection, setAssignment, setDelivery } = useWorkspaceSelection();
  const selectedProjectId = selection.projectId || "";
  const selectedAssignmentId = selection.assignmentId || "";
  const selectedDeliveryId = selection.deliveryId || "";

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

  const reportAbortRef = useRef<AbortController | null>(null);
  const lastReportDeliveryIdRef = useRef<string | null>(null);
  const reportInFlightRef = useRef(false);

  const { canRead, canWrite, canAdmin } = useManagementPermissions(session);

  type CreateDeliveryPayload = Parameters<typeof deliveriesApi.create>[0];
  type UpdateDeliveryPayload = Parameters<typeof deliveriesApi.update>[1];
  type GradingPayload = Parameters<typeof deliveriesApi.updateGrading>[1];

  const deliveriesQuery = useQuery({
    queryKey: queryKeys.deliveries.list(selectedAssignmentId),
    queryFn: ({ signal }) =>
      deliveriesApi.list(
        {
          assignmentId: selectedAssignmentId,
          page: 1,
          limit: 50,
          sortBy: "createdAt",
          sortOrder: "DESC",
        },
        signal,
      ),
    enabled: canRead && !!selectedAssignmentId,
  });
  const deliveries = deliveriesQuery.data ?? null;

  const evaluatedIds = useMemo(
    () => (deliveries?.data ?? []).filter((d) => d.status === "EVALUATED").map((d) => d.id),
    [deliveries],
  );
  const latestRunsQuery = useQuery({
    queryKey: queryKeys.deliveries.latestRuns(evaluatedIds),
    queryFn: () => builderApi.listLatestRunsByDeliveries(evaluatedIds),
    enabled: evaluatedIds.length > 0,
  });
  const latestRunByDeliveryId = latestRunsQuery.data ?? {};

  const projectsQuery = useQuery({
    queryKey: queryKeys.projects.list(),
    queryFn: ({ signal }) =>
      projectsApi.list({ page: 1, limit: 50, sortBy: "updatedAt", sortOrder: "DESC" }, signal),
    enabled: canRead,
  });
  const projects = projectsQuery.data?.data ?? [];

  const myAssignmentsQuery = useQuery({
    queryKey: queryKeys.assignments.mine(),
    queryFn: () => assignmentsApi.listMine(),
    enabled: !!session && session.role === "STUDENT",
  });
  const myAssignments = myAssignmentsQuery.data ?? [];

  const assignmentsByProjectQuery = useQuery({
    queryKey: queryKeys.assignments.byProject(selectedProjectId),
    queryFn: ({ signal }) => assignmentsApi.listByProject(selectedProjectId, signal),
    enabled: canRead && canWrite && !!selectedProjectId,
  });

  const assignments = useMemo(() => {
    if (!selectedProjectId || !canRead) return [];
    if (canWrite) return assignmentsByProjectQuery.data ?? [];
    return myAssignments.filter((a) => a.projectId === selectedProjectId);
  }, [canRead, canWrite, assignmentsByProjectQuery.data, myAssignments, selectedProjectId]);

  // Cada una de estas cargas de fondo ya mostraba su propio aviso de error en
  // workspaceNotice antes de esta migración; useQuery v5 no tiene onError, así
  // que se reproduce con un efecto explícito por query.
  useEffect(() => {
    if (deliveriesQuery.isError) {
      setWorkspaceNotice({ text: getErrorMessage(deliveriesQuery.error), tone: "warning" });
    }
  }, [deliveriesQuery.isError, deliveriesQuery.error]);

  useEffect(() => {
    if (projectsQuery.isError) {
      setWorkspaceNotice({ text: getErrorMessage(projectsQuery.error), tone: "warning" });
    }
  }, [projectsQuery.isError, projectsQuery.error]);

  useEffect(() => {
    if (myAssignmentsQuery.isError) {
      setWorkspaceNotice({ text: getErrorMessage(myAssignmentsQuery.error), tone: "warning" });
    }
  }, [myAssignmentsQuery.isError, myAssignmentsQuery.error]);

  useEffect(() => {
    if (assignmentsByProjectQuery.isError) {
      setWorkspaceNotice({ text: getErrorMessage(assignmentsByProjectQuery.error), tone: "warning" });
    }
  }, [assignmentsByProjectQuery.isError, assignmentsByProjectQuery.error]);

  const selectedDelivery = deliveries?.data.find(d => d.id === selectedDeliveryId) ?? null;
  const selectedDeliveryReviewNotes = useMemo(
    () => extractLegacyAiEvidence(selectedDelivery?.graderNotes),
    [selectedDelivery?.graderNotes],
  );

  const invalidateDeliveries = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.deliveries.all });

  const createMutation = useMutation({
    mutationFn: (payload: CreateDeliveryPayload) => deliveriesApi.create(payload),
    onSuccess: invalidateDeliveries,
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateDeliveryPayload }) =>
      deliveriesApi.update(id, payload),
    onSuccess: invalidateDeliveries,
  });
  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: DeliveryStatus }) =>
      deliveriesApi.updateStatus(id, status),
    onSuccess: invalidateDeliveries,
  });
  const gradingMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: GradingPayload }) =>
      deliveriesApi.updateGrading(id, payload),
    onSuccess: invalidateDeliveries,
  });

  // Wrapper expuesto para los sitios que hoy llaman a deliveriesApi.updateGrading
  // directamente (calificación rápida desde la sidebar, grading studio) y luego
  // forzaban un refresh manual: al pasar por la mutación, la invalidación en
  // onSuccess ya dispara ese refetch, así que esos sitios dejan de necesitar
  // ninguna llamada de refresh propia.
  const updateGrading = (id: string, payload: GradingPayload) =>
    gradingMutation.mutateAsync({ id, payload });

  // Único punto donde se muestra "Entregas actualizadas.": una acción de
  // refresco manual explícita (botón), nunca una carga/refetch automático.
  const refreshDeliveries = async () => {
    const result = await deliveriesQuery.refetch();
    if (result.data) {
      setWorkspaceNotice({ text: "Entregas actualizadas.", tone: "info" });
    } else if (result.error) {
      setWorkspaceNotice({ text: getErrorMessage(result.error), tone: "warning" });
    }
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canRead || !createForm.assignmentId.trim()) return;
    try {
      const response = await createMutation.mutateAsync({
        ...createForm,
        notes: createForm.notes || undefined,
      });
      setEditorNotice({ text: "Entrega creada correctamente.", tone: "info" });
      setDelivery(response.id);
    } catch (e) {
      setEditorNotice({ text: getErrorMessage(e), tone: "warning" });
    }
  };

  const handleUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canWrite || !updateForm.id.trim()) return;
    try {
      await updateMutation.mutateAsync({
        id: updateForm.id.trim(),
        payload: {
          status: updateForm.status ? (updateForm.status as DeliveryStatus) : undefined,
          notes: updateForm.notes || undefined,
        },
      });
      setEditorNotice({ text: "Entrega actualizada.", tone: "info" });
    } catch (e) {
      setEditorNotice({ text: getErrorMessage(e), tone: "warning" });
    }
  };

  const handleStatusUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canWrite || !statusForm.id.trim()) return;
    try {
      await statusMutation.mutateAsync({ id: statusForm.id.trim(), status: statusForm.status });
      setEditorNotice({ text: "Estado actualizado.", tone: "info" });
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
      const response = await updateGrading(gradingForm.id.trim(), {
        grade: gradingForm.grade.trim() ? Number(gradingForm.grade) : null,
        graderNotes: mergeManualAndLegacyNotes(
          gradingForm.graderNotes,
          selectedDeliveryReviewNotes.legacyRaw,
        ),
      });
      setEditorNotice({ text: "Calificación actualizada.", tone: "info" });
      setDelivery(response.id);
    } catch (e) {
      setEditorNotice({ text: getErrorMessage(e), tone: "warning" });
    }
  };

  // Al perder la asignación seleccionada se limpia el estado de reporte y el
  // formulario de creación; con asignación seleccionada, la carga de la lista
  // ya la gestiona deliveriesQuery vía su queryKey/enabled, sin efecto propio.
  useEffect(() => {
    if (!selectedAssignmentId) {
      setReportRun(null);
      setReportDelivery(null);
      lastReportDeliveryIdRef.current = null;
      reportAbortRef.current?.abort();
      reportInFlightRef.current = false;
      setCreateForm(prev => ({ ...prev, assignmentId: "" }));
      return;
    }
    if (!canRead) return;
    setCreateForm(prev => ({ ...prev, assignmentId: selectedAssignmentId }));
  }, [selectedAssignmentId, canRead]);

  // Sincroniza la selección de workspace con los datos frescos del servidor
  // (equivalente a lo que antes hacía refreshDeliveries() de forma imperativa).
  useEffect(() => {
    const response = deliveriesQuery.data;
    if (!response) return;
    const activeId = selectedDeliveryId || options?.initialDeliveryId;
    if (!activeId || !response.data.some(d => d.id === activeId)) {
      const first = response.data[0];
      if (first) setDelivery(first.id, `v${first.version} - ${first.studentEmail}`);
    } else if (activeId && !selectedDeliveryId) {
      const match = response.data.find(d => d.id === activeId);
      if (match) setDelivery(activeId, `v${match.version} - ${match.studentEmail}`);
    }
    // setDelivery no es estable entre renders (no está memoizado en el
    // contexto); se omite deliberadamente de las deps para no reejecutar este
    // efecto por cada render del workspace, solo cuando cambian los datos o la
    // selección relevante.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deliveriesQuery.data, selectedDeliveryId, options?.initialDeliveryId]);

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
    reportRun, reportDelivery, reportLoading, loadingDeliveries: deliveriesQuery.isFetching,
    latestRunByDeliveryId,
    canRead, canWrite, canAdmin,
    refreshDeliveries, handleCreate, handleUpdate, handleStatusUpdate, handleViewReport, handleGradingUpdate,
    updateGrading,
    navigate
  };
}
