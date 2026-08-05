/**
 * @fileoverview Panel y vista del espacio del alumno (PipelineStepper).
 *
 * @module PipelineStepper
 */

import {
  RiUploadCloud2Line,
  RiTimeLine,
  RiLoader4Line,
  RiFileTextLine,
  RiAwardLine,
  RiCheckLine,
  RiAlertLine,
} from "react-icons/ri";
import type { StudentWorkflowState } from "../shared/types";

interface PipelineStepperProps {
  workflowState: StudentWorkflowState;
  stageStartedAt?: string | null;
  compact?: boolean;
}

const PIPELINE_STEPS = [
  { id: "upload", label: "Subir", icon: RiUploadCloud2Line },
  { id: "queue", label: "En cola", icon: RiTimeLine },
  { id: "build", label: "Evaluando", icon: RiLoader4Line },
  { id: "report", label: "Informe", icon: RiFileTextLine },
  { id: "grade", label: "Nota", icon: RiAwardLine },
] as const;

const STATE_TO_STEP_INDEX: Record<StudentWorkflowState, number> = {
  NOT_ASSIGNED: -1,
  WINDOW_NOT_OPEN: -1,
  READY_TO_SUBMIT: 0,
  RECEIVED: 0,
  QUEUED: 1,
  RUNNING: 2,
  BUILD_FAILED: 2,
  REPORT_READY: 3,
  AWAITING_TEACHER_REVIEW: 3,
  GRADED: 4,
};

const FAILED_STATES = new Set<StudentWorkflowState>(["BUILD_FAILED"]);

function formatElapsed(startIso: string): string {
  const ms = Date.now() - new Date(startIso).getTime();
  if (ms < 0) return "";
  const mins = Math.max(1, Math.round(ms / 60_000));
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  const remainMins = mins % 60;
  if (hours < 24) return remainMins > 0 ? `${hours} h ${remainMins} min` : `${hours} h`;
  const days = Math.floor(hours / 24);
  const remainHours = hours % 24;
  return remainHours > 0 ? `${days} d ${remainHours} h` : `${days} d`;
}

export function PipelineStepper({
  workflowState,
  stageStartedAt,
  compact = false,
}: PipelineStepperProps): JSX.Element | null {
  const activeIndex = STATE_TO_STEP_INDEX[workflowState];
  if (activeIndex < 0) return null;

  const isFailed = FAILED_STATES.has(workflowState);
  const circleSize = compact ? "h-8 w-8" : "h-10 w-10";
  const iconSize = compact ? "text-sm" : "text-base";
  const labelSize = compact ? "text-[10px]" : "text-xs";

  return (
    <div className="flex items-start w-full" role="group" aria-label="Pipeline de evaluación">
      {PIPELINE_STEPS.map((step, i) => {
        const isCompleted = i < activeIndex;
        const isCurrent = i === activeIndex;
        const isFailedStep = isCurrent && isFailed;
        const isFuture = i > activeIndex;

        let circleClasses: string;
        let IconComponent = step.icon;
        let labelColor: string;

        if (isCompleted) {
          circleClasses = "border-success-400 bg-success-50 text-success-600 dark:border-success-700 dark:bg-success-950 dark:text-success-400";
          IconComponent = RiCheckLine;
          labelColor = "text-success-600 dark:text-success-400";
        } else if (isFailedStep) {
          circleClasses = "border-danger-300 bg-danger-50 text-danger-600 dark:border-danger-700 dark:bg-danger-950 dark:text-danger-400";
          IconComponent = RiAlertLine;
          labelColor = "text-danger-600 dark:text-danger-400";
        } else if (isCurrent) {
          circleClasses = "border-primary/40 bg-primary/5 text-primary ring-2 ring-primary/10";
          labelColor = "text-primary";
        } else {
          circleClasses = "border-app-border/30 bg-app-bg-subtle/50 text-app-text-muted";
          labelColor = "text-app-text-muted";
        }

        const connectorColor = isCompleted
          ? "bg-success-400 dark:bg-success-700"
          : isCurrent && !isFuture
            ? isFailedStep
              ? "bg-danger-300 dark:bg-danger-700"
              : "bg-primary/40"
            : "bg-app-bg-subtle";

        return (
          <div key={step.id} className="flex items-start flex-1 min-w-0">
            {/* Step circle + label */}
            <div className="flex flex-col items-center">
              <div
                className={`${circleSize} flex items-center justify-center rounded-full border-2 transition-all duration-300 ${circleClasses} ${
                  isCurrent && !isFailedStep ? "animate-pulse" : ""
                }`}
              >
                <IconComponent className={iconSize} />
              </div>
              <span className={`mt-1.5 font-semibold ${labelSize} ${labelColor} text-center leading-tight`}>
                {step.label}
              </span>
              {isCurrent && stageStartedAt && !compact && (
                <span className="mt-0.5 text-[10px] text-app-text-muted">
                  {formatElapsed(stageStartedAt)}
                </span>
              )}
            </div>

            {/* Connector line */}
            {i < PIPELINE_STEPS.length - 1 && (
              <div className="flex-1 flex items-center px-1" style={{ marginTop: compact ? 14 : 18 }}>
                <div className={`h-0.5 w-full rounded-full transition-colors duration-300 ${connectorColor}`} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
