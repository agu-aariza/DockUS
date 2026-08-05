/**
 * @fileoverview Vista y gestión de entregas de código de alumnos (DeliveriesSidebar).
 *
 * @module DeliveriesSidebar
 */

import { RiRefreshLine, RiInboxArchiveLine, RiPulseLine, RiCheckFill, RiCloseLine } from "react-icons/ri";
import { BuildRunEntity, DeliveryEntity, ProjectAssignmentEntity } from "../../shared/types";
import { useWorkspaceSelection } from "../../shared/workspace/WorkspaceContext";
import { Button } from "../../shared/components/ui/Button";
import { VisualPicker, VisualPickerOption } from "../../shared/components/ui/VisualPicker";
import { SearchInput } from "../../shared/components/ui/SearchInput";
import { MetricCard } from "../../shared/components/MetricCard";
import { SkeletonTable } from "../../shared/components/Skeleton";
import { DeliveryListItem } from "./DeliveryListItem";
import { AssignmentLabel } from "./AssignmentLabel";

export type DeliveryQuickFilterKey = "all" | "late" | "ungraded" | "fail" | "pass" | "needs-review";

const QUICK_FILTERS: { key: DeliveryQuickFilterKey; label: string }[] = [
  { key: "all", label: "Todas" },
  { key: "late", label: "Tardías" },
  { key: "ungraded", label: "Sin nota" },
  { key: "fail", label: "Suspensas" },
  { key: "pass", label: "Aprobadas" },
  { key: "needs-review", label: "Necesita revisión" },
];

export function DeliveriesSidebar({
  projectOptions,
  assignmentOptions,
  deliverySearch,
  quickFilterKey,
  visibleDeliveries,
  latestRunByDeliveryId,
  submittedCount,
  reviewCount,
  evaluatedCount,
  loadingDeliveries,
  selectedAssignment,
  onRefreshDeliveries,
  onProjectSelect,
  onAssignmentSelect,
  onAssignmentClear,
  onDeliverySearchChange,
  onQuickFilterChange,
  openDelivery,
  handleViewReport,
  handleQuickGrade,
}: {
  projectOptions: VisualPickerOption[];
  assignmentOptions: VisualPickerOption[];
  deliverySearch: string;
  quickFilterKey: DeliveryQuickFilterKey;
  visibleDeliveries: DeliveryEntity[];
  latestRunByDeliveryId: Record<string, BuildRunEntity | null>;
  submittedCount: number;
  reviewCount: number;
  evaluatedCount: number;
  loadingDeliveries: boolean;
  selectedAssignment: ProjectAssignmentEntity | undefined;
  onRefreshDeliveries: () => void;
  onProjectSelect: (_id: string) => void;
  onAssignmentSelect: (_id: string, _label: string) => void;
  onAssignmentClear: () => void;
  onDeliverySearchChange: (_value: string) => void;
  onQuickFilterChange: (_key: DeliveryQuickFilterKey) => void;
  openDelivery: (_id: string, _tab: "overview" | "grading" | "report") => void;
  handleViewReport: (_id: string) => void;
  handleQuickGrade: (_id: string, _grade: number) => void;
}) {
  const { selection } = useWorkspaceSelection();
  const selectedProjectId = selection.projectId ?? "";
  const selectedAssignmentId = selection.assignmentId ?? "";
  const selectedDeliveryId = selection.deliveryId ?? "";

  return (
    <aside className="flex h-full flex-col overflow-hidden rounded-lg border border-app-border bg-app-surface p-4 lg:sticky lg:top-24">
      <div className="flex items-center justify-between gap-3 mb-5">
        <div>
          <h3 className="text-sm font-semibold text-app-text">
            Cola Operativa
          </h3>
          <p className="mt-0.5 text-xs text-app-text-secondary">Entregas</p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="h-9 w-9 !p-0 shadow-sm"
          onClick={onRefreshDeliveries}
          disabled={!selectedProjectId}
        >
          <RiRefreshLine className={loadingDeliveries ? "animate-spin" : ""} />
        </Button>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="deliveries-sidebar-project-picker" className="label-text">Proyecto</label>
          <VisualPicker
            id="deliveries-sidebar-project-picker"
            options={projectOptions}
            value={selectedProjectId}
            onSelect={onProjectSelect}
            placeholder="Selecciona proyecto..."
            searchPlaceholder="Buscar por título..."
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="deliveries-sidebar-assignment-picker" className="label-text mb-0">
              Filtrar por alumno
            </label>
            {selectedAssignmentId && (
              <button
                type="button"
                onClick={onAssignmentClear}
                className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-semibold text-app-text-muted transition-colors hover:bg-app-bg-subtle hover:text-app-text"
              >
                <RiCloseLine className="text-sm" aria-hidden="true" />
                Ver todos
              </button>
            )}
          </div>
          <VisualPicker
            id="deliveries-sidebar-assignment-picker"
            options={assignmentOptions}
            value={selectedAssignmentId}
            onSelect={onAssignmentSelect}
            placeholder="Todos los alumnos"
            searchPlaceholder="Buscar por nombre o email..."
            className={!selectedProjectId ? 'opacity-50 grayscale pointer-events-none' : ''}
          />
        </div>

        <SearchInput
          value={deliverySearch}
          onChange={onDeliverySearchChange}
          placeholder="Buscar por alumno, proyecto o estado"
        />

        <div className="flex flex-wrap gap-1.5">
          {QUICK_FILTERS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => onQuickFilterChange(key)}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all active:scale-[0.97] hover:shadow-sm ${
                quickFilterKey === key
                  ? "bg-primary text-white shadow-sm shadow-primary/20"
                  : "border border-app-border bg-app-surface text-app-text-secondary hover:border-app-text-muted/40 hover:bg-app-bg-subtle"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3">
        <MetricCard
          label="Visibles"
          value={visibleDeliveries.length}
          helper="Entregas registradas"
          variant="default"
          icon={<RiInboxArchiveLine />}
        />
        <div className="grid grid-cols-2 gap-3">
          <MetricCard
            label="Pendientes"
            value={submittedCount + reviewCount}
            helper="Por revisar"
            variant="warning"
            icon={<RiPulseLine />}
          />
          <MetricCard
            label="Cerradas"
            value={evaluatedCount}
            helper="Calificadas"
            variant="info"
            icon={<RiCheckFill />}
          />
        </div>
      </div>

      <div className="mt-5 border-t border-app-border pt-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <p className="ui-label">Selección actual</p>
            <div className="mt-1 text-sm font-semibold text-app-text">
              <AssignmentLabel assignment={selectedAssignment} />
            </div>
          </div>
        </div>

        <div className="space-y-2.5">
          {loadingDeliveries ? (
            <SkeletonTable rows={4} />
          ) : visibleDeliveries.length === 0 ? (
            <div className="rounded-xl border border-dashed border-app-border bg-app-bg-subtle/30 px-4 py-8 text-center text-xs font-semibold text-app-text-muted leading-relaxed">
              {!selectedProjectId
                ? "Selecciona un proyecto para cargar entregas."
                : "No hay entregas con los filtros actuales."}
            </div>
          ) : (
            visibleDeliveries.map((delivery) => (
              <DeliveryListItem
                key={delivery.id}
                delivery={delivery}
                latestRun={latestRunByDeliveryId[delivery.id]}
                active={selectedDeliveryId === delivery.id}
                onSelect={() => openDelivery(delivery.id, "overview")}
                onOpenReport={() => {
                  openDelivery(delivery.id, "report");
                  handleViewReport(delivery.id);
                }}
                onQuickGrade={(grade) => handleQuickGrade(delivery.id, grade)}
              />
            ))
          )}
        </div>
      </div>
    </aside>
  );
}
