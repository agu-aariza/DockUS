import { useEffect, useMemo, useState } from "react";
import {
  RiArrowDownSLine,
  RiArrowUpSLine,
  RiFileList3Line,
  RiFileTextLine,
  RiInboxArchiveLine,
  RiLineChartLine,
} from "react-icons/ri";

import { builderApi } from "../shared/api/builderApi";
import { EmptyState } from "../shared/components/EmptyState";
import { MetricCard } from "../shared/components/MetricCard";
import { Skeleton, SkeletonCard } from "../shared/components/Skeleton";
import { Button } from "../shared/components/ui/Button";
import type {
  BuildRunEntity,
  DeliveryEntity,
  SessionRecord,
} from "../shared/types";
import { getErrorMessage } from "../shared/utils/errors";
import { useWorkspace } from "../shared/workspace/WorkspaceContext";
import { StudentSurface, StudentSurfaceHeader } from "./components/StudentWorkspaceSurface";
import type { StudentWorkspaceData } from "./hooks/useStudentWorkspaceData";
import { deriveStudentWorkspaceInsights, hasTechnicalReport, resolveStudentRunOutcome } from "./studentWorkspaceInsights";
import { ReportView } from "../shared/components/ReportView";

interface Props {
  session: SessionRecord | null;
  data: StudentWorkspaceData;
}

function GradeTimeline({ deliveries }: { deliveries: DeliveryEntity[] }) {
  const graded = deliveries
    .filter((delivery) => delivery.grade !== null)
    .sort((left, right) => left.version - right.version);

  if (graded.length < 2) {
    return null;
  }

  return (
    <StudentSurface tone="subtle">
      <StudentSurfaceHeader
        eyebrow="Evolucion academica"
        title="Como han cambiado tus notas"
        description="Esta linea temporal te permite ver si tus iteraciones estan convergiendo o si la practica sigue atascada en los mismos bloqueos."
      />
      <div className="mt-6 flex items-end gap-3 overflow-x-auto pb-2">
        {graded.map((delivery, index) => {
          const grade = delivery.grade as number;
          const heightPct = Math.max(12, Math.round((grade / 10) * 100));
          const isLatest = index === graded.length - 1;
          const color =
            grade >= 5
              ? "bg-emerald-400"
              : "bg-rose-400";

          return (
            <div
              key={delivery.id}
              className={`flex min-w-[3.5rem] flex-col items-center ${
                isLatest ? "opacity-100" : "opacity-70"
              }`}
            >
              <span className="text-xs font-semibold text-academic-on-surface">
                {grade.toFixed(1)}
              </span>
              <div className="mt-2 flex h-24 items-end">
                <div
                  className={`w-9 rounded-t-2xl ${color}`}
                  style={{ height: `${heightPct}%` }}
                />
              </div>
              <span className="mt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-academic-outline">
                v{delivery.version}
              </span>
            </div>
          );
        })}
      </div>
    </StudentSurface>
  );
}

function DeliveryStatusBadge({
  delivery,
  summaryRun,
}: {
  delivery: DeliveryEntity;
  summaryRun: BuildRunEntity | null;
}) {
  const outcome = resolveStudentRunOutcome(summaryRun);

  if (delivery.grade !== null) {
    return (
      <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
        Nota {delivery.grade.toFixed(2)}
      </span>
    );
  }

  if (!summaryRun) {
    return (
      <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
        Sin evaluacion
      </span>
    );
  }

  if (outcome === "PASS") {
    return (
      <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
        Apto
      </span>
    );
  }

  if (outcome === "FAIL") {
    return (
      <span className="inline-flex rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
        No apto
      </span>
    );
  }

  if (outcome === "PARTIAL") {
    return (
      <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
        Necesita mejoras
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
      En seguimiento
    </span>
  );
}

function ReportContainer({
  delivery,
  summaryRun,
  defaultOpen = false,
}: {
  delivery: DeliveryEntity;
  summaryRun: BuildRunEntity | null;
  defaultOpen?: boolean;
}) {
  const [run, setRun] = useState<BuildRunEntity | null>(summaryRun);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [hasLoaded, setHasLoaded] = useState(Boolean(summaryRun));

  useEffect(() => {
    if (!isOpen || hasLoaded) {
      return;
    }

    async function loadReport() {
      setLoading(true);
      setError(null);
      try {
        const response = await builderApi.listByDelivery({
          deliveryId: delivery.id,
          limit: 1,
          sortOrder: "DESC",
        });
        if (response.data.length > 0) {
          const fullRun = await builderApi.detail(response.data[0].id);
          setRun(fullRun);
        } else {
          setRun(null);
        }
        setHasLoaded(true);
      } catch (loadError) {
        setError(getErrorMessage(loadError));
      } finally {
        setLoading(false);
      }
    }

    void loadReport();
  }, [delivery.id, hasLoaded, isOpen]);

  const outcome = resolveStudentRunOutcome(run ?? summaryRun);
  const coaching = run?.report?.coaching ?? summaryRun?.report?.coaching ?? null;

  return (
    <div className="overflow-hidden rounded-[2rem] border border-academic-surface-variant bg-white shadow-sm">
      <button
        className="flex w-full items-start justify-between gap-4 px-6 py-5 text-left transition hover:bg-academic-surface-container-lowest"
        onClick={() => setIsOpen((previous) => !previous)}
      >
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-academic-surface-container-lowest text-brand-blue">
            <RiFileTextLine className="text-xl" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-lg font-semibold tracking-tight text-academic-on-surface">
                Entrega v{delivery.version}
              </h4>
              <DeliveryStatusBadge delivery={delivery} summaryRun={summaryRun} />
              {delivery.isLate ? (
                <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                  Fuera de plazo
                </span>
              ) : null}
            </div>
            <div className="mt-2 text-sm text-academic-on-surface-variant">
              {delivery.projectTitle ?? "Proyecto"} ·{" "}
              {new Date(delivery.createdAt).toLocaleString("es-ES")}
            </div>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-academic-on-surface-variant">
              {coaching
                ? coaching.passReadiness === "BLOCKED"
                  ? "El informe detecta bloqueos claros antes de poder pasar. Abre el expediente para ver coaching, evidencia y checklist."
                  : "La entrega ya supera lo esencial y el informe se centra en mejoras de calidad, mantenibilidad y rubric compliance."
                : summaryRun
                  ? outcome === "PASS"
                    ? "La version tiene un resultado tecnico positivo y puedes abrir el informe para revisar evidencia y mejoras opcionales."
                    : "La version ya tiene resultado tecnico asociado. Abre el informe para revisar evidencia, limites y siguientes pasos."
                  : "Todavia no hay un informe tecnico completo asociado a esta entrega."}
            </p>
          </div>
        </div>
        <div className="shrink-0 pt-1 text-slate-400">
          {isOpen ? <RiArrowUpSLine className="text-2xl" /> : <RiArrowDownSLine className="text-2xl" />}
        </div>
      </button>

      {isOpen ? (
        <div className="border-t border-academic-surface-variant bg-academic-surface-container-lowest/50 px-6 py-6">
          <div className="mb-5 grid gap-4 lg:grid-cols-3">
            <article className="rounded-[1.5rem] border border-academic-surface-variant bg-white p-4">
              <div className="ui-label text-academic-outline">Estado de entrega</div>
              <div className="mt-3 text-sm font-semibold text-academic-on-surface">
                {delivery.isLate ? "Registrada fuera de plazo" : "Registrada dentro de plazo"}
              </div>
              <p className="mt-2 text-sm leading-6 text-academic-on-surface-variant">
                {delivery.isLate
                  ? "La version queda guardada como tardia, pero sigue disponible para revision tecnica y academica."
                  : "La version quedo registrada dentro de la ventana prevista para la practica."}
              </p>
            </article>
            <article className="rounded-[1.5rem] border border-academic-surface-variant bg-white p-4">
              <div className="ui-label text-academic-outline">Observaciones docentes</div>
              <p className="mt-3 text-sm leading-6 text-academic-on-surface-variant">
                {delivery.graderNotes ||
                  "Todavia no hay observaciones manuales del profesorado para esta version."}
              </p>
            </article>
            <article className="rounded-[1.5rem] border border-academic-surface-variant bg-white p-4">
              <div className="ui-label text-academic-outline">Trayectoria de la version</div>
              <p className="mt-3 text-sm leading-6 text-academic-on-surface-variant">
                {coaching
                  ? `${coaching.mustFix.length} bloqueo(s), ${coaching.shouldImprove.length} mejora(s) y ${coaching.strengths.length} fortaleza(s) detectadas.`
                  : summaryRun
                    ? "Existe un run tecnico asociado listo para abrir."
                    : "Aun no hay run tecnico completo para esta entrega."}
              </p>
            </article>
          </div>

          {loading ? (
            <div className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-3">
                {[1, 2, 3].map((index) => (
                  <div
                    key={index}
                    className="rounded-[1.5rem] border border-academic-surface-variant bg-white p-4"
                  >
                    <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
                    <div className="mt-4 h-5 w-32 animate-pulse rounded bg-slate-100" />
                    <div className="mt-3 h-4 w-full animate-pulse rounded bg-slate-100" />
                  </div>
                ))}
              </div>
              <SkeletonCard />
            </div>
          ) : error ? (
            <div className="rounded-[1.5rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              Error: {error}
            </div>
          ) : !run ? (
            <div className="rounded-[1.5rem] border border-slate-200 bg-white px-4 py-6 text-center text-sm text-academic-on-surface-variant">
              Esta entrega aun no tiene un informe tecnico disponible.
            </div>
          ) : (
            <ReportView run={run} deliveryVersion={delivery.version} mode="student" />
          )}
        </div>
      ) : null}
    </div>
  );
}

export function StudentReportsSection({ data }: Props): JSX.Element {
  const { selection } = useWorkspace();
  const { deliveries, latestRunByDeliveryId, loading, error } = data;
  const [displayLimit, setDisplayLimit] = useState(10);

  const sortedDeliveries = useMemo(
    () =>
      [...deliveries].sort(
        (left, right) =>
          new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
      ),
    [deliveries],
  );

  const insights = deriveStudentWorkspaceInsights(
    [],
    sortedDeliveries,
    latestRunByDeliveryId,
  );
  const latestGradedDelivery =
    sortedDeliveries.find((delivery) => delivery.grade !== null) ?? null;
  const highlightedDelivery =
    selection.deliveryId
      ? sortedDeliveries.find((delivery) => delivery.id === selection.deliveryId) ?? null
      : sortedDeliveries.find((delivery) =>
          hasTechnicalReport(latestRunByDeliveryId[delivery.id] ?? null),
        ) ?? sortedDeliveries[0] ?? null;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="rounded-[2rem] border border-academic-surface-variant bg-white p-6 shadow-sm">
          <Skeleton type="text" className="h-6 w-52" />
          <Skeleton type="text" className="mt-4 h-4 w-3/4" />
        </div>
        {[1, 2].map((index) => (
          <SkeletonCard key={index} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-800 shadow-sm">
        Error: {error}
      </div>
    );
  }

  if (sortedDeliveries.length === 0) {
    return (
      <EmptyState
        icon={<RiInboxArchiveLine className="text-4xl text-slate-400" />}
        title="Aun no hay informes"
        description="Cuando registres tu primera entrega, esta vista reunira el historial tecnico, las observaciones docentes y el coaching para la siguiente version."
      />
    );
  }

  const remaining = sortedDeliveries.length - displayLimit;

  return (
    <div className="space-y-6">
      <StudentSurface tone="accent">
        <StudentSurfaceHeader
          eyebrow="Archivo tecnico"
          title="Tus informes y expedientes de evaluacion"
          description="Esta vista reune cada entrega con su informe tecnico, evidencia curada y observaciones manuales para que puedas revisar la practica con calma y decidir la siguiente iteracion."
          actions={
            <Button variant="secondary" onClick={() => setDisplayLimit(10)}>
              Reiniciar lista
            </Button>
          }
        />
        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <MetricCard
            label="Entregas"
            value={sortedDeliveries.length}
            helper="Expedientes disponibles"
            icon={<RiInboxArchiveLine />}
            variant="default"
          />
          <MetricCard
            label="Informes listos"
            value={insights.reportsReady}
            helper={`${insights.blockedReports} con bloqueos`}
            icon={<RiFileTextLine />}
            variant={insights.blockedReports > 0 ? "warning" : "success"}
          />
          <MetricCard
            label="Notas oficiales"
            value={insights.officialGrades}
            helper={
              latestGradedDelivery
                ? `Ultima nota ${latestGradedDelivery.grade?.toFixed(2)}`
                : "Todavia sin nota oficial"
            }
            icon={<RiLineChartLine />}
            variant={latestGradedDelivery ? "success" : "default"}
          />
          <MetricCard
            label="Pendientes"
            value={insights.pendingEvaluations}
            helper="Runs aun en seguimiento"
            icon={<RiFileList3Line />}
            variant={insights.pendingEvaluations > 0 ? "info" : "default"}
          />
        </div>
      </StudentSurface>

      {highlightedDelivery ? (
        <StudentSurface>
          <StudentSurfaceHeader
            eyebrow="Informe destacado"
            title={`${highlightedDelivery.projectTitle ?? "Proyecto"} · entrega v${highlightedDelivery.version}`}
            description="Este expediente resume la version que tienes mas activa o la ultima que genero un informe tecnico con contexto suficiente para remediar."
            badge={
              <DeliveryStatusBadge
                delivery={highlightedDelivery}
                summaryRun={latestRunByDeliveryId[highlightedDelivery.id] ?? null}
              />
            }
          />
          <p className="mt-6 text-sm leading-6 text-academic-on-surface-variant">
            Usa el acordeon inferior para abrir el informe completo. El expediente
            combina resultado tecnico, coaching, evidencia observada y feedback
            docente cuando exista.
          </p>
        </StudentSurface>
      ) : null}

      <GradeTimeline deliveries={sortedDeliveries} />

      <div className="space-y-4">
        {sortedDeliveries.slice(0, displayLimit).map((delivery) => (
          <ReportContainer
            key={delivery.id}
            delivery={delivery}
            summaryRun={latestRunByDeliveryId[delivery.id] ?? null}
            defaultOpen={
              selection.deliveryId === delivery.id || sortedDeliveries.length === 1
            }
          />
        ))}
      </div>

      {remaining > 0 ? (
        <Button
          variant="secondary"
          className="w-full justify-center"
          onClick={() => setDisplayLimit((previous) => previous + 10)}
        >
          Mostrar mas ({remaining} restantes)
        </Button>
      ) : null}
    </div>
  );
}
