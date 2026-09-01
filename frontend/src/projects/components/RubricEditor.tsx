/**
 * @fileoverview Vista y gestión de proyectos académicos (RubricEditor).
 *
 * @module RubricEditor
 */

import { RiAddLine, RiDeleteBin6Line, RiScales3Line } from "react-icons/ri";
import type { RubricCriterion } from "../../features/projects/types";

interface RubricEditorProps {
  criteria: RubricCriterion[];
  onChange: (criteria: RubricCriterion[]) => void;
  disabled?: boolean;
}

/**
 * Editor de rúbrica ponderada: permite añadir/eliminar criterios, cada uno con
 * un peso porcentual y una descripción opcional. Muestra la suma de pesos y
 * avisa si no llega a 100 (condición que el backend valida al guardar).
 */
export function RubricEditor({
  criteria,
  onChange,
  disabled = false,
}: RubricEditorProps) {
  const total = criteria.reduce(
    (sum, criterion) => sum + (Number.isFinite(criterion.weight) ? criterion.weight : 0),
    0,
  );
  const hasCriteria = criteria.length > 0;
  const isBalanced = total === 100;

  const updateCriterion = (index: number, patch: Partial<RubricCriterion>) => {
    onChange(
      criteria.map((criterion, i) =>
        i === index ? { ...criterion, ...patch } : criterion,
      ),
    );
  };

  const addCriterion = () => {
    onChange([...criteria, { name: "", weight: 0, description: null }]);
  };

  const removeCriterion = (index: number) => {
    onChange(criteria.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        {/* Encabezado de la sección, no de un control único: span, no label. */}
        <span className="label-text flex items-center gap-1.5">
          <RiScales3Line className="text-sm" />
          Rúbrica ponderada
        </span>
        {hasCriteria && (
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
              isBalanced
                ? "bg-success-50 text-success-700 dark:bg-success-950 dark:text-success-400"
                : "bg-warning-50 text-warning-700 dark:bg-warning-950 dark:text-warning-400"
            }`}
          >
            Total: {total}%{isBalanced ? " ✓" : " / 100"}
          </span>
        )}
      </div>

      <p className="text-[11px] text-app-text-muted">
        Define los criterios y su peso (%). El evaluador reparte la nota final de
        forma proporcional. Los pesos deben sumar 100.
      </p>

      {hasCriteria && (
        <div className="space-y-2">
          {criteria.map((criterion, index) => (
            <div
              key={index}
              className="rounded-xl border border-app-border bg-app-bg-subtle/50 p-3 space-y-2"
            >
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  className="flex-1 rounded-lg border border-app-border bg-app-surface px-3 py-2 text-sm text-app-text placeholder:text-app-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
                  placeholder="Nombre del criterio (ej. Correctitud)"
                  value={criterion.name}
                  disabled={disabled}
                  onChange={(e) => updateCriterion(index, { name: e.target.value })}
                />
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className="w-16 rounded-lg border border-app-border bg-app-surface px-2 py-2 text-sm text-app-text text-right focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
                    value={Number.isFinite(criterion.weight) ? criterion.weight : 0}
                    disabled={disabled}
                    onChange={(e) =>
                      updateCriterion(index, {
                        weight: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                      })
                    }
                  />
                  <span className="text-xs font-semibold text-app-text-muted">%</span>
                </div>
                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-app-text-muted transition-colors hover:bg-danger-50 hover:text-danger-600 dark:hover:bg-danger-subtle dark:hover:text-danger-400 disabled:opacity-40"
                  onClick={() => removeCriterion(index)}
                  disabled={disabled}
                  aria-label="Eliminar criterio"
                >
                  <RiDeleteBin6Line />
                </button>
              </div>
              <input
                type="text"
                className="w-full rounded-lg border border-app-border bg-app-surface px-3 py-2 text-xs text-app-text-secondary placeholder:text-app-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
                placeholder="Descripción opcional: qué evaluar en este criterio"
                value={criterion.description ?? ""}
                disabled={disabled}
                onChange={(e) =>
                  updateCriterion(index, {
                    description: e.target.value || null,
                  })
                }
              />
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        className="flex items-center gap-1.5 rounded-lg border border-dashed border-app-border px-3 py-2 text-xs font-semibold text-app-text-secondary transition-colors hover:border-primary hover:text-primary disabled:opacity-40"
        onClick={addCriterion}
        disabled={disabled}
      >
        <RiAddLine />
        Añadir criterio
      </button>
    </div>
  );
}
