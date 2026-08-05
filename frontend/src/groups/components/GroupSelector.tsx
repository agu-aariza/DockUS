import { RiArrowRightSLine, RiGroupLine } from "react-icons/ri";
import type { CourseGroupEntity } from "../../features/groups/types";
import { EmptyState } from "../../shared/components/EmptyState";
import { Skeleton } from "../../shared/components/Skeleton";
import { Button } from "../../shared/components/ui/Button";
import { SectionCard } from "../../shared/components/ui/Layout";
import { SearchInput } from "../../shared/components/ui/SearchInput";
import { VisualPicker } from "../../shared/components/ui/VisualPicker";

interface GroupSelectorProps {
  groups: CourseGroupEntity[];
  selectedId: string;
  search: string;
  loading: boolean;
  error: string | null;
  onSearchChange: (_value: string) => void;
  onSelect: (_groupId: string) => void;
  onRetry: () => void;
}

function GroupOptionList({
  groups,
  selectedId,
  onSelect,
}: Pick<GroupSelectorProps, "groups" | "selectedId" | "onSelect">) {
  return (
    <div className="custom-scrollbar max-h-[calc(100vh-18rem)] space-y-1 overflow-y-auto pr-1">
      {groups.map((group) => {
        const selected = group.id === selectedId;
        return (
          <button
            key={group.id}
            type="button"
            aria-current={selected ? "true" : undefined}
            onClick={() => onSelect(group.id)}
            className={[
              "group relative flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors",
              selected
                ? "bg-primary-subtle text-primary"
                : "text-app-text-secondary hover:bg-app-bg-subtle hover:text-app-text",
            ].join(" ")}
          >
            {selected ? (
              <span
                className="absolute inset-y-2 left-0 w-0.5 rounded-r bg-primary"
                aria-hidden="true"
              />
            ) : null}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">
                {group.name}
              </span>
              <span className="mt-0.5 flex items-center gap-2 text-[11px] text-app-text-muted">
                <span className="truncate font-mono">
                  {group.code || "Sin código"}
                </span>
                <span aria-hidden="true">·</span>
                <span className="whitespace-nowrap">
                  {group.studentCount} alumnos
                </span>
              </span>
            </span>
            <RiArrowRightSLine
              className={[
                "shrink-0 transition-transform",
                selected
                  ? "translate-x-0.5 text-primary"
                  : "text-app-text-muted group-hover:translate-x-0.5",
              ].join(" ")}
              aria-hidden="true"
            />
          </button>
        );
      })}
    </div>
  );
}

export function GroupSelector({
  groups,
  selectedId,
  search,
  loading,
  error,
  onSearchChange,
  onSelect,
  onRetry,
}: GroupSelectorProps) {
  const pickerOptions = groups.map((group) => ({
    id: group.id,
    label: group.name,
    description: group.code || "Sin código",
    badge: String(group.studentCount),
    icon: <RiGroupLine />,
  }));

  return (
    <>
      <div className="lg:hidden">
        {error ? (
          <div className="rounded-lg border border-danger-200 bg-danger-50 p-4 text-sm text-danger-700 dark:border-danger-800 dark:bg-danger-subtle dark:text-danger-400">
            <p>{error}</p>
            <Button variant="secondary" size="sm" className="mt-3" onClick={onRetry}>
              Reintentar
            </Button>
          </div>
        ) : (
          <VisualPicker
            id="groups-mobile-picker"
            options={pickerOptions}
            value={selectedId || null}
            onSelect={(id) => onSelect(id)}
            placeholder={loading ? "Cargando grupos..." : "Selecciona un grupo"}
            searchPlaceholder="Buscar grupo..."
            emptyMessage="No hay grupos disponibles"
          />
        )}
      </div>

      <SectionCard
        title="Tus grupos"
        description={`${groups.length} grupos disponibles`}
        className="hidden lg:sticky lg:top-8 lg:block"
      >
        <SearchInput
          value={search}
          onChange={onSearchChange}
          placeholder="Buscar grupo..."
          aria-label="Buscar grupo"
          className="mb-3"
        />

        {loading ? (
          <div className="space-y-3" aria-label="Cargando grupos" aria-busy="true">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="flex items-center gap-3 px-2 py-2">
                <Skeleton type="rounded" className="h-8 w-8" />
                <div className="flex-1 space-y-2">
                  <Skeleton type="text" className="h-3 w-2/3" />
                  <Skeleton type="text" className="h-2.5 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-md border border-danger-200 bg-danger-50 p-3 text-sm text-danger-700 dark:border-danger-800 dark:bg-danger-subtle dark:text-danger-400">
            <p>{error}</p>
            <Button variant="secondary" size="sm" className="mt-3" onClick={onRetry}>
              Reintentar
            </Button>
          </div>
        ) : groups.length > 0 ? (
          <GroupOptionList groups={groups} selectedId={selectedId} onSelect={onSelect} />
        ) : (
          <EmptyState
            title="Sin grupos"
            description="Crea el primer grupo para comenzar a matricular alumnos."
            icon={<RiGroupLine className="text-3xl text-app-text-muted" />}
          />
        )}
      </SectionCard>
    </>
  );
}
/**
 * Selector reutilizable de grupos para flujos docentes y de asignación.
 * Mantiene la presentación de opciones separada de la lógica que carga y guarda la selección.
 */
