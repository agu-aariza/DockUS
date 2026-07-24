import { RiFileTextLine, RiLoader4Line } from "react-icons/ri";
import { BuildRunEntity, DeliveryEntity } from "../../shared/types";
import { useWorkspaceSelection } from "../../shared/workspace/WorkspaceContext";
import { Button } from "../../shared/components/ui/Button";
import { EmptyState } from "../../shared/components/EmptyState";
import { ReportView } from "../../shared/components/ReportView";
import { TeacherReviewSummary } from "./TeacherReviewSummary";

export function DeliveryReport({
  selectedDelivery,
  reportRun,
  reportDeliveryVersion,
  reportLoading,
  selectedDeliveryReviewNotes,
  onHandleViewReport,
}: {
  selectedDelivery: DeliveryEntity;
  reportRun: BuildRunEntity | null;
  reportDeliveryVersion: number | undefined;
  reportLoading: boolean;
  selectedDeliveryReviewNotes: { manualNotes?: string | null; legacyBlocks?: string[] };
  onHandleViewReport: (_id?: string, _options?: { force?: boolean }) => void;
}) {
  const { selection } = useWorkspaceSelection();
  const selectedDeliveryId = selection.deliveryId;

  return (
    <section className="rounded-lg border border-app-border bg-white p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">
            Dictamen de Evaluación Técnica
          </h4>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Se carga desde el último run disponible de la entrega y convive aquí con el contexto de corrección.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void onHandleViewReport(undefined, { force: true })}
          disabled={!selectedDeliveryId || reportLoading}
        >
          <RiFileTextLine />
          {reportLoading ? "Cargando..." : "Recargar informe"}
        </Button>
      </div>

      <div className="mt-5">
        <TeacherReviewSummary
          delivery={selectedDelivery}
          latestRun={reportRun}
          manualGraderNotes={selectedDeliveryReviewNotes.manualNotes}
          legacyAiEvidence={selectedDeliveryReviewNotes.legacyBlocks}
        />
      </div>

      <div className="mt-6">
        {reportLoading ? (
          <div className="flex justify-center py-12 text-slate-400">
            <RiLoader4Line className="animate-spin text-2xl" />
          </div>
        ) : reportRun ? (
          <ReportView
            run={reportRun}
            deliveryVersion={reportDeliveryVersion}
            mode="teacher"
          />
        ) : (
          <EmptyState
            icon={<RiFileTextLine className="text-3xl text-slate-400" />}
            title="Ningún informe cargado"
            description="Pulsa en 'Recargar informe' para traer el último run asociado a esta entrega."
          />
        )}
      </div>
    </section>
  );
}
