import { ReportView } from "../shared/components/ReportView";
import type { BuildRunEntity } from "../shared/types";

interface Props {
  run: BuildRunEntity;
  deliveryVersion?: number;
}

export function StudentReportView({
  run,
  deliveryVersion,
}: Props): JSX.Element {
  return (
    <ReportView
      run={run}
      deliveryVersion={deliveryVersion}
      mode="student"
    />
  );
}
