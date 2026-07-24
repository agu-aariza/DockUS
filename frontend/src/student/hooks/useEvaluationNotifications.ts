/**
 * @fileoverview Hook de lógica de negocio para el espacio del estudiante (useEvaluationNotifications).
 *
 * @module useEvaluationNotifications
 */

/**
 * Hook que hace polling de las entregas recientes del alumno y detecta
 * cuando aparece un informe técnico o una nota oficial nueva.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { builderApi } from "../../shared/api/builderApi";
import { deliveriesApi } from "../../shared/api/services";
import { useVisibilityAwareInterval } from "../../shared/hooks/useVisibilityAwareInterval";
import type { BuildRunEntity } from "../../shared/types";
import {
  deriveEvaluationNotifications,
  type EvaluationNotification,
} from "../evaluationNotifications";

const DEFAULT_POLL_INTERVAL_MS = 15_000;

export function useEvaluationNotifications(options?: {
  pollIntervalMs?: number;
}) {
  const [notifications, setNotifications] = useState<EvaluationNotification[]>([]);
  const seenRunIdsRef = useRef(new Set<string>());
  const activeRef = useRef(true);
  const pollIntervalMs = options?.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;

  const checkForCompletedRuns = useCallback(async () => {
    try {
      const response = await deliveriesApi.list({
        limit: 20,
        sortBy: "updatedAt",
        sortOrder: "DESC",
      });

      const recentDeliveries = response.data;
      const latestRunsByDeliveryId = await builderApi
        .listLatestRunsByDeliveries(recentDeliveries.map((delivery) => delivery.id))
        .catch(() => ({}) as Record<string, BuildRunEntity | null>);

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

    return () => {
      activeRef.current = false;
    };
  }, [checkForCompletedRuns]);

  // El sondeo se suspende con la pestaña oculta (ESC-ALTO-10): son dos
  // peticiones cada 15 s por alumno conectado, y sostenerlas para pestañas que
  // nadie está mirando era la mayor fuente de carga en reposo del sistema.
  useVisibilityAwareInterval(() => {
    if (activeRef.current) {
      void checkForCompletedRuns();
    }
  }, pollIntervalMs);

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
