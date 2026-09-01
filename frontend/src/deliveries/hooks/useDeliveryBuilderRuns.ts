import { useCallback, useEffect, useRef, useState } from "react";
import { builderApi } from "../../builder/api/builderApi";
import type { BuildRunEntity } from "../../features/builder/types";
import type { DeliveryEntity } from "../../features/deliveries/types";
import { deliveriesApi } from "../api/deliveriesApi";
import { getErrorMessage } from "../../shared/utils/errors";
import type { NoticeState } from "./deliveryManagement.types";

interface UseDeliveryBuilderRunsInput {
  canRead: boolean;
  selectedAssignmentId: string;
  selectedDeliveryId: string;
}

export function useDeliveryBuilderRuns({
  canRead,
  selectedAssignmentId,
  selectedDeliveryId,
}: UseDeliveryBuilderRunsInput) {
  const [reportRun, setReportRun] = useState<BuildRunEntity | null>(null);
  const [reportDelivery, setReportDelivery] = useState<DeliveryEntity | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportNotice, setReportNotice] = useState<NoticeState | null>(null);
  const reportAbortRef = useRef<AbortController | null>(null);
  const lastReportDeliveryIdRef = useRef<string | null>(null);
  const reportInFlightRef = useRef(false);

  const resetReport = useCallback(() => {
    setReportRun(null);
    setReportDelivery(null);
    setReportLoading(false);
    lastReportDeliveryIdRef.current = null;
    reportAbortRef.current?.abort();
    reportInFlightRef.current = false;
  }, []);

  const handleViewReport = useCallback(
    async (
      deliveryId = selectedDeliveryId,
      { force = false }: { force?: boolean } = {},
    ) => {
      if (!deliveryId || !canRead) return;
      if (reportInFlightRef.current) return;
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

        const runs = await builderApi.listByDelivery({
          deliveryId,
          limit: 1,
          sortOrder: "DESC",
        });
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
      } catch (error) {
        if (controller.signal.aborted) return;
        lastReportDeliveryIdRef.current = deliveryId;
        setReportNotice({ text: getErrorMessage(error), tone: "warning" });
      } finally {
        if (!controller.signal.aborted) {
          reportInFlightRef.current = false;
          setReportLoading(false);
        }
      }
    },
    [canRead, selectedDeliveryId],
  );

  useEffect(() => {
    if (!selectedAssignmentId) {
      resetReport();
    }
  }, [resetReport, selectedAssignmentId]);

  return {
    reportRun,
    reportDelivery,
    reportLoading,
    reportNotice,
    handleViewReport,
  };
}
