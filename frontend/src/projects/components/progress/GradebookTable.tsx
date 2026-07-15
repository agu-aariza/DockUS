import {
  RiAwardLine,
  RiCodeSSlashLine,
  RiFileTextLine,
  RiHistoryLine,
} from "react-icons/ri";
import { BuilderOutcomeBadge } from "../../../features/builder/components/BuilderOutcomeBadge";
import { DeliveryStatusBadge } from "../../../features/deliveries/components/DeliveryStatusBadge";
import { DataTable, type Column } from "../../../shared/components/ui/DataTable";
import type { ProjectGradebookRow } from "../../../features/projects/types";
import { extractLegacyAiEvidence } from "../../../deliveries/teacherReviewNavigation";
import type { TeacherDeliveryDetailTab } from "../../../deliveries/teacherReviewNavigation";

interface GradebookTableProps {
  rows: ProjectGradebookRow[];
  loading?: boolean;
  onPreview: (deliveryId: string) => void;
  onOpenReview: (
    assignmentId: string,
    deliveryId: string,
    tab: TeacherDeliveryDetailTab,
  ) => void;
  onViewHistory: (assignmentId: string, studentName: string) => void;
}

function RowActions({
  row,
  onPreview,
  onOpenReview,
  onViewHistory,
}: { row: ProjectGradebookRow } & Pick<
  GradebookTableProps,
  "onPreview" | "onOpenReview" | "onViewHistory"
>): JSX.Element {
  const deliveryId = row.latestDeliveryId;

  return (
    <div className="flex items-center justify-center gap-2">
      <button
        className="btn-secondary h-9 w-9 justify-center p-0"
        title="Ver código de la última entrega"
        onClick={() => {
          if (deliveryId) onPreview(deliveryId);
        }}
        disabled={!deliveryId}
      >
        <RiCodeSSlashLine aria-hidden="true" />
      </button>
      <button
        className="btn-secondary h-9 w-9 justify-center p-0"
        title="Abrir informe técnico"
        onClick={() =>
          deliveryId && onOpenReview(row.assignmentId, deliveryId, "report")
        }
        disabled={!deliveryId}
      >
        <RiFileTextLine aria-hidden="true" />
      </button>
      <button
        className="btn-secondary h-9 w-9 justify-center p-0"
        title="Abrir corrección docente"
        onClick={() =>
          deliveryId && onOpenReview(row.assignmentId, deliveryId, "grading")
        }
        disabled={!deliveryId}
      >
        <RiAwardLine aria-hidden="true" />
      </button>
      <button
        className="btn-secondary h-9 w-9 justify-center p-0"
        title="Ver historial de entregas"
        onClick={() => onViewHistory(row.assignmentId, row.studentName)}
      >
        <RiHistoryLine aria-hidden="true" />
      </button>
    </div>
  );
}

export function GradebookTable({
  rows,
  loading = false,
  onPreview,
  onOpenReview,
  onViewHistory,
}: GradebookTableProps): JSX.Element {
  const columns: Column<ProjectGradebookRow>[] = [
    {
      header: "Alumno",
      accessor: "studentName",
      sortable: true,
      sortValue: (row) => row.studentName,
      className: "whitespace-normal",
      render: (row) => (
        <div className="min-w-[12rem]">
          <div className="font-medium text-slate-950">{row.studentName}</div>
          <div className="mt-1 text-sm text-slate-500">{row.studentEmail}</div>
        </div>
      ),
    },
    {
      header: "Grupos",
      accessor: (row) =>
        row.groupLabels.length > 0 ? row.groupLabels.join(" · ") : "Sin grupo",
      sortable: true,
      sortValue: (row) => row.groupLabels.join(" · "),
      className: "whitespace-normal text-sm text-slate-600",
    },
    {
      header: "Estado",
      accessor: "latestStatus",
      sortable: true,
      sortValue: (row) => row.latestStatus ?? "DRAFT",
      render: (row) => (
        <>
          <DeliveryStatusBadge status={row.latestStatus ?? "DRAFT"} />
          {row.isLate ? (
            <div className="mt-2 text-xs font-medium text-amber-700">
              Fuera de plazo
            </div>
          ) : null}
        </>
      ),
    },
    {
      header: "Builder",
      accessor: "latestBuilderOutcome",
      sortable: true,
      sortValue: (row) => row.latestBuilderOutcome ?? "UNKNOWN",
      render: (row) => (
        <BuilderOutcomeBadge outcome={row.latestBuilderOutcome ?? null} />
      ),
    },
    {
      header: "Nota",
      accessor: "grade",
      numeric: true,
      sortable: true,
      // `null` (sin corregir) cae al final en ambas direcciones.
      sortValue: (row) => row.grade,
      className: "whitespace-normal",
      render: (row) => (
        <div className="min-w-[9rem]">
          <div className="font-semibold text-slate-900">
            {row.grade !== null ? (
              row.grade.toFixed(2)
            ) : (
              // Sin nota no hay cifra que alinear: la palabra vuelve a la tipografía de texto.
              <span className="font-sans text-slate-500">Pendiente</span>
            )}
          </div>
          <div className="mt-1 line-clamp-2 font-sans text-xs font-normal text-slate-500">
            {extractLegacyAiEvidence(row.graderNotes).manualNotes ||
              "Sin observaciones manuales"}
          </div>
        </div>
      ),
    },
    {
      header: "Intentos",
      accessor: "deliveryCount",
      numeric: true,
      sortable: true,
      sortValue: (row) => row.deliveryCount,
      // La mono es para los dígitos; las etiquetas siguen en la tipografía de texto.
      render: (row) => (
        <>
          <div>
            {row.deliveryCount}
            <span className="font-sans text-slate-500"> enviadas</span>
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {row.remainingDeliveries}
            <span className="font-sans"> restantes</span>
          </div>
        </>
      ),
    },
    {
      header: "Última actividad",
      accessor: "lastActivityAt",
      numeric: true,
      sortable: true,
      sortValue: (row) => new Date(row.lastActivityAt).getTime(),
      render: (row) => new Date(row.lastActivityAt).toLocaleString("es-ES"),
    },
    {
      header: "Acciones",
      accessor: "assignmentId",
      align: "center",
      render: (row) => (
        <RowActions
          row={row}
          onPreview={onPreview}
          onOpenReview={onOpenReview}
          onViewHistory={onViewHistory}
        />
      ),
    },
  ];

  return (
    <DataTable
      caption="Gradebook del proyecto"
      columns={columns}
      data={rows}
      loading={loading}
      keyExtractor={(row) => row.assignmentId}
      density="comfortable"
      stickyHeader
      maxHeight="32rem"
      className="rounded-none border-x-0 border-b-0"
      emptyState={
        <div className="text-center text-sm text-slate-500">
          No hay filas de gradebook para los filtros seleccionados.
        </div>
      }
    />
  );
}
