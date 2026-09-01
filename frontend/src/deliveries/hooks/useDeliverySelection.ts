import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import type { ProjectAssignmentEntity, ProjectEntity } from "../../features/projects/types";
import type { DeliveryEntity } from "../../features/deliveries/types";
import { useWorkspaceSelection } from "../../shared/workspace/WorkspaceContext";
import { extractLegacyAiEvidence } from "../teacherReviewNavigation";
import { normalizeTeacherDeliveryTab } from "../teacherReviewNavigation";
import type { DetailTab } from "./deliveryManagement.types";

interface UseDeliverySelectionInput {
  assignments: ProjectAssignmentEntity[];
  deliveries: DeliveryEntity[];
  deliveriesLoaded: boolean;
  handleViewReport: (
    deliveryId?: string,
    options?: { force?: boolean },
  ) => Promise<void>;
  initialDeliveryId?: string | null;
  projects: ProjectEntity[];
}

export function useDeliverySelection({
  assignments,
  deliveries,
  deliveriesLoaded,
  handleViewReport,
  initialDeliveryId,
  projects,
}: UseDeliverySelectionInput) {
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    selection,
    setProject,
    setAssignment,
    clearAssignment,
    setDelivery,
  } = useWorkspaceSelection();
  const [detailTab, setDetailTab] = useState<DetailTab>(() =>
    normalizeTeacherDeliveryTab(searchParams.get("tab")),
  );
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
  // `searchParams` y `selection` son stores separados. Se ignora la URL hasta
  // que refleje la última escritura realizada por este hook.
  const pendingUrlWriteRef = useRef<string | null>(null);

  const requestedProjectId = searchParams.get("projectId");
  const requestedAssignmentId = searchParams.get("assignmentId");
  const requestedDeliveryId = searchParams.get("deliveryId");
  const requestedDetailTab = normalizeTeacherDeliveryTab(searchParams.get("tab"));

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
    detailTab,
    requestedAssignmentId,
    requestedDeliveryId,
    requestedDetailTab,
    requestedProjectId,
    searchParams,
    selection.assignmentId,
    selection.deliveryId,
    selection.projectId,
    setAssignment,
    setDelivery,
    setProject,
    setSearchParams,
  ]);

  useEffect(() => {
    if (!requestedProjectId) return;
    const project = projects.find((candidate) => candidate.id === requestedProjectId);
    if (project && selection.projectTitle !== project.title) {
      setProject(project.id, project.title);
    }
  }, [projects, requestedProjectId, selection.projectTitle, setProject]);

  useEffect(() => {
    if (!requestedAssignmentId || selection.assignmentId !== requestedAssignmentId) {
      return;
    }
    const assignment = assignments.find(
      (candidate) => candidate.id === requestedAssignmentId,
    );
    if (
      assignment &&
      selection.assignmentLabel !== `${assignment.studentName} · ${assignment.projectTitle}`
    ) {
      setAssignment(
        assignment.id,
        `${assignment.studentName} · ${assignment.projectTitle}`,
      );
    }
  }, [assignments, requestedAssignmentId, selection.assignmentId, selection.assignmentLabel, setAssignment]);

  useEffect(() => {
    if (!requestedDeliveryId) return;
    const delivery = deliveries.find((candidate) => candidate.id === requestedDeliveryId);
    if (
      delivery &&
      selection.deliveryLabel !== `v${delivery.version} - ${delivery.studentName}`
    ) {
      setDelivery(requestedDeliveryId, `v${delivery.version} - ${delivery.studentName}`);
    }
    if (delivery && detailTab !== "overview") {
      void handleViewReport(requestedDeliveryId);
    }
  }, [
    deliveries,
    detailTab,
    handleViewReport,
    requestedDeliveryId,
    selection.deliveryLabel,
    setDelivery,
  ]);

  useEffect(() => {
    if (!deliveriesLoaded) return;
    const scoped = selection.assignmentId
      ? deliveries.filter((delivery) => delivery.assignmentId === selection.assignmentId)
      : deliveries;
    const activeId = selection.deliveryId || initialDeliveryId;
    if (!activeId || !scoped.some((delivery) => delivery.id === activeId)) {
      const first = scoped[0];
      if (first) {
        setDelivery(first.id, `v${first.version} - ${first.studentEmail}`);
      } else if (selection.deliveryId) {
        setDelivery("");
      }
    } else if (activeId && !selection.deliveryId) {
      const match = scoped.find((delivery) => delivery.id === activeId);
      if (match) {
        setDelivery(activeId, `v${match.version} - ${match.studentEmail}`);
      }
    }
  }, [deliveries, deliveriesLoaded, initialDeliveryId, selection.assignmentId, selection.deliveryId, setDelivery]);

  const selectedAssignment = assignments.find(
    (assignment) => assignment.id === selection.assignmentId,
  );
  const selectedProject = projects.find(
    (project) => project.id === selection.projectId,
  );
  const selectedDelivery =
    deliveries.find((delivery) => delivery.id === selection.deliveryId) ?? null;
  const selectedDeliveryReviewNotes = extractLegacyAiEvidence(
    selectedDelivery?.graderNotes,
  );

  const openDelivery = (deliveryId: string, tab: DetailTab = "overview") => {
    const delivery = deliveries.find((candidate) => candidate.id === deliveryId);
    setDelivery(
      deliveryId,
      delivery ? `v${delivery.version} - ${delivery.studentName}` : undefined,
    );
    setDetailTab(tab);
    if (tab !== "overview") {
      void handleViewReport(deliveryId);
    }
  };

  return {
    searchParams,
    setSearchParams,
    selection,
    detailTab,
    setDetailTab,
    selectedAssignment,
    selectedProject,
    selectedDelivery,
    selectedDeliveryReviewNotes,
    openDelivery,
    setProject,
    setAssignment,
    clearAssignmentFilter: clearAssignment,
  };
}
