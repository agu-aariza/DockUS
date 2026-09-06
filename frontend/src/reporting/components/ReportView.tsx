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
  const reportQuery = useQuery({
    queryKey: queryKeys.builderRuns.reportV3(run.id, mode),
    queryFn: () => builderApi.report(run.id),
    staleTime: 30_000,
  });

  const download = async (audience?: "student" | "teacher") => {
    const blob = await builderApi.exportReport(run.id, audience);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `informe-${run.id}-${audience ?? mode}.md`;
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
      <StudentReportView
        report={report}
        onExport={() => void download("student")}
        buildRunId={run.id}
      />
    );
  }

  return (
    <TeacherReportView
      report={report}
      onExport={() => void download("teacher")}
      onExportStudent={() => void download("student")}
      onUseAiGrade={onUseAiGrade}
    />
  );
}
