import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { builderApi } from "../../builder/api/builderApi";
import type { BuildRunEntity } from "../../features/builder/types";
import { queryKeys } from "../../shared/query/queryKeys";
import { getErrorMessage } from "../../shared/utils/errors";
import { StudentReportView } from "./StudentReportView";
import { TeacherReportView } from "./TeacherReportView";

interface ReportViewProps {
  run: BuildRunEntity;
  deliveryVersion?: number;
  mode?: "student" | "teacher";
  onUseAiGrade?: (grade: number) => void;
}

export function ReportView({
  run,
  mode = "teacher",
  onUseAiGrade,
}: ReportViewProps): JSX.Element {
  const [activeMode, setActiveMode] = useState<"student" | "teacher">(mode);

  useEffect(() => {
    setActiveMode(mode);
  }, [mode]);

  const reportQuery = useQuery({
    queryKey: queryKeys.builderRuns.reportV3(run.id, activeMode),
    queryFn: () => builderApi.report(run.id, activeMode),
    staleTime: 30_000,
  });

  const download = async (audience?: "student" | "teacher") => {
    const targetAudience = audience ?? activeMode;
    const blob = await builderApi.exportReport(run.id, targetAudience);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `informe-${run.id}-${targetAudience}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (reportQuery.isPending) {
    return (
      <div className="rounded-lg border border-app-border bg-app-surface p-10 text-center text-sm text-app-text-muted">
        Cargando la proyección autorizada del informe…
      </div>
    );
  }

  if (reportQuery.isError) {
    return (
      <div className="rounded-lg border border-danger/30 bg-danger-subtle p-4 text-sm text-danger-800 dark:text-danger-300">
        No se pudo cargar el informe: {getErrorMessage(reportQuery.error)}
      </div>
    );
  }

  const report = reportQuery.data;
  if (report.audience === "student") {
    return (
      <div className="space-y-4">
        {mode === "teacher" && (
          <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary-subtle px-4 py-3 text-sm text-primary">
            <span>Previsualizando el informe tal y como lo verá el estudiante.</span>
            <button
              type="button"
              onClick={() => setActiveMode("teacher")}
              className="font-semibold underline hover:text-primary-dark"
            >
              Volver a la vista docente
            </button>
          </div>
        )}
        <StudentReportView
          report={report}
          onExport={() => void download("student")}
          buildRunId={run.id}
        />
      </div>
    );
  }

  return (
    <TeacherReportView
      report={report}
      onExport={() => void download("teacher")}
      onExportStudent={() => void download("student")}
      onPreviewStudent={() => setActiveMode("student")}
      onUseAiGrade={onUseAiGrade}
    />
  );
}
