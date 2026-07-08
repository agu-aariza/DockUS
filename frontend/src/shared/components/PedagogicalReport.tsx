import type {
  BuilderPedagogicalNarrativeItem,
  PedagogicalNarrativeKind,
} from "../../features/builder/types";
import {
  RiCheckLine,
  RiCloseLine,
  RiFlagLine,
  RiLightbulbFlashLine,
  RiMapPinLine,
  RiRoadMapLine,
} from "react-icons/ri";
import { MarkdownContent } from "./MarkdownContent";
import { ReportCard } from "./report/ReportCard";

interface PedagogicalReportProps {
  items: BuilderPedagogicalNarrativeItem[];
  learningObjective?: string | null;
}

const KIND_CONFIG: Record<
  PedagogicalNarrativeKind,
  {
    label: string;
    icon: typeof RiCheckLine;
    border: string;
    iconBg: string;
  }
> = {
  success: {
    label: "Logro",
    icon: RiCheckLine,
    border: "border-l-emerald-500",
    iconBg: "bg-emerald-50 text-emerald-600",
  },
  gap: {
    label: "Brecha",
    icon: RiCloseLine,
    border: "border-l-rose-500",
    iconBg: "bg-rose-50 text-rose-600",
  },
  bridge: {
    label: "Puente de aprendizaje",
    icon: RiLightbulbFlashLine,
    border: "border-l-sky-500",
    iconBg: "bg-sky-50 text-sky-600",
  },
  action: {
    label: "Próximo paso",
    icon: RiRoadMapLine,
    border: "border-l-amber-500",
    iconBg: "bg-amber-50 text-amber-600",
  },
};

function StepNumber({ index }: { index: number }): JSX.Element {
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
      {index + 1}
    </span>
  );
}

export function PedagogicalReport({
  items,
  learningObjective,
}: PedagogicalReportProps): JSX.Element | null {
  if (!items?.length) {
    return null;
  }

  return (
    <ReportCard
      tone="default"
      icon={RiMapPinLine}
      title="Narrativa pedagógica"
      description="Tu recorrido en esta entrega"
    >
      {learningObjective ? (
        <div className="mb-6 flex items-start gap-2 rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 text-sm text-indigo-900">
          <RiFlagLine className="mt-0.5 shrink-0 text-indigo-600" aria-hidden="true" />
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-700">
              Objetivo de aprendizaje
            </span>
            <p className="mt-1 font-medium">{learningObjective}</p>
          </div>
        </div>
      ) : null}

      <div className="space-y-4">
        {items.map((item, index) => {
          const config = KIND_CONFIG[item.kind];
          const Icon = config.icon;
          return (
            <article
              key={`${item.kind}-${index}`}
              className={`relative rounded-xl border border-app-border border-l-4 bg-white p-5 ${config.border}`}
            >
              <div className="flex items-start gap-4">
                <StepNumber index={index} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <div
                      className={`flex h-6 w-6 items-center justify-center rounded-lg ${config.iconBg}`}
                    >
                      <Icon className="text-sm" aria-hidden="true" />
                    </div>
                    <h4 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                      {config.label}
                    </h4>
                  </div>
                  <div className="mt-2 text-sm leading-6 text-slate-600">
                    <MarkdownContent content={item.content} />
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </ReportCard>
  );
}
