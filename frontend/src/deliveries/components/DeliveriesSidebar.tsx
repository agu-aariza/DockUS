import { RiRefreshLine, RiInboxArchiveLine, RiPulseLine, RiCheckFill } from "react-icons/ri";
import { DeliveryEntity, ProjectAssignmentEntity } from "../../shared/types";
import { Button } from "../../shared/components/ui/Button";
import { VisualPicker, VisualPickerOption } from "../../shared/components/ui/VisualPicker";
import { SearchInput } from "../../shared/components/ui/SearchInput";
import { MetricCard } from "../../shared/components/MetricCard";
import { SkeletonTable } from "../../shared/components/Skeleton";
import { DeliveryListItem } from "./DeliveryListItem";
import { AssignmentLabel } from "./AssignmentLabel";

const QUICK_FILTERS: { key: "all" | "late" | "ungraded" | "fail" | "pass"; label: string }[] = [
  { key: "all", label: "Todas" },
  { key: "late", label: "Tardías" },
  { key: "ungraded", label: "Sin nota" },
  { key: "fail", label: "Suspensas" },
  { key: "pass", label: "Aprobadas" },
];

export function DeliveriesSidebar({
  selectedProjectId,
  selectedAssignmentId,
  selectedDeliveryId,
  projectOptions,
  assignmentOptions,
  deliverySearch,
  quickFilterKey,
  visibleDeliveries,
  submittedCount,
  reviewCount,
  evaluatedCount,
  loadingDeliveries,
  selectedAssignment,
  onRefreshDeliveries,
  onProjectSelect,
  onAssignmentSelect,
  onDeliverySearchChange,
  onQuickFilterChange,
  openDelivery,
  handleViewReport,
  handleQuickGrade,
}: {
  selectedProjectId: string | null;
  selectedAssignmentId: string | null;
  selectedDeliveryId: string | null;
  projectOptions: VisualPickerOption[];
  assignmentOptions: VisualPickerOption[];
  deliverySearch: string;
  quickFilterKey: "all" | "late" | "ungraded" | "fail" | "pass";
  visibleDeliveries: DeliveryEntity[];
  submittedCount: number;
  reviewCount: number;
  evaluatedCount: number;
  loadingDeliveries: boolean;
  selectedAssignment: ProjectAssignmentEntity | undefined;
  onRefreshDeliveries: () => void;
  onProjectSelect: (_id: string) => void;
  onAssignmentSelect: (_id: string, _label: string) => void;
  onDeliverySearchChange: (_value: string) => void;
  onQuickFilterChange: (_key: "all" | "late" | "ungraded" | "fail" | "pass") => void;
  openDelivery: (_id: string, _tab: "overview" | "grading" | "report") => void;
  handleViewReport: (_id: string) => void;
  handleQuickGrade: (_id: string, _grade: number) => void;
}) {
  return (
    <aside className="flex flex-col h-full rounded-2xl border border-slate-200 bg-white p-5 overflow-hidden lg:sticky lg:top-24 shadow-sm">
      <div className="flex items-center justify-between gap-3 mb-5">
        <div>
          <h3 className="text-sm font-bold text-slate-900">
            Cola Operativa
          </h3>
          <p className="mt-0.5 text-xs text-slate-400 font-medium">Entregas</p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="h-9 w-9 !p-0 shadow-sm"
          onClick={onRefreshDeliveries}
          disabled={!selectedAssignmentId}
        >
          <RiRefreshLine className={loadingDeliveries ? "animate-spin" : ""} />
        </Button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="label-text text-xs font-bold text-slate-500 mb-1.5 block">Proyecto</label>
          <VisualPicker
            options={projectOptions}
            value={selectedProjectId}
            onSelect={onProjectSelect}
            placeholder="Selecciona proyecto..."
            searchPlaceholder="Buscar por título..."
          />
        </div>

        <div>
          <label className="label-text text-xs font-bold text-slate-500 mb-1.5 block">Asignación</label>
          <VisualPicker
            options={assignmentOptions}
            value={selectedAssignmentId}
            onSelect={onAssignmentSelect}
            placeholder="Selecciona alumno..."
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
                  : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
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

      <div className="mt-5 border-t border-slate-100 pt-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Selección actual
            </p>
            <div className="mt-1 text-sm font-semibold text-slate-900">
              <AssignmentLabel assignment={selectedAssignment} />
            </div>
          </div>
        </div>

        <div className="space-y-2.5">
          {loadingDeliveries ? (
            <SkeletonTable rows={4} />
          ) : visibleDeliveries.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/30 px-4 py-8 text-center text-xs font-semibold text-slate-400 leading-relaxed">
              {!selectedAssignmentId
                ? "Selecciona una asignación para cargar entregas."
                : "No hay entregas con los filtros actuales."}
            </div>
          ) : (
            visibleDeliveries.map((delivery) => (
              <DeliveryListItem
                key={delivery.id}
                delivery={delivery}
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
