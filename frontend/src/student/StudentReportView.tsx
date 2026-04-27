import type { BuilderReportEntity, BuildRunEntity, TechnicalFeedbackItem } from "../shared/types";
import { RiCheckLine, RiCloseLine, RiAlertLine, RiQuestionLine, RiLightbulbFlashLine, RiInformationLine } from "react-icons/ri";

interface Props {
  run: BuildRunEntity;
  deliveryVersion?: number;
}

const OUTCOME_CONFIG = {
  PASS: { 
    label: "Apto", 
    icon: RiCheckLine, 
    bg: "bg-emerald-50", 
    border: "border-emerald-200", 
    text: "text-emerald-700",
    meaning: "Tu entrega cumple con todos los requisitos evaluados. ¡Buen trabajo!"
  },
  FAIL: { 
    label: "No Apto", 
    icon: RiCloseLine, 
    bg: "bg-rose-50", 
    border: "border-rose-200", 
    text: "text-rose-700",
    meaning: "La entrega no supera los requisitos mínimos o contiene errores graves que impiden su validación."
  },
  PARTIAL: { 
    label: "Necesita mejoras", 
    icon: RiAlertLine, 
    bg: "bg-amber-50", 
    border: "border-amber-200", 
    text: "text-amber-700",
    meaning: "Tu código funciona parcialmente, pero hemos detectado problemas que debes corregir."
  },
  UNKNOWN: { 
    label: "Sin evaluar", 
    icon: RiQuestionLine, 
    bg: "bg-slate-50", 
    border: "border-slate-200", 
    text: "text-slate-700",
    meaning: "El sistema no pudo determinar el resultado final. Consulta con tu profesor."
  },
};

function FeedbackBlock({ title, items }: { title: string; items?: TechnicalFeedbackItem[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="mt-6">
      <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500 mb-3">{title}</h4>
      <div className="space-y-3">
        {items.map((item, i) => (
          <div key={i} className="rounded-2xl border border-slate-200 bg-white p-4 text-sm">
            <div className="font-semibold text-slate-900">{item.title}</div>
            <div className="mt-1 text-slate-600 leading-relaxed">{item.detail}</div>
            {item.file && (
              <div className="mt-2 text-xs font-mono text-slate-500 bg-slate-50 px-2 py-1 inline-block rounded">
                {item.file}{item.line ? `:${item.line}` : ""}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function StudentReportView({ run, deliveryVersion }: Props): JSX.Element {
  const report: BuilderReportEntity = run.report ?? {};
  
  const outcome = report.overallOutcome ??
    (run.status === "SUCCESS" ? "PASS" : run.status === "FAILED" ? "FAIL" : "UNKNOWN");
  
  const config = OUTCOME_CONFIG[outcome] || OUTCOME_CONFIG.UNKNOWN;
  const Icon = config.icon;

  const techFeedback = report.technicalFeedback || { security: [], architecture: [], quality: [] };
  const hasFeedback = techFeedback.security.length > 0 || techFeedback.architecture.length > 0 || techFeedback.quality.length > 0;

  return (
    <div className="space-y-6">
      {/* Banner de Resultado */}
      <div className={`rounded-3xl border ${config.border} ${config.bg} p-6`}>
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white shadow-sm ${config.text}`}>
            <Icon className="text-3xl" />
          </div>
          <div>
            <div className={`text-xs font-bold uppercase tracking-widest ${config.text}`}>
              Resultado Final
            </div>
            <h3 className={`mt-1 text-3xl font-bold tracking-tight ${config.text}`}>
              {config.label}
            </h3>
            <p className={`mt-2 text-sm font-medium ${config.text} opacity-90`}>
              {config.meaning}
            </p>
          </div>
        </div>
      </div>

      {/* Qué corregir primero (LLM Recommendations) */}
      {report.llmRecommendations && report.llmRecommendations.length > 0 && (
        <div className="rounded-3xl border border-indigo-200 bg-indigo-50 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4 text-indigo-800">
            <RiLightbulbFlashLine className="text-xl" />
            <h3 className="text-sm font-bold uppercase tracking-[0.16em]">
              Siguiente paso recomendado
            </h3>
          </div>
          <ul className="space-y-3 text-sm text-indigo-900 leading-relaxed">
            {report.llmRecommendations.map((rec, i) => (
              <li key={i} className="flex gap-3 bg-white/50 p-3 rounded-xl border border-indigo-100">
                <span className="text-indigo-400 mt-0.5">•</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Qué se ha detectado (Feedback Estructurado) */}
      {hasFeedback && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-bold tracking-tight text-slate-900">
            Puntos de mejora detectados
          </h3>
          <p className="text-sm text-slate-500 mt-1">Revisa estos apartados en tu código antes de enviar la siguiente versión.</p>
          <FeedbackBlock title="Seguridad" items={techFeedback.security} />
          <FeedbackBlock title="Arquitectura" items={techFeedback.architecture} />
          <FeedbackBlock title="Calidad y Estilo" items={techFeedback.quality} />
        </div>
      )}

      {/* Resumen en texto */}
      {report.readableText && (
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
          <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500 mb-4">
            Comentarios adicionales
          </h3>
          <div className="prose prose-sm prose-slate max-w-none font-sans leading-relaxed">
            {report.readableText}
          </div>
        </div>
      )}
      
      {/* Fallback for pipeline warnings hidden under details */}
      {run.warnings && run.warnings.length > 0 && (
        <details className="group rounded-2xl border border-slate-200 bg-white">
          <summary className="cursor-pointer flex items-center gap-2 font-medium text-slate-600 hover:text-slate-900 px-4 py-3">
            <RiInformationLine className="text-slate-400 group-hover:text-indigo-500" />
            Ver registros técnicos del pipeline (Avanzado)
          </summary>
          <div className="border-t border-slate-100 p-4 bg-slate-50 text-xs text-slate-600 font-mono">
            <ul className="space-y-2 list-disc pl-4">
              {run.warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </div>
        </details>
      )}
    </div>
  );
}
