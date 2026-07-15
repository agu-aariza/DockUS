import { RiFilter3Line, RiTeamLine } from "react-icons/ri";
import { SearchInput } from "../../../shared/components/ui/SearchInput";
import type { BuilderOutcome } from "../../../features/builder/types";
import type { DeliveryStatus } from "../../../features/deliveries/types";

export interface GroupOption {
  id: string;
  label: string;
}

interface GradebookFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  availableGroups: GroupOption[];
  groupFilter: string;
  onGroupChange: (groupId: string) => void;
  statusFilter: DeliveryStatus | "ALL";
  onStatusChange: (status: DeliveryStatus | "ALL") => void;
  outcomeFilter: BuilderOutcome | "ALL";
  onOutcomeChange: (outcome: BuilderOutcome | "ALL") => void;
  lateOnly: boolean;
  onLateOnlyChange: (lateOnly: boolean) => void;
}

export function GradebookFilters({
  search,
  onSearchChange,
  availableGroups,
  groupFilter,
  onGroupChange,
  statusFilter,
  onStatusChange,
  outcomeFilter,
  onOutcomeChange,
  lateOnly,
  onLateOnlyChange,
}: GradebookFiltersProps): JSX.Element {
  const activeGroupLabel =
    availableGroups.find((group) => group.id === groupFilter)?.label ??
    "Grupo filtrado";

  return (
    <div className="grid gap-4 border-b border-slate-100 bg-slate-50 p-6 lg:grid-cols-6">
      <div className="lg:col-span-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
        <RiFilter3Line />
        Filtros operativos
      </div>
      <SearchInput
        className="lg:col-span-2"
        placeholder="Busca por nombre o correo..."
        value={search}
        onChange={onSearchChange}
        aria-label="Buscar alumno por nombre o correo"
      />
      <select
        className="input-field bg-white"
        value={groupFilter}
        onChange={(event) => onGroupChange(event.target.value)}
      >
        <option value="ALL">Todos los grupos</option>
        {availableGroups.map((group) => (
          <option key={group.id} value={group.id}>
            {group.label}
          </option>
        ))}
      </select>
      <select
        className="input-field bg-white"
        value={statusFilter}
        onChange={(event) =>
          onStatusChange(event.target.value as DeliveryStatus | "ALL")
        }
      >
        <option value="ALL">Todos los estados</option>
        <option value="SUBMITTED">Entregadas</option>
        <option value="IN_REVIEW">En revisión</option>
        <option value="EVALUATED">Evaluadas</option>
        <option value="DRAFT">Borrador</option>
      </select>
      <select
        className="input-field bg-white"
        value={outcomeFilter}
        onChange={(event) =>
          onOutcomeChange(event.target.value as BuilderOutcome | "ALL")
        }
      >
        <option value="ALL">Todos los outcomes</option>
        <option value="PASS">PASS</option>
        <option value="PARTIAL">PARTIAL</option>
        <option value="FAIL">FAIL</option>
        <option value="UNKNOWN">UNKNOWN</option>
      </select>
      <label className="flex items-center gap-3 rounded-md border border-app-border bg-white px-4 py-3 text-sm text-slate-600">
        <input
          type="checkbox"
          checked={lateOnly}
          onChange={(event) => onLateOnlyChange(event.target.checked)}
        />
        Solo tardías
      </label>
      <div className="flex items-center rounded-md border border-app-border bg-white px-4 py-3 text-sm text-slate-500">
        <RiTeamLine className="mr-2 text-base" />
        {groupFilter === "ALL" ? "Vista completa del proyecto" : activeGroupLabel}
      </div>
    </div>
  );
}
