/**
 * Hook que hace polling de las entregas del alumno en estado IN_REVIEW
 * y detecta cuando un BuildRun llega a estado terminal para notificar.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { deliveriesApi } from "../../shared/api/services";
import { builderApi } from "../../shared/api/builderApi";
import type { DeliveryEntity, BuildRunEntity } from "../../shared/types";

export interface EvaluationNotification {
  id: string;
  deliveryId: string;
  deliveryVersion: number;
  projectTitle: string;
  outcome: "SUCCESS" | "FAILED" | "CANCELLED";
  reportAvailable: boolean;
  dismissedAt: string | null;
}

const POLL_INTERVAL_MS = 15_000;

export function useEvaluationNotifications() {
  const [notifications, setNotifications] = useState<EvaluationNotification[]>([]);
  const seenRunIdsRef = useRef(new Set<string>());
  const activeRef = useRef(true);

  const checkForCompletedRuns = useCallback(async () => {
    try {
      // Get deliveries that are being reviewed
      const response = await deliveriesApi.list({
        status: "IN_REVIEW",
        limit: 20,
        sortBy: "createdAt",
        sortOrder: "DESC",
      });

      const inReviewDeliveries = response.data;

      for (const delivery of inReviewDeliveries) {
        try {
          const runs = await builderApi.listByDelivery({
            deliveryId: delivery.id,
            limit: 1,
            sortOrder: "DESC",
          });

          if (runs.data.length === 0) continue;

          const latestRun = runs.data[0];
          const isTerminal = ["SUCCESS", "FAILED", "CANCELLED"].includes(latestRun.status);

          if (isTerminal && !seenRunIdsRef.current.has(latestRun.id)) {
            seenRunIdsRef.current.add(latestRun.id);

            setNotifications((prev) => [
              {
                id: latestRun.id,
                deliveryId: delivery.id,
                deliveryVersion: delivery.version,
                projectTitle: delivery.projectTitle,
                outcome: latestRun.status as "SUCCESS" | "FAILED" | "CANCELLED",
                reportAvailable: latestRun.report != null,
                dismissedAt: null,
              },
              ...prev,
            ]);
          }
        } catch {
          // Silently skip individual delivery check failures
        }
      }
    } catch {
      // Silently skip poll errors — we'll retry on next interval
    }
  }, []);

  useEffect(() => {
    activeRef.current = true;

    // Initial check
    void checkForCompletedRuns();

    const interval = setInterval(() => {
      if (activeRef.current) {
        void checkForCompletedRuns();
      }
    }, POLL_INTERVAL_MS);

    return () => {
      activeRef.current = false;
      clearInterval(interval);
    };
  }, [checkForCompletedRuns]);

  const dismissNotification = useCallback((runId: string) => {
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === runId ? { ...n, dismissedAt: new Date().toISOString() } : n,
      ),
    );
  }, []);

  const dismissAll = useCallback(() => {
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, dismissedAt: new Date().toISOString() })),
    );
  }, []);

  const activeNotifications = notifications.filter((n) => !n.dismissedAt);

  return {
    notifications: activeNotifications,
    allNotifications: notifications,
    dismissNotification,
    dismissAll,
    hasUnread: activeNotifications.length > 0,
  };
}
