import { useDeferredValue, useMemo } from "react";
import type { BuildRunEntity } from "../../features/builder/types";
import type { DeliveryEntity } from "../../features/deliveries/types";
import { isLowConfidenceVerdict } from "../../shared/data/builderTaxonomy";

export type DeliveryQuickFilter =
  | "all"
  | "late"
  | "ungraded"
  | "fail"
  | "pass"
  | "needs-review";

interface UseDeliveriesQueriesInput {
  deliveries: DeliveryEntity[];
  latestRunByDeliveryId: Record<string, BuildRunEntity | null>;
  selectedAssignmentId: string | null;
  deliverySearch: string;
  quickFilterKey: DeliveryQuickFilter;
}

export function useDeliveriesQueries({
  deliveries,
  latestRunByDeliveryId,
  selectedAssignmentId,
  deliverySearch,
  quickFilterKey,
}: UseDeliveriesQueriesInput) {
  const deferredDeliverySearch = useDeferredValue(deliverySearch);
  const normalizedSearch = deferredDeliverySearch.trim().toLowerCase();

  const visibleDeliveries = useMemo(() => {
    return deliveries
      .filter((delivery) => {
        if (quickFilterKey === "late") return delivery.isLate === true;
        if (quickFilterKey === "ungraded") {
          return delivery.grade === null && delivery.status === "EVALUATED";
        }
        if (quickFilterKey === "fail") {
          return delivery.grade !== null && delivery.grade < 5;
        }
        if (quickFilterKey === "pass") {
          return delivery.grade !== null && delivery.grade >= 5;
        }
        if (quickFilterKey === "needs-review") {
          const assessment = latestRunByDeliveryId[delivery.id]?.llmAssessment;
          return isLowConfidenceVerdict(
            assessment?.evaluativeState,
            assessment?.confidence,
          );
        }
        return true;
      })
      .filter(
        (delivery) =>
          !selectedAssignmentId || delivery.assignmentId === selectedAssignmentId,
      )
      .filter(
        (delivery) =>
          !normalizedSearch ||
          delivery.studentEmail.toLowerCase().includes(normalizedSearch) ||
          (delivery.studentName?.toLowerCase().includes(normalizedSearch) ?? false) ||
          new Date(delivery.createdAt).toLocaleDateString().includes(normalizedSearch),
      );
  }, [
    deliveries,
    latestRunByDeliveryId,
    normalizedSearch,
    quickFilterKey,
    selectedAssignmentId,
  ]);

  const counts = useMemo(
    () => ({
      submittedCount: deliveries.filter((delivery) => delivery.status === "SUBMITTED").length,
      reviewCount: deliveries.filter((delivery) => delivery.status === "IN_REVIEW").length,
      evaluatedCount: deliveries.filter((delivery) => delivery.status === "EVALUATED").length,
    }),
    [deliveries],
  );

  return { visibleDeliveries, ...counts };
}
