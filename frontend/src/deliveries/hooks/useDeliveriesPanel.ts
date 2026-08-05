/**
 * @fileoverview Vista y gestión de entregas de código de alumnos (useDeliveriesPanel).
 *
 * @module useDeliveriesPanel
 */

import { useState, useDeferredValue, useMemo, useEffect, useRef } from "react";
import { useSearchParams } from "react-router";
import { useWorkspaceSelection } from "../../shared/workspace/WorkspaceContext";
import { deliveriesApi } from "../../shared/api/services";
import { getErrorMessage } from "../../shared/utils/errors";
import { useToast } from "../../shared/toast/ToastContext";
import { useNoticeToasts } from "../../shared/toast/useNoticeToasts";
import { useDeliveryManagement } from "./useDeliveryManagement";
import { normalizeTeacherDeliveryTab } from "../teacherReviewNavigation";
import { DeliveryEntity } from "../../shared/types";
import { isLowConfidenceVerdict } from "../../shared/data/builderTaxonomy";

export type DetailTab = "overview" | "grading" | "report";

export function useDeliveriesPanel() {
  const [searchParams, setSearchParams] = useSearchParams();
  const dc = useDeliveryManagement({ initialDeliveryId: searchParams.get("deliveryId") });
  const { selection, setProject, setAssignment, clearAssignment, setDelivery } = useWorkspaceSelection();
  const lastSyncedRef = useRef<{
    projectId: string | null;
    assignmentId: string | null;
    deliveryId: string | null;
    tab: string | null;
  }>({
    projectId: null,
    assignmentId: null,
    deliveryId: null,
    tab: null,
  });
  // `searchParams` (react-router) y `selection` (este contexto local) son dos
  // stores separados: un `setSearchParams` disparado en este mismo efecto no
  // se refleja en `searchParams` hasta un render después. Sin esta guarda, el
  // efecto de sincronización de abajo veía en ese render intermedio su propia
  // escritura todavía pendiente como si fuera un cambio de URL "externo" y
  // volvía a tirar de un valor que la app acababa de limpiar deliberadamente
  // (p.ej. clearAssignmentFilter). Se ignora cualquier lectura de
  // `searchParams` hasta que coincida con lo último que este mismo efecto
  // escribió.
  const pendingUrlWriteRef = useRef<string | null>(null);

  const deliveries = dc.deliveries?.data ?? [];
  const [detailTab, setDetailTab] = useState<DetailTab>(() => 
    normalizeTeacherDeliveryTab(searchParams.get("tab"))
  );
  const [deliverySearch, setDeliverySearch] = useState("");
  const deferredDeliverySearch = useDeferredValue(deliverySearch);
  const [quickFilterKey, setQuickFilterKey] = useState<"all" | "late" | "ungraded" | "fail" | "pass" | "needs-review">("all");
  const { pushToast } = useToast();

  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [previewFiles, setPreviewFiles] = useState<Array<{ path: string; content: string }>>([]);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  const handlePreview = async (deliveryId: string) => {
    setIsLoadingPreview(true);
    setIsPreviewModalOpen(true);
    try {
      const files = await deliveriesApi.preview(deliveryId);
      setPreviewFiles(files);
    } catch (error) {
      pushToast({
        title: "Error previsualizando",
        description: getErrorMessage(error),
        tone: "error",
      });
      setIsPreviewModalOpen(false);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  useNoticeToasts(
    [dc.workspaceNotice, dc.editorNotice, dc.reportNotice],
    "Entregas",
  );

  const normalizedSearch = deferredDeliverySearch.trim().toLowerCase();
  const quickFilterFn = (delivery: DeliveryEntity): boolean => {
    if (quickFilterKey === "late") return delivery.isLate === true;
    if (quickFilterKey === "ungraded") return delivery.grade === null && delivery.status === "EVALUATED";
    if (quickFilterKey === "fail") return delivery.grade !== null && delivery.grade < 5;
    if (quickFilterKey === "pass") return delivery.grade !== null && delivery.grade >= 5;
    if (quickFilterKey === "needs-review") {
      const assessment = dc.latestRunByDeliveryId[delivery.id]?.llmAssessment;
      return isLowConfidenceVerdict(assessment?.evaluativeState, assessment?.confidence);
    }
    return true;
  };

  const visibleDeliveries = useMemo(() => {
    return deliveries
      .filter(quickFilterFn)
      .filter(d => !dc.selectedAssignmentId || d.assignmentId === dc.selectedAssignmentId)
      .filter(d =>
        !normalizedSearch ||
        d.studentEmail.toLowerCase().includes(normalizedSearch) ||
        (d.studentName?.toLowerCase().includes(normalizedSearch) ?? false) ||
        new Date(d.createdAt).toLocaleDateString().includes(normalizedSearch)
      );
  }, [deliveries, normalizedSearch, quickFilterKey, dc.selectedAssignmentId]);

  const handleQuickGrade = async (deliveryId: string, grade: number) => {
    try {
      await dc.updateGrading(deliveryId, { grade, graderNotes: undefined });
      pushToast({ title: "Nota guardada", description: `${grade.toFixed(2)} / 10`, tone: "success" });
    } catch (error) {
      pushToast({ title: "Error al guardar la nota", description: getErrorMessage(error), tone: "error" });
    }
  };

  const selectedAssignment = dc.assignments.find(
    (assignment) => assignment.id === dc.selectedAssignmentId,
  );
  const selectedProject = dc.projects.find(
    (project) => project.id === dc.selectedProjectId,
  );
  const selectedDelivery = dc.selectedDelivery;

  const requestedProjectId = searchParams.get("projectId");
  const requestedAssignmentId = searchParams.get("assignmentId");
  const requestedDeliveryId = searchParams.get("deliveryId");
  const requestedDetailTab = normalizeTeacherDeliveryTab(searchParams.get("tab"));

  const submittedCount = deliveries.filter((delivery) => delivery.status === "SUBMITTED").length;
  const reviewCount = deliveries.filter((delivery) => delivery.status === "IN_REVIEW").length;
  const evaluatedCount = deliveries.filter((delivery) => delivery.status === "EVALUATED").length;

  const openDelivery = (deliveryId: string, tab: DetailTab = "overview") => {
    const delivery = deliveries.find(d => d.id === deliveryId);
    setDelivery(deliveryId, delivery ? `v${delivery.version} - ${delivery.studentName}` : undefined);
    setDetailTab(tab);
    if (tab !== "overview") {
      void dc.handleViewReport(deliveryId);
    }
  };

  // Solo toca `selection`: el efecto de sincronización de abajo ya reacciona
  // a que `selection.assignmentId` quede en null y limpia la URL él solo (ver
  // su rama `workspaceChanged`). Llamar aquí también a `setSearchParams`
  // parecía más directo, pero `searchParams` no se actualiza en el mismo
  // render que `selection` (van por fuentes de estado distintas) — la rama
  // `urlChanged` de ese mismo efecto todavía veía la URL vieja un render
  // después y reimponía el assignmentId que acabábamos de limpiar.
  const clearAssignmentFilter = () => {
    clearAssignment();
  };

  useEffect(() => {
    if (pendingUrlWriteRef.current !== null) {
      if (searchParams.toString() === pendingUrlWriteRef.current) {
        pendingUrlWriteRef.current = null;
      } else {
        return;
      }
    }

    const lastSynced = lastSyncedRef.current;
    const urlChanged =
      requestedProjectId !== lastSynced.projectId ||
      requestedAssignmentId !== lastSynced.assignmentId ||
      requestedDeliveryId !== lastSynced.deliveryId;

    if (urlChanged) {
      if (requestedProjectId && selection.projectId !== requestedProjectId) {
        setProject(requestedProjectId);
      }
      if (requestedAssignmentId && selection.assignmentId !== requestedAssignmentId) {
        setAssignment(requestedAssignmentId);
      }
      if (requestedDeliveryId && selection.deliveryId !== requestedDeliveryId) {
        setDelivery(requestedDeliveryId);
      }
      
      lastSyncedRef.current = {
        projectId: requestedProjectId,
        assignmentId: requestedAssignmentId,
        deliveryId: requestedDeliveryId,
        tab: requestedDetailTab,
      };
      return;
    }

    const workspaceChanged =
      selection.projectId !== lastSynced.projectId ||
      selection.assignmentId !== lastSynced.assignmentId ||
      selection.deliveryId !== lastSynced.deliveryId ||
      detailTab !== lastSynced.tab;

    if (workspaceChanged) {
      if (!selection.projectId) return;

      const next = new URLSearchParams(searchParams);
      let nextChanged = false;

      if (next.get("projectId") !== selection.projectId) {
        next.set("projectId", selection.projectId);
        nextChanged = true;
      }

      if (selection.assignmentId) {
        if (next.get("assignmentId") !== selection.assignmentId) {
          next.set("assignmentId", selection.assignmentId);
          nextChanged = true;
        }
        if (selection.deliveryId) {
          if (next.get("deliveryId") !== selection.deliveryId) {
            next.set("deliveryId", selection.deliveryId);
            nextChanged = true;
          }
          if (next.get("tab") !== detailTab) {
            next.set("tab", detailTab);
            nextChanged = true;
          }
        } else {
          if (next.has("deliveryId")) {
            next.delete("deliveryId");
            nextChanged = true;
          }
          if (next.has("tab")) {
            next.delete("tab");
            nextChanged = true;
          }
        }
      } else {
        if (next.has("assignmentId")) {
          next.delete("assignmentId");
          nextChanged = true;
        }
        if (next.has("deliveryId")) {
          next.delete("deliveryId");
          nextChanged = true;
        }
        if (next.has("tab")) {
          next.delete("tab");
          nextChanged = true;
        }
      }

      lastSyncedRef.current = {
        projectId: selection.projectId,
        assignmentId: selection.assignmentId,
        deliveryId: selection.deliveryId,
        tab: detailTab,
      };

      if (nextChanged) {
        pendingUrlWriteRef.current = next.toString();
        setSearchParams(next, { replace: true });
      }
    }
  }, [
    requestedProjectId,
    requestedAssignmentId,
    requestedDeliveryId,
    requestedDetailTab,
    selection.projectId,
    selection.assignmentId,
    selection.deliveryId,
    detailTab,
    searchParams,
    setSearchParams,
    setProject,
    setAssignment,
    setDelivery,
  ]);

  useEffect(() => {
    if (!requestedProjectId) return;
    const project = dc.projects.find(p => p.id === requestedProjectId);
    if (project && selection.projectTitle !== project.title) {
      setProject(project.id, project.title);
    }
  }, [dc.projects, requestedProjectId, selection.projectTitle, setProject]);

  useEffect(() => {
    if (!requestedAssignmentId) return;
    // Solo rehidrata la etiqueta legible cuando el id YA coincide con la URL
    // (deep-link recién sincronizado por el efecto de arriba, que solo puso
    // el id). Sin este chequeo, este efecto reimponía el assignmentId de una
    // URL todavía no actualizada por encima de un clearAssignmentFilter()
    // explícito, en la ventana entre que se limpia `selection` y que
    // `setSearchParams` termina de propagar.
    if (selection.assignmentId !== requestedAssignmentId) return;
    const assignment = dc.assignments.find(a => a.id === requestedAssignmentId);
    if (assignment && selection.assignmentLabel !== `${assignment.studentName} · ${assignment.projectTitle}`) {
      setAssignment(assignment.id, `${assignment.studentName} · ${assignment.projectTitle}`);
    }
  }, [dc.assignments, requestedAssignmentId, selection.assignmentId, selection.assignmentLabel, setAssignment]);

  useEffect(() => {
    if (!requestedDeliveryId) return;
    const delivery = deliveries.find(d => d.id === requestedDeliveryId);
    
    if (delivery && selection.deliveryLabel !== `v${delivery.version} - ${delivery.studentName}`) {
      setDelivery(requestedDeliveryId, `v${delivery.version} - ${delivery.studentName}`);
    }

    if (delivery && detailTab !== "overview") {
      void dc.handleViewReport(requestedDeliveryId);
    }
    // Se depende de `handleViewReport`, no del objeto `dc`: `dc` es un literal
    // nuevo en cada render, así que tenerlo en las dependencias hacía correr
    // este efecto en todos los renders.
  }, [
    deliveries,
    requestedDeliveryId,
    selection.deliveryLabel,
    setDelivery,
    detailTab,
    dc.handleViewReport,
  ]);

  return {
    dc,
    detailTab,
    setDetailTab,
    deliverySearch,
    setDeliverySearch,
    quickFilterKey,
    setQuickFilterKey,
    isPreviewModalOpen,
    setIsPreviewModalOpen,
    previewFiles,
    isLoadingPreview,
    handlePreview,
    visibleDeliveries,
    handleQuickGrade,
    selectedAssignment,
    selectedProject,
    selectedDelivery,
    submittedCount,
    reviewCount,
    evaluatedCount,
    openDelivery,
    searchParams,
    setSearchParams,
    setProject,
    setAssignment,
    clearAssignmentFilter,
    deliveries,
  };
}
