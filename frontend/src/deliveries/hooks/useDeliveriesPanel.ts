/**
 * @fileoverview Composición de la vista de entregas y su selección de workspace.
 *
 * @module useDeliveriesPanel
 */

import { useReducer, useState } from "react";
import { useSearchParams } from "react-router";
import { useToast } from "../../shared/toast/ToastContext";
import { getErrorMessage } from "../../shared/utils/errors";
import {
  deliveriesPanelReducer,
  initialDeliveriesPanelState,
} from "./deliveriesPanel.reducer";
import { useDeliveriesQueries, type DeliveryQuickFilter } from "./useDeliveriesQueries";
import { useDeliveryManagement } from "./useDeliveryManagement";
import { useDeliverySelection } from "./useDeliverySelection";
import { useNoticeToasts } from "../../shared/toast/useNoticeToasts";

export type { DetailTab } from "./deliveryManagement.types";

export function useDeliveriesPanel() {
  const [initialSearchParams] = useSearchParams();
  const initialDeliveryId = initialSearchParams.get("deliveryId");
  const dc = useDeliveryManagement({ initialDeliveryId });
  const deliveries = dc.deliveries?.data ?? [];
  const selection = useDeliverySelection({
    assignments: dc.assignments,
    deliveries,
    deliveriesLoaded: dc.deliveries !== null,
    handleViewReport: dc.handleViewReport,
    initialDeliveryId,
    projects: dc.projects,
  });
  const [deliverySearch, setDeliverySearch] = useState("");
  const [quickFilterKey, setQuickFilterKey] =
    useState<DeliveryQuickFilter>("all");
  const [previewState, dispatchPreview] = useReducer(
    deliveriesPanelReducer,
    initialDeliveriesPanelState,
  );
  const { pushToast } = useToast();

  const deliveryResults = useDeliveriesQueries({
    deliveries,
    latestRunByDeliveryId: dc.latestRunByDeliveryId,
    selectedAssignmentId: selection.selection.assignmentId,
    deliverySearch,
    quickFilterKey,
  });

  useNoticeToasts(
    [dc.workspaceNotice, dc.editorNotice, dc.reportNotice],
    "Entregas",
  );

  const handlePreview = async (deliveryId: string) => {
    dispatchPreview({ type: "open-preview" });
    try {
      const files = await dc.previewDelivery(deliveryId);
      dispatchPreview({ type: "preview-loaded", files });
    } catch (error) {
      pushToast({
        title: "Error previsualizando",
        description: getErrorMessage(error),
        tone: "error",
      });
      dispatchPreview({ type: "preview-failed" });
    }
  };

  const handleQuickGrade = async (deliveryId: string, grade: number) => {
    try {
      await dc.updateGrading(deliveryId, { grade, graderNotes: undefined });
      pushToast({
        title: "Nota guardada",
        description: `${grade.toFixed(2)} / 10`,
        tone: "success",
      });
    } catch (error) {
      pushToast({
        title: "Error al guardar la nota",
        description: getErrorMessage(error),
        tone: "error",
      });
    }
  };

  const setIsPreviewModalOpen = (
    value: boolean | ((current: boolean) => boolean),
  ) => {
    const next = typeof value === "function"
      ? value(previewState.isPreviewModalOpen)
      : value;
    dispatchPreview({ type: next ? "open-preview" : "close-preview" });
  };

  return {
    dc,
    detailTab: selection.detailTab,
    setDetailTab: selection.setDetailTab,
    deliverySearch,
    setDeliverySearch,
    quickFilterKey,
    setQuickFilterKey,
    isPreviewModalOpen: previewState.isPreviewModalOpen,
    setIsPreviewModalOpen,
    previewFiles: previewState.previewFiles,
    isLoadingPreview: previewState.isLoadingPreview,
    handlePreview,
    visibleDeliveries: deliveryResults.visibleDeliveries,
    handleQuickGrade,
    selectedAssignment: selection.selectedAssignment,
    selectedProject: selection.selectedProject,
    selectedDelivery: selection.selectedDelivery,
    submittedCount: deliveryResults.submittedCount,
    reviewCount: deliveryResults.reviewCount,
    evaluatedCount: deliveryResults.evaluatedCount,
    openDelivery: selection.openDelivery,
    searchParams: selection.searchParams,
    setSearchParams: selection.setSearchParams,
    setProject: selection.setProject,
    setAssignment: selection.setAssignment,
    clearAssignmentFilter: selection.clearAssignmentFilter,
    deliveries,
  };
}
