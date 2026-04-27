import { useDeferredValue, useEffect, useState } from "react";
import {
  RiAlertLine,
  RiArrowRightUpLine,
  RiFileChartLine,
  RiFileTextLine,
  RiFolderChartLine,
  RiInboxArchiveLine,
  RiLoader4Line,
  RiPulseLine,
  RiRefreshLine,
  RiSearchLine,
  RiSparkling2Line,
  RiStackLine,
  RiTimeLine,
} from "react-icons/ri";
import { ReportView } from "../shared/components/ReportView";
import { EmptyState } from "../shared/components/EmptyState";
import { useNoticeToasts } from "../shared/toast/useNoticeToasts";
import { useWorkspace } from "../shared/workspace/WorkspaceContext";
import type {
  DeliveryEntity,
  DeliveryStatus,
  ProjectAssignmentEntity,
  SessionRecord,
} from "../shared/types";
import { useDeliveryManagement } from "./hooks/useDeliveryManagement";

interface TeacherDeliveriesPanelProps {
  session: SessionRecord | null;
}

type DetailTab = "overview" | "grading" | "report";

const STATUS_STYLE: Record<DeliveryStatus, string> = {
  DRAFT: "border-slate-200 bg-slate-100 text-slate-700",
  SUBMITTED: "border-sky-200 bg-sky-50 text-sky-700",
  IN_REVIEW: "border-amber-200 bg-amber-50 text-amber-700",
  EVALUATED: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

const STATUS_TEXT: Record<DeliveryStatus, string> = {
  DRAFT: "Borrador",
  SUBMITTED: "Entregada",
  IN_REVIEW: "En revisión",
  EVALUATED: "Evaluada",
};

function formatDateTime(value?: string | null): string {
  return value ? new Date(value).toLocaleString("es-ES") : "Sin fecha";
}

function DeliveryStatusPill({ status }: { status: DeliveryStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${
        STATUS_STYLE[status]
      }`}
    >
      {STATUS_TEXT[status]}
    </span>
  );
}

function DeliveryListItem({
  delivery,
  active,
  onSelect,
  onOpenReport,
}: {
  delivery: DeliveryEntity;
  active: boolean;
  onSelect: () => void;
  onOpenReport: () => void;
}) {
  return (
    <article
      className={`w-full rounded-[1.6rem] border px-4 py-4 text-left transition ${
        active
          ? "border-slate-900 bg-slate-900 text-white shadow-sm"
          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
      }`}
    >
      <button type="button" onClick={onSelect} className="w-full text-left">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">
              v{delivery.version} · {delivery.studentEmail}
            </div>
            <div
              className={`mt-1 truncate text-xs ${
                active ? "text-slate-200" : "text-slate-500"
              }`}
            >
              {delivery.projectTitle}
            </div>
          </div>
          <span
            className={`rounded-full border px-2 py-1 text-[11px] font-medium ${
              active
                ? "border-white/20 bg-white/10 text-white"
                : STATUS_STYLE[delivery.status]
            }`}
          >
            {STATUS_TEXT[delivery.status]}
          </span>
        </div>
      </button>

      <div
        className={`mt-4 grid gap-2 text-xs ${
          active ? "text-slate-200" : "text-slate-500"
        }`}
      >
        <div>{delivery.studentName}</div>
        <div>{formatDateTime(delivery.createdAt)}</div>
        <div>
          Nota {delivery.grade !== null ? delivery.grade.toFixed(2) : "pendiente"} ·{" "}
          {delivery.isLate ? "fuera de plazo" : "en plazo"}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] ${
            active ? "bg-white/10 text-white" : "bg-slate-100 text-slate-600"
          }`}
        >
          <RiSparkling2Line />
          {delivery.remainingDeliveries} restantes
        </span>
        <button
          type="button"
          className={`ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ${
            active
              ? "bg-white/10 text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
          onClick={(event) => {
            event.stopPropagation();
            onOpenReport();
          }}
        >
          <RiFileTextLine />
          Informe
        </button>
      </div>
    </article>
  );
}

function AssignmentLabel({ assignment }: { assignment: ProjectAssignmentEntity | undefined }) {
  if (!assignment) {
    return <>Sin asignación</>;
  }

  return (
    <>
      {assignment.studentEmail}
      <span className="text-slate-400"> · </span>
      <span>{assignment.projectTitle}</span>
    </>
  );
}

export function TeacherDeliveriesPanel({
  session,
}: TeacherDeliveriesPanelProps): JSX.Element {
  const dc = useDeliveryManagement(session);
  const { selection, setProject, setAssignment, setDelivery } = useWorkspace();
  const deliveries = dc.deliveries?.data ?? [];
  const [detailTab, setDetailTab] = useState<DetailTab>("overview");
  const [deliverySearch, setDeliverySearch] = useState("");
  const deferredDeliverySearch = useDeferredValue(deliverySearch);

  useNoticeToasts(
    [dc.workspaceNotice, dc.editorNotice, dc.reportNotice],
    "Entregas",
  );

  const normalizedSearch = deferredDeliverySearch.trim().toLowerCase();
  const visibleDeliveries = normalizedSearch
    ? deliveries.filter((delivery) =>
        [
          delivery.studentEmail,
          delivery.studentName,
          delivery.projectTitle,
          delivery.status,
          `v${delivery.version}`,
        ]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(normalizedSearch)),
      )
    : deliveries;

  const selectedAssignment = dc.assignments.find(
    (assignment) => assignment.id === dc.selectedAssignmentId,
  );
  const selectedProject = dc.projects.find(
    (project) => project.id === dc.selectedProjectId,
  );
  const selectedDelivery = dc.selectedDelivery;
  const submittedCount = deliveries.filter((delivery) => delivery.status === "SUBMITTED").length;
  const reviewCount = deliveries.filter((delivery) => delivery.status === "IN_REVIEW").length;
  const evaluatedCount = deliveries.filter((delivery) => delivery.status === "EVALUATED").length;

  const openDelivery = (deliveryId: string, tab: DetailTab = "overview") => {
    const delivery = deliveries.find(d => d.id === deliveryId);
    setDelivery(deliveryId, delivery ? `v${delivery.version} - ${delivery.studentEmail}` : undefined);
    setDetailTab(tab);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="eyebrow">Entregas</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            Cola operativa, calificación y evidencia técnica en un único lienzo.
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
            Esta vista elimina saltos innecesarios: filtras por proyecto, exploras
            entregas y corriges la versión activa sin perder el contexto docente.
          </p>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Master
              </p>
              <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">
                Cola de entregas
              </h3>
            </div>
            <button
              className="btn-secondary"
              onClick={() => void dc.refreshDeliveries()}
              disabled={!dc.selectedAssignmentId}
            >
              <RiRefreshLine />
            </button>
          </div>

          <div className="mt-5 space-y-4">
            <div>
              <label className="label-text">Proyecto</label>
              <select
                className="input-field"
                value={dc.selectedProjectId}
                onChange={(event) => {
                  const project = dc.projects.find(p => p.id === event.target.value);
                  setProject(event.target.value, project?.title);
                }}
              >
                <option value="">Selecciona un proyecto</option>
                {dc.projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label-text">Asignación</label>
              <select
                className="input-field"
                value={dc.selectedAssignmentId}
                onChange={(event) => {
                  const assignment = dc.assignments.find(a => a.id === event.target.value);
                  setAssignment(event.target.value, assignment?.studentEmail);
                }}
              >
                <option value="">Selecciona una asignación</option>
                {dc.assignments.map((assignment) => (
                  <option key={assignment.id} value={assignment.id}>
                    {assignment.studentEmail}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative">
              <RiSearchLine className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="input-field pl-11"
                value={deliverySearch}
                onChange={(event) => setDeliverySearch(event.target.value)}
                placeholder="Buscar por alumno, proyecto o estado"
              />
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            {[
              {
                label: "Visibles",
                value: visibleDeliveries.length,
                helper: "Entrega(s) cargadas",
                icon: <RiStackLine className="text-lg" />,
              },
              {
                label: "En revisión",
                value: reviewCount,
                helper: "Trabajo activo",
                icon: <RiPulseLine className="text-lg" />,
              },
              {
                label: "Evaluadas",
                value: evaluatedCount,
                helper: "Con cierre técnico",
                icon: <RiFileChartLine className="text-lg" />,
              },
            ].map((metric) => (
              <article
                key={metric.label}
                className="rounded-[1.6rem] border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex items-center justify-between gap-3 text-slate-400">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em]">
                    {metric.label}
                  </span>
                  {metric.icon}
                </div>
                <div className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
                  {metric.value}
                </div>
                <p className="mt-1 text-xs text-slate-500">{metric.helper}</p>
              </article>
            ))}
          </div>

          <div className="mt-6 border-t border-slate-100 pt-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Selección actual
                </p>
                <div className="mt-2 text-sm font-medium text-slate-900">
                  <AssignmentLabel assignment={selectedAssignment} />
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {visibleDeliveries.length === 0 ? (
                <div className="rounded-[1.6rem] border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                  {!dc.selectedAssignmentId
                    ? "Selecciona una asignación para cargar entregas."
                    : "No hay entregas con los filtros actuales."}
                </div>
              ) : (
                visibleDeliveries.map((delivery) => (
                  <DeliveryListItem
                    key={delivery.id}
                    delivery={delivery}
                    active={dc.selectedDeliveryId === delivery.id}
                    onSelect={() => openDelivery(delivery.id, "overview")}
                    onOpenReport={() => {
                      openDelivery(delivery.id, "report");
                      void dc.handleViewReport(delivery.id);
                    }}
                  />
                ))
              )}
            </div>
          </div>
        </aside>

        <section className="space-y-6">
          {!selectedDelivery ? (
            <div className="rounded-[2rem] border border-slate-200 bg-white p-10 shadow-sm">
              <EmptyState
                icon={<RiInboxArchiveLine className="text-5xl text-slate-300" />}
                title="Selecciona una entrega para empezar a corregir"
                description="La parte derecha se convierte en un espacio de revisión real solo cuando eliges una entrega del rail izquierdo."
                actionLabel={visibleDeliveries[0] ? "Abrir primera entrega" : undefined}
                onAction={
                  visibleDeliveries[0]
                    ? () => openDelivery(visibleDeliveries[0].id, "overview")
                    : undefined
                }
              />
            </div>
          ) : (
            <>
              <article className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-sm">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                  <div className="max-w-3xl">
                    <div className="flex flex-wrap items-center gap-3">
                      <DeliveryStatusPill status={selectedDelivery.status} />
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          selectedDelivery.isLate
                            ? "bg-amber-50 text-amber-700"
                            : "bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {selectedDelivery.isLate ? "Fuera de plazo" : "En plazo"}
                      </span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                        v{selectedDelivery.version}
                      </span>
                    </div>

                    <h3 className="mt-5 text-3xl font-semibold tracking-tight text-slate-950">
                      {selectedDelivery.studentName}
                    </h3>
                    <p className="mt-2 text-sm text-slate-500">
                      {selectedDelivery.studentEmail} · {selectedDelivery.projectTitle}
                    </p>
                    <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600">
                      {selectedDelivery.notes ||
                        "Esta entrega no tiene notas manuales asociadas. Usa la pestaña de grading para dejar feedback oficial y la de report para revisar la evidencia técnica del builder."}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      className="btn-primary"
                      onClick={() => setDetailTab("grading")}
                    >
                      <RiFolderChartLine />
                      Calificar
                    </button>
                    <button
                      className="btn-secondary"
                      onClick={() => {
                        setDetailTab("report");
                        void dc.handleViewReport();
                      }}
                    >
                      <RiFileTextLine />
                      Ver informe
                    </button>
                    {dc.canWrite ? (
                      <button
                        className="btn-secondary"
                        onClick={() =>
                          dc.navigate(
                            `/runtime?projectId=${selectedDelivery.projectId}&assignmentId=${selectedDelivery.assignmentId}&deliveryId=${selectedDelivery.id}&autorun=1`,
                          )
                        }
                      >
                        <RiArrowRightUpLine />
                        Runtime
                      </button>
                    ) : null}
                  </div>
                </div>
              </article>

              <div className="flex flex-wrap gap-2">
                {[
                  { id: "overview", label: "Overview", icon: <RiStackLine /> },
                  { id: "grading", label: "Grading", icon: <RiFolderChartLine /> },
                  { id: "report", label: "Report", icon: <RiFileTextLine /> },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
                      detailTab === tab.id
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                    onClick={() => setDetailTab(tab.id as DetailTab)}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </div>

              {detailTab === "overview" ? (
                <div className="space-y-6">
                  <section className="grid gap-4 lg:grid-cols-4">
                    {[
                      {
                        label: "Creada",
                        value: formatDateTime(selectedDelivery.createdAt),
                        helper: "Momento de recepción",
                        icon: <RiTimeLine className="text-lg" />,
                      },
                      {
                        label: "Entregas previas",
                        value: selectedDelivery.deliveryCount,
                        helper: "Histórico del alumno en este proyecto",
                        icon: <RiStackLine className="text-lg" />,
                      },
                      {
                        label: "Restantes",
                        value: selectedDelivery.remainingDeliveries,
                        helper: "Intentos aún disponibles",
                        icon: <RiSparkling2Line className="text-lg" />,
                      },
                      {
                        label: "Nota oficial",
                        value:
                          selectedDelivery.grade !== null
                            ? selectedDelivery.grade.toFixed(2)
                            : "Pendiente",
                        helper: "Consolidada por el profesorado",
                        icon: <RiFileChartLine className="text-lg" />,
                      },
                    ].map((metric) => (
                      <article
                        key={metric.label}
                        className="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-sm"
                      >
                        <div className="flex items-center justify-between gap-3 text-slate-400">
                          <span className="text-xs font-semibold uppercase tracking-[0.16em]">
                            {metric.label}
                          </span>
                          {metric.icon}
                        </div>
                        <div className="mt-3 text-lg font-semibold tracking-tight text-slate-950">
                          {metric.value}
                        </div>
                        <p className="mt-2 text-sm leading-5 text-slate-500">{metric.helper}</p>
                      </article>
                    ))}
                  </section>

                  <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                    <article className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                      <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Contexto de revisión
                      </h4>
                      <div className="mt-5 space-y-4 text-sm leading-6 text-slate-600">
                        <div>
                          <strong className="text-slate-900">Proyecto:</strong>{" "}
                          {selectedProject?.title || selectedDelivery.projectTitle}
                        </div>
                        <div>
                          <strong className="text-slate-900">Asignación:</strong>{" "}
                          <AssignmentLabel assignment={selectedAssignment} />
                        </div>
                        <div>
                          <strong className="text-slate-900">Requisito mínimo:</strong>{" "}
                          {selectedDelivery.minimumRequirementMet
                            ? "Cumplido"
                            : "Todavía pendiente"}
                        </div>
                        <div>
                          <strong className="text-slate-900">Notas del alumno:</strong>{" "}
                          {selectedDelivery.notes || "Sin observaciones del alumno."}
                        </div>
                        <div>
                          <strong className="text-slate-900">Observaciones docentes:</strong>{" "}
                          {selectedDelivery.graderNotes || "Aún no hay feedback manual publicado."}
                        </div>
                      </div>
                    </article>

                    <article className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                      <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Acciones rápidas
                      </h4>
                      <div className="mt-5 space-y-3">
                        <button
                          className="btn-secondary w-full justify-start"
                          onClick={() => void dc.refreshDeliveries()}
                        >
                          <RiRefreshLine />
                          Refrescar cola actual
                        </button>
                        <button
                          className="btn-secondary w-full justify-start"
                          onClick={() => {
                            setDetailTab("report");
                            void dc.handleViewReport();
                          }}
                        >
                          <RiFileTextLine />
                          Cargar último informe
                        </button>
                        <button
                          className="btn-secondary w-full justify-start"
                          onClick={() => setDetailTab("grading")}
                        >
                          <RiFolderChartLine />
                          Editar nota y feedback
                        </button>
                        {dc.canWrite ? (
                          <button
                            className="btn-secondary w-full justify-start"
                            onClick={() =>
                              dc.navigate(
                                `/runtime?projectId=${selectedDelivery.projectId}&assignmentId=${selectedDelivery.assignmentId}&deliveryId=${selectedDelivery.id}&autorun=1`,
                              )
                            }
                          >
                            <RiPulseLine />
                            Abrir runtime contextual
                          </button>
                        ) : null}
                      </div>

                      <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                        <div>
                          <strong className="text-slate-900">Estado operativo:</strong>{" "}
                          {selectedDelivery.status === "SUBMITTED"
                            ? "Pendiente de corrección"
                            : selectedDelivery.status === "IN_REVIEW"
                              ? "Builder o revisión en curso"
                              : selectedDelivery.status === "EVALUATED"
                                ? "Cierre técnico disponible"
                                : "Borrador aún no entregado"}
                        </div>
                        <div className="mt-2">
                          <strong className="text-slate-900">Prioridad:</strong>{" "}
                          {selectedDelivery.isLate
                            ? "Conviene revisar el impacto de la entrega tardía."
                            : selectedDelivery.grade === null &&
                                selectedDelivery.status === "EVALUATED"
                              ? "Falta consolidar nota oficial."
                              : "Flujo estable."}
                        </div>
                      </div>
                    </article>
                  </section>
                </div>
              ) : null}

              {detailTab === "grading" ? (
                <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
                  <article className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                    <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Estado actual
                    </h4>
                    <div className="mt-5 space-y-4 text-sm leading-6 text-slate-600">
                      <div>
                        <strong className="text-slate-900">Alumno:</strong>{" "}
                        {selectedDelivery.studentEmail}
                      </div>
                      <div>
                        <strong className="text-slate-900">Versión:</strong> v{selectedDelivery.version}
                      </div>
                      <div>
                        <strong className="text-slate-900">Builder:</strong>{" "}
                        {selectedDelivery.status === "EVALUATED"
                          ? "La entrega ya tiene evaluación técnica disponible."
                          : "Todavía no hay cierre técnico completo."}
                      </div>
                      <div>
                        <strong className="text-slate-900">Nota actual:</strong>{" "}
                        {selectedDelivery.grade !== null
                          ? selectedDelivery.grade.toFixed(2)
                          : "Sin nota oficial"}
                      </div>
                      <div>
                        <strong className="text-slate-900">Feedback actual:</strong>{" "}
                        {selectedDelivery.graderNotes ||
                          "Todavía no has dejado observaciones docentes."}
                      </div>
                    </div>
                  </article>

                  {dc.canWrite ? (
                    <form
                      className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm"
                      onSubmit={dc.handleGradingUpdate}
                    >
                      <div className="border-b border-slate-100 pb-5">
                        <p className="eyebrow">Grading</p>
                        <h4 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                          Consolida la nota oficial
                        </h4>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          La nota vive en la entrega, no en el run del builder. Usa este bloque para cerrar evaluación académica y feedback manual.
                        </p>
                      </div>

                      <div className="mt-6 grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
                        <div>
                          <label className="label-text">Nota oficial</label>
                          <input
                            type="number"
                            min="0"
                            max="10"
                            step="0.01"
                            className="input-field"
                            value={dc.gradingForm.grade}
                            onChange={(event) =>
                              dc.setGradingForm((current) => ({
                                ...current,
                                grade: event.target.value,
                              }))
                            }
                          />
                        </div>
                        <div>
                          <label className="label-text">Observaciones del corrector</label>
                          <textarea
                            className="input-field min-h-[180px]"
                            value={dc.gradingForm.graderNotes}
                            onChange={(event) =>
                              dc.setGradingForm((current) => ({
                                ...current,
                                graderNotes: event.target.value,
                              }))
                            }
                            placeholder="Comentarios manuales para el alumno"
                          />
                        </div>
                      </div>

                      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
                        <div className="text-sm text-slate-500">
                          {selectedDelivery.grade === null
                            ? "Aún no existe una nota oficial publicada."
                            : "La entrega ya tenía nota; este guardado la reemplazará."}
                        </div>
                        <button type="submit" className="btn-primary">
                          Guardar calificación
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                      <EmptyState
                        icon={<RiAlertLine className="text-4xl text-slate-300" />}
                        title="Solo lectura"
                        description="Tu rol actual no permite modificar la calificación oficial de esta entrega."
                      />
                    </div>
                  )}
                </section>
              ) : null}

              {detailTab === "report" ? (
                <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <h4 className="text-lg font-semibold tracking-tight text-slate-950">
                        Informe de evaluación
                      </h4>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        Se carga desde el último run disponible de la entrega y convive aquí con el contexto de corrección.
                      </p>
                    </div>
                    <button
                      className="btn-secondary"
                      onClick={() => void dc.handleViewReport()}
                      disabled={!dc.selectedDeliveryId || dc.reportLoading}
                    >
                      <RiFileTextLine />
                      {dc.reportLoading ? "Cargando..." : "Recargar informe"}
                    </button>
                  </div>

                  <div className="mt-6">
                    {dc.reportLoading ? (
                      <div className="flex justify-center py-16 text-slate-400">
                        <RiLoader4Line className="animate-spin text-2xl" />
                      </div>
                    ) : dc.reportRun ? (
                      <ReportView
                        run={dc.reportRun}
                        deliveryVersion={dc.reportDelivery?.version}
                        mode="teacher"
                      />
                    ) : (
                      <EmptyState
                        icon={<RiFileTextLine className="text-4xl text-slate-300" />}
                        title="Ningún informe cargado"
                        description="Pulsa en 'Recargar informe' para traer el último run asociado a esta entrega."
                      />
                    )}
                  </div>
                </section>
              ) : null}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
