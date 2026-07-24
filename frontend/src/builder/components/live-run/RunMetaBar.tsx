import type { BuildRunEntity } from "../../../features/builder/types";

interface RunMetaBarProps {
  selectedRun: BuildRunEntity | null;
}

export function RunMetaBar({ selectedRun }: RunMetaBarProps): JSX.Element {
  return (
    <div className="mb-5 flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-app-border pb-3">
      <MetaField
        label="Arquitectura"
        value={selectedRun?.llmAssessment?.structuralType ?? "analizando…"}
        accent
      />
      {selectedRun?.inputTokens !== undefined && selectedRun.inputTokens > 0 && (
        <MetaField
          label="Tokens (In/Out)"
          value={`${selectedRun.inputTokens.toLocaleString()} / ${selectedRun.outputTokens?.toLocaleString() ?? 0}`}
        />
      )}
      {selectedRun?.executionCostUsd !== undefined && selectedRun.executionCostUsd > 0 && (
        <MetaField
          label="Coste (USD)"
          value={`$${selectedRun.executionCostUsd.toFixed(4)}`}
          accent
        />
      )}
    </div>
  );
}

function MetaField({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}): JSX.Element {
  return (
    <div className="flex items-center gap-2">
      <span className="ui-label">{label}</span>
      <span
        className={`font-mono text-xs font-medium ${accent ? "text-accent" : "text-slate-700"}`}
      >
        {value}
      </span>
    </div>
  );
}
