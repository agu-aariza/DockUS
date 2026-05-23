import type {
  BuilderOutcome,
  BuildRunEntity,
  DeliveryEntity,
  ProjectAssignmentEntity,
} from "../shared/types";

export interface StudentWorkspaceInsights {
  activeAssignments: number;
  revokedAssignments: number;
  totalDeliveries: number;
  reportsReady: number;
  pendingEvaluations: number;
  blockedReports: number;
  officialGrades: number;
  latestGrade: number | null;
  passedRuns: number;
}

const ACTIVE_BUILD_STATUSES = new Set(["QUEUED", "RUNNING"]);

function hasTechnicalReport(
  run: BuildRunEntity | null | undefined,
): boolean {
  return Boolean(run?.report || run?.llmAssessment);
}

export function resolveStudentRunOutcome(
  run: BuildRunEntity | null | undefined,
): BuilderOutcome | null {
  if (!run) {
    return null;
  }

  if (run.report?.overallOutcome) {
    return run.report.overallOutcome;
  }

  if (run.status === "SUCCESS") {
    return "PASS";
  }

  if (run.status === "FAILED") {
    return "FAIL";
  }

  return "UNKNOWN";
}

export function deriveStudentWorkspaceInsights(
  assignments: ProjectAssignmentEntity[],
  deliveries: DeliveryEntity[],
  latestRunByDeliveryId: Record<string, BuildRunEntity | null>,
): StudentWorkspaceInsights {
  let reportsReady = 0;
  let pendingEvaluations = 0;
  let blockedReports = 0;
  let passedRuns = 0;

  for (const delivery of deliveries) {
    const run = latestRunByDeliveryId[delivery.id] ?? null;

    if (hasTechnicalReport(run)) {
      reportsReady += 1;
    }

    if (run && ACTIVE_BUILD_STATUSES.has(run.status)) {
      pendingEvaluations += 1;
    } else if (!run && (delivery.status === "SUBMITTED" || delivery.status === "IN_REVIEW")) {
      pendingEvaluations += 1;
    }

    if (run?.report?.coaching?.passReadiness === "BLOCKED") {
      blockedReports += 1;
    }

    if (resolveStudentRunOutcome(run) === "PASS") {
      passedRuns += 1;
    }
  }

  const latestGrade =
    deliveries.find((delivery) => delivery.grade !== null)?.grade ?? null;

  return {
    activeAssignments: assignments.filter((assignment) => !assignment.revokedAt).length,
    revokedAssignments: assignments.filter((assignment) => Boolean(assignment.revokedAt)).length,
    totalDeliveries: deliveries.length,
    reportsReady,
    pendingEvaluations,
    blockedReports,
    officialGrades: deliveries.filter((delivery) => delivery.grade !== null).length,
    latestGrade,
    passedRuns,
  };
}
