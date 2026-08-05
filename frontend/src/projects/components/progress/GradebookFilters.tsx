/**
 * @fileoverview Componente de progreso y métricas de proyectos (GradebookFilters).
 *
 * @module GradebookFilters
 */

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
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-app-border-subtle bg-app-bg-subtle px-6 py-4">
      <SearchInput
        className="w-full sm:w-56"
        placeholder="Busca por nombre o correo..."
        value={search}
        onChange={onSearchChange}
        aria-label="Buscar alumno por nombre o correo"
      />
      <select
        className="input-field w-auto min-w-[9rem]"
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
        className="input-field w-auto min-w-[9rem]"
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
        className="input-field w-auto min-w-[9rem]"
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
      <label className="flex items-center gap-2 whitespace-nowrap text-sm text-app-text-secondary">
        <input
          type="checkbox"
          checked={lateOnly}
          onChange={(event) => onLateOnlyChange(event.target.checked)}
        />
        Solo tardías
      </label>
    </div>
  );
}
