import type { BuildRunEntity, DeliveryEntity } from "../shared/types";

export type EvaluationNotificationKind = "report_ready" | "grade_published";

export interface EvaluationNotification {
  id: string;
  kind: EvaluationNotificationKind;
  deliveryId: string;
  deliveryVersion: number;
  projectTitle: string;
  outcome: "SUCCESS" | "FAILED" | "CANCELLED" | null;
  reportAvailable: boolean;
  grade: number | null;
  dismissedAt: string | null;
}

interface DeriveEvaluationNotificationsInput {
  deliveries: DeliveryEntity[];
  latestRunsByDeliveryId: Record<string, BuildRunEntity | null | undefined>;
  seenNotificationIds: Set<string>;
}

function buildGradeNotificationId(delivery: DeliveryEntity): string {
  return `grade:${delivery.id}:${delivery.grade}:${delivery.updatedAt}`;
}

function buildReportNotificationId(run: BuildRunEntity): string {
  return `report:${run.id}`;
}

export function deriveEvaluationNotifications(
  input: DeriveEvaluationNotificationsInput,
): EvaluationNotification[] {
  const notifications: EvaluationNotification[] = [];

  const deliveries = [...input.deliveries].sort(
    (left, right) =>
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  );

  for (const delivery of deliveries) {
    const latestRun = input.latestRunsByDeliveryId[delivery.id] ?? null;

    if (typeof delivery.grade === "number") {
      const notificationId = buildGradeNotificationId(delivery);
      if (input.seenNotificationIds.has(notificationId)) {
        continue;
      }

      notifications.push({
        id: notificationId,
        kind: "grade_published",
        deliveryId: delivery.id,
        deliveryVersion: delivery.version,
        projectTitle: delivery.projectTitle,
        outcome:
          latestRun?.status === "SUCCESS" ||
          latestRun?.status === "FAILED" ||
          latestRun?.status === "CANCELLED"
            ? latestRun.status
            : null,
        reportAvailable: Boolean(latestRun?.report),
        grade: delivery.grade,
        dismissedAt: null,
      });
      continue;
    }

    const runIsTerminal =
      latestRun?.status === "SUCCESS" ||
      latestRun?.status === "FAILED" ||
      latestRun?.status === "CANCELLED";
    if (!latestRun || !runIsTerminal || !latestRun.report) {
      continue;
    }

    const notificationId = buildReportNotificationId(latestRun);
    if (input.seenNotificationIds.has(notificationId)) {
      continue;
    }

    notifications.push({
      id: notificationId,
      kind: "report_ready",
      deliveryId: delivery.id,
      deliveryVersion: delivery.version,
      projectTitle: delivery.projectTitle,
      outcome:
        latestRun.status === "SUCCESS" ||
        latestRun.status === "FAILED" ||
        latestRun.status === "CANCELLED"
          ? latestRun.status
          : null,
      reportAvailable: true,
      grade: null,
      dismissedAt: null,
    });
  }

  return notifications;
}
