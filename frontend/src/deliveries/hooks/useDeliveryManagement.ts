/**
 * @fileoverview Composición compatible de la gestión de entregas.
 *
 * @module useDeliveryManagement
 */

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useSession } from "../../shared/session/SessionContext";
import { useManagementPermissions } from "../../shared/session/useManagementPermissions";
import { useWorkspaceSelection } from "../../shared/workspace/WorkspaceContext";
import { getErrorMessage } from "../../shared/utils/errors";
import { extractLegacyAiEvidence } from "../teacherReviewNavigation";
import type {
  CreateDeliveryForm,
  NoticeState,
  StatusDeliveryForm,
  UpdateDeliveryForm,
} from "./deliveryManagement.types";
import { useDeliveryBuilderRuns } from "./useDeliveryBuilderRuns";
import { useDeliveryCommands } from "./useDeliveryCommands";
import { useDeliveryGrading } from "./useDeliveryGrading";
import { useDeliveryQueries } from "./useDeliveryQueries";

export function useDeliveryManagement(
  options?: { initialDeliveryId?: string | null },
) {
  const { activeSession: session } = useSession();
  const navigate = useNavigate();
  const { selection, setDelivery } = useWorkspaceSelection();
  const selectedProjectId = selection.projectId || "";
  const selectedAssignmentId = selection.assignmentId || "";
  const selectedDeliveryId = selection.deliveryId || "";
  const { canRead, canWrite, canAdmin } = useManagementPermissions(session);

  const [createForm, setCreateForm] = useState<CreateDeliveryForm>({
    assignmentId: "",
    status: "DRAFT",
    notes: "",
  });
  const [updateForm, setUpdateForm] = useState<UpdateDeliveryForm>({
    id: "",
    status: "",
    notes: "",
  });
  const [statusForm, setStatusForm] = useState<StatusDeliveryForm>({
    id: "",
    status: "SUBMITTED",
  });
  const [workspaceNotice, setWorkspaceNotice] = useState<NoticeState | null>(null);
  const [editorNotice, setEditorNotice] = useState<NoticeState | null>(null);
  const [debugPayload, setDebugPayload] = useState<unknown>(null);

  const queries = useDeliveryQueries({
    canRead,
    canWrite,
    selectedProjectId,
    session,
  });
  const deliveries = queries.deliveries;
  const selectedDelivery =
    deliveries?.data.find((delivery) => delivery.id === selectedDeliveryId) ?? null;
  const selectedDeliveryReviewNotes = useMemo(
    () => extractLegacyAiEvidence(selectedDelivery?.graderNotes),
    [selectedDelivery?.graderNotes],
  );

  const report = useDeliveryBuilderRuns({
    canRead,
    selectedAssignmentId,
    selectedDeliveryId,
  });

  const commands = useDeliveryCommands({
    canRead,
    canWrite,
    createForm,
    updateForm,
    statusForm,
    setDelivery,
    setEditorNotice,
    setWorkspaceNotice,
    deliveriesQuery: queries.deliveriesQuery,
  });
  const grading = useDeliveryGrading({
    canWrite,
    selectedDelivery,
    selectedDeliveryReviewNotes,
    setDelivery,
    setEditorNotice,
    updateGrading: commands.updateGrading,
  });

  // Cada consulta conserva su propio aviso para que un error de proyectos no
  // oculte, por ejemplo, el fallo de la lista de entregas.
  useEffect(() => {
    if (queries.deliveriesQuery.isError) {
      setWorkspaceNotice({
        text: getErrorMessage(queries.deliveriesQuery.error),
        tone: "warning",
      });
    }
  }, [queries.deliveriesQuery.isError, queries.deliveriesQuery.error]);

  useEffect(() => {
    if (queries.projectsQuery.isError) {
      setWorkspaceNotice({
        text: getErrorMessage(queries.projectsQuery.error),
        tone: "warning",
      });
    }
  }, [queries.projectsQuery.isError, queries.projectsQuery.error]);

  useEffect(() => {
    if (queries.myAssignmentsQuery.isError) {
      setWorkspaceNotice({
        text: getErrorMessage(queries.myAssignmentsQuery.error),
        tone: "warning",
      });
    }
  }, [queries.myAssignmentsQuery.isError, queries.myAssignmentsQuery.error]);

  useEffect(() => {
    if (queries.assignmentsByProjectQuery.isError) {
      setWorkspaceNotice({
        text: getErrorMessage(queries.assignmentsByProjectQuery.error),
        tone: "warning",
      });
    }
  }, [queries.assignmentsByProjectQuery.isError, queries.assignmentsByProjectQuery.error]);

  useEffect(() => {
    if (!selectedAssignmentId) {
      setCreateForm((previous) => ({ ...previous, assignmentId: "" }));
      return;
    }
    if (canRead) {
      setCreateForm((previous) => ({
        ...previous,
        assignmentId: selectedAssignmentId,
      }));
    }
  }, [canRead, selectedAssignmentId]);

  // Conserva el deep-link y la selección inicial para consumidores que usan
  // este hook directamente (el panel también centraliza esta lógica en
  // useDeliverySelection).
  useEffect(() => {
    if (!deliveries) return;
    const scoped = selectedAssignmentId
      ? deliveries.data.filter((delivery) => delivery.assignmentId === selectedAssignmentId)
      : deliveries.data;
    const activeId = selectedDeliveryId || options?.initialDeliveryId;
    if (!activeId || !scoped.some((delivery) => delivery.id === activeId)) {
      const first = scoped[0];
      if (first) {
        setDelivery(first.id, `v${first.version} - ${first.studentEmail}`);
      } else if (selectedDeliveryId) {
        setDelivery("");
      }
    } else if (!selectedDeliveryId) {
      const match = scoped.find((delivery) => delivery.id === activeId);
      if (match) {
        setDelivery(activeId, `v${match.version} - ${match.studentEmail}`);
      }
    }
    // setDelivery no está memoizado en el contexto. Se omite para conservar la
    // misma frecuencia de sincronización que tenía el hook original.
  }, [deliveries, options?.initialDeliveryId, selectedAssignmentId, selectedDeliveryId]);

  useEffect(() => {
    if (!selectedDelivery) return;
    setUpdateForm({
      id: selectedDelivery.id,
      status: selectedDelivery.status,
      notes: selectedDelivery.notes ?? "",
    });
    setStatusForm({
      id: selectedDelivery.id,
      status: selectedDelivery.status,
    });
  }, [selectedDelivery]);

  return {
    projects: queries.projects,
    assignments: queries.assignments,
    myAssignments: queries.myAssignments,
    deliveries,
    selectedProjectId,
    selectedAssignmentId,
    selectedDeliveryId,
    selectedDelivery,
    selectedDeliveryReviewNotes,
    createForm,
    setCreateForm,
    updateForm,
    setUpdateForm,
    statusForm,
    setStatusForm,
    gradingForm: grading.gradingForm,
    setGradingForm: grading.setGradingForm,
    workspaceNotice,
    editorNotice,
    reportNotice: report.reportNotice,
    debugPayload,
    setDebugPayload,
    reportRun: report.reportRun,
    reportDelivery: report.reportDelivery,
    reportLoading: report.reportLoading,
    loadingDeliveries: queries.deliveriesQuery.isFetching,
    latestRunByDeliveryId: queries.latestRunByDeliveryId,
    canRead,
    canWrite,
    canAdmin,
    refreshDeliveries: commands.refreshDeliveries,
    handleCreate: commands.handleCreate,
    handleUpdate: commands.handleUpdate,
    handleStatusUpdate: commands.handleStatusUpdate,
    handleViewReport: report.handleViewReport,
    handleGradingUpdate: grading.handleGradingUpdate,
    updateGrading: commands.updateGrading,
    previewDelivery: commands.previewDelivery,
    navigate,
  };
}
