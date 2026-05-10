/**
 * Hook que hace polling de las entregas recientes del alumno y detecta
 * cuando aparece un informe técnico o una nota oficial nueva.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { builderApi } from "../../shared/api/builderApi";
import { deliveriesApi } from "../../shared/api/services";
import type { BuildRunEntity } from "../../shared/types";
import {
  deriveEvaluationNotifications,
  type EvaluationNotification,
} from "../evaluationNotifications";

const POLL_INTERVAL_MS = 15_000;

export function useEvaluationNotifications() {
  const [notifications, setNotifications] = useState<EvaluationNotification[]>([]);
  const seenRunIdsRef = useRef(new Set<string>());
  const activeRef = useRef(true);

  const checkForCompletedRuns = useCallback(async () => {
    try {
      const response = await deliveriesApi.list({
        limit: 20,
        sortBy: "updatedAt",
        sortOrder: "DESC",
      });

      const recentDeliveries = response.data;
      const latestRunsByDeliveryId: Record<string, BuildRunEntity | null> = {};

      for (const delivery of recentDeliveries) {
        try {
          const runs = await builderApi.listByDelivery({
            deliveryId: delivery.id,
            limit: 1,
            sortOrder: "DESC",
          });
          latestRunsByDeliveryId[delivery.id] = runs.data[0] ?? null;
        } catch {
          latestRunsByDeliveryId[delivery.id] = null;
        }
      }

      const nextNotifications = deriveEvaluationNotifications({
        deliveries: recentDeliveries,
        latestRunsByDeliveryId,
        seenNotificationIds: seenRunIdsRef.current,
      });

      if (nextNotifications.length > 0) {
        nextNotifications.forEach((notification) => {
          seenRunIdsRef.current.add(notification.id);
        });
        setNotifications((prev) => [...nextNotifications, ...prev]);
      }
    } catch {
      // Silently skip poll errors; we'll retry on the next interval.
    }
  }, []);

  useEffect(() => {
    activeRef.current = true;

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

  const dismissNotification = useCallback((notificationId: string) => {
    setNotifications((prev) =>
      prev.map((notification) =>
        notification.id === notificationId
          ? { ...notification, dismissedAt: new Date().toISOString() }
          : notification,
      ),
    );
  }, []);

  const dismissAll = useCallback(() => {
    setNotifications((prev) =>
      prev.map((notification) => ({
        ...notification,
        dismissedAt: new Date().toISOString(),
      })),
    );
  }, []);

  const activeNotifications = notifications.filter(
    (notification) => !notification.dismissedAt,
  );

  return {
    notifications: activeNotifications,
    allNotifications: notifications,
    dismissNotification,
    dismissAll,
    hasUnread: activeNotifications.length > 0,
  };
}
