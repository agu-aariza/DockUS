/**
 * @fileoverview Panel de configuración de modelos de IA y proveedores (ProviderSelector).
 *
 * @module ProviderSelector
 */

import { LLM_PROVIDER_IDS, type LlmProviderId, type LlmRole, type LlmRoleMappings } from "../../features/llm/types";
import { PROVIDER_METADATA, ROLE_METADATA } from "../llmConfigConstants";

interface ProviderSelectorProps {
  selectedProvider: LlmProviderId;
  roleMappings: LlmRoleMappings;
  onSelect: (_provider: LlmProviderId) => void;
}

export function ProviderSelector({
  selectedProvider,
  roleMappings,
  onSelect,
}: ProviderSelectorProps): JSX.Element {
  return (
    <section className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
      {LLM_PROVIDER_IDS.map((id) => {
        const meta = PROVIDER_METADATA[id];
        const isSelected = selectedProvider === id;
        const activeRoles = (Object.keys(ROLE_METADATA) as LlmRole[]).filter(
          (role) => roleMappings[role] === id,
        );

        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            className={`flex flex-col text-left rounded-xl border p-4 transition-all duration-200 ${
              isSelected
                ? "bg-slate-900 border-primary text-white ring-2 ring-primary/20 shadow-md"
                : "bg-app-surface border-app-border text-app-text-secondary hover:bg-app-bg-subtle hover:-translate-y-0.5"
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white border border-slate-100 p-1.5 shadow-sm">
                <img
                  src={meta.logoUrl}
                  alt={`Logo de ${meta.name}`}
                  className="h-full w-full object-contain"
                />
              </div>
              <span
                className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                  isSelected ? "bg-white/10 text-white" : "bg-app-bg-subtle text-app-text-muted"
                }`}
              >
                {meta.badge}
              </span>
            </div>

            <h4 className={`mt-4 text-sm font-bold ${isSelected ? "text-white" : "text-app-text"}`}>
              {meta.name}
            </h4>
            <p className="mt-0.5 text-xs text-app-text-muted">{meta.subtitle}</p>

            {activeRoles.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-3">
                {activeRoles.map((role) => (
                  <span
                    key={role}
                    className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${
                      isSelected ? "bg-white/10 text-slate-300" : "bg-app-bg-subtle text-app-text-muted"
                    }`}
                  >
                    {ROLE_METADATA[role].label.split(" ")[0]}
                  </span>
                ))}
              </div>
            )}
          </button>
        );
      })}
    </section>
  );
}
