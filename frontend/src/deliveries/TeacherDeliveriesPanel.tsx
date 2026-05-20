import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  RiAlertLine,
  RiArrowRightUpLine,
  RiCodeSSlashLine,
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
  RiCheckFill,
  RiStackFill,
  RiUser3Fill,
} from "react-icons/ri";
import { ReportView } from "../shared/components/ReportView";
import { EmptyState } from "../shared/components/EmptyState";
import { CodePreviewModal } from "../shared/components/CodePreviewModal";
import { TeacherGradingStudio } from "../shared/components/TeacherGradingStudio";
import { useNoticeToasts } from "../shared/toast/useNoticeToasts";
import { useWorkspace } from "../shared/workspace/WorkspaceContext";
import { VisualPicker, type VisualPickerOption } from "../shared/components/ui/VisualPicker";
import { ProjectSelectionHub, type ProjectHubOption } from "../shared/components/ui/ProjectSelectionHub";
import { deliveriesApi } from "../shared/api/services";
import { getErrorMessage } from "../shared/utils/errors";
import { useToast } from "../shared/toast/ToastContext";
import type {
  DeliveryEntity,
  DeliveryStatus,
  ProjectAssignmentEntity,
  SessionRecord,
} from "../shared/types";
import { useDeliveryManagement } from "./hooks/useDeliveryManagement";
import { TeacherReviewSummary } from "./components/TeacherReviewSummary";
import {
  normalizeTeacherDeliveryTab,
} from "./teacherReviewNavigation";
import { MetricCard } from "../shared/components/MetricCard";
import { PageHeader } from "../shared/components/ui/PageHeader";
import { Button } from "../shared/components/ui/Button";
import { Tabs } from "../shared/components/ui/Tabs";

interface TeacherDeliveriesPanelProps {
  session: SessionRecord | null;
}

type DetailTab = "overview" | "grading" | "report";

const STATUS_STYLE: Record<DeliveryStatus, string> = {
  DRAFT: "border-slate-200 bg-slate-100 text-slate-700",
  SUBMITTED: "border-brand-blue/20 bg-brand-blue/5 text-brand-blue-dark",
  IN_REVIEW: "border-brand-gold/20 bg-brand-gold/5 text-brand-gold-dark",
  EVALUATED: "border-brand-blue/20 bg-brand-blue/5 text-brand-blue",
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
      className={`inline-flex items-center rounded-full border px-3 py-1 ui-label ${
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
      className={`group w-full rounded-lg border p-5 text-left transition-all duration-300 relative overflow-hidden ${
        active
          ? "border-academic-primary bg-academic-primary text-academic-on-primary shadow-academic-lg scale-[1.02] z-10"
          : "border-academic-surface-variant bg-white hover:border-academic-outline hover:bg-academic-surface-container-lowest hover:shadow-academic active:scale-95"
      }`}
    >
      <button type="button" onClick={onSelect} className="w-full text-left">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className={`ui-label ${active ? "text-slate-400" : "text-slate-500"}`}>
              v{delivery.version}
            </div>
            <div className="mt-0.5 truncate text-sm font-bold tracking-tight">
              {delivery.studentName}
            </div>
          </div>
          <span
            className={`rounded-full px-3 py-1 ui-label ${
              active
                ? "bg-white/10 text-white/90 border border-white/10"
                : STATUS_STYLE[delivery.status]
            }`}
          >
            {STATUS_TEXT[delivery.status]}
          </span>
        </div>

        <div
          className={`mt-3 space-y-1 ui-label leading-tight ${
            active ? "text-slate-300" : "text-slate-500"
          }`}
        >
          <div className="flex items-center gap-1.5 font-medium">
            <RiTimeLine className="text-sm opacity-60" />
            {formatDateTime(delivery.createdAt)}
          </div>
          <div className="flex items-center gap-1.5">
            <RiFileChartLine className="text-sm opacity-60" />
            <span className={active ? "text-white" : "text-slate-900 font-semibold"}>
              {delivery.grade !== null ? `Nota: ${delivery.grade.toFixed(2)}` : "Nota pendiente"}
            </span>
            <span className="opacity-40">|</span>
            <span className={delivery.isLate ? "text-rose-500 font-medium" : "text-emerald-500 font-medium"}>
              {delivery.isLate ? "Retrasada" : "En plazo"}
            </span>
          </div>
        </div>
      </button>

      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
        <div className={`flex items-center gap-1 ui-label ${active ? "text-slate-400" : "text-slate-400"}`}>
          <RiStackLine className="text-xs" />
          {delivery.remainingDeliveries} disponibles
        </div>
        <button
          type="button"
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 ui-label transition-all ${
            active
              ? "bg-white/10 text-white hover:bg-white/20"
              : "bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200"
          }`}
          onClick={(event) => {
            event.stopPropagation();
            onOpenReport();
          }}
        >
          <RiFileTextLine className="text-sm" />
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
      <span className="font-semibold text-slate-900">{assignment.studentName}</span>
      <span className="mx-2 text-slate-300">|</span>
      <span className="text-slate-500">{assignment.projectTitle}</span>
    </>
  );
}

export function TeacherDeliveriesPanel({
  session,
}: TeacherDeliveriesPanelProps): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const dc = useDeliveryManagement(session, { initialDeliveryId: searchParams.get("deliveryId") });
  const { selection, setProject, setAssignment, setDelivery } = useWorkspace();
  const deliveries = dc.deliveries?.data ?? [];
  const [detailTab, setDetailTab] = useState<DetailTab>(() => 
    normalizeTeacherDeliveryTab(searchParams.get("tab"))
  );
  const [deliverySearch, setDeliverySearch] = useState("");
  const deferredDeliverySearch = useDeferredValue(deliverySearch);
  const { pushToast } = useToast();

  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [previewFiles, setPreviewFiles] = useState<Array<{ path: string; content: string }>>([]);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  const handlePreview = async (deliveryId: string) => {
    setIsLoadingPreview(true);
    setIsPreviewModalOpen(true);
    try {
      const files = await deliveriesApi.preview(deliveryId);
      setPreviewFiles(files);
    } catch (error) {
      pushToast({
        title: "Error previsualizando",
        description: getErrorMessage(error),
        tone: "error",
      });
      setIsPreviewModalOpen(false);
    } finally {
      setIsLoadingPreview(false);
    }
  };

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

  const requestedProjectId = searchParams.get("projectId");
  const requestedAssignmentId = searchParams.get("assignmentId");
  const requestedDeliveryId = searchParams.get("deliveryId");
  const requestedDetailTab = normalizeTeacherDeliveryTab(searchParams.get("tab"));

  const submittedCount = deliveries.filter((delivery) => delivery.status === "SUBMITTED").length;
  const reviewCount = deliveries.filter((delivery) => delivery.status === "IN_REVIEW").length;
  const evaluatedCount = deliveries.filter((delivery) => delivery.status === "EVALUATED").length;

  const openDelivery = (deliveryId: string, tab: DetailTab = "overview") => {
    const delivery = deliveries.find(d => d.id === deliveryId);
    setDelivery(deliveryId, delivery ? `v${delivery.version} - ${delivery.studentName}` : undefined);
    setDetailTab(tab);
    if (tab !== "overview") {
      void dc.handleViewReport(deliveryId);
    }
  };

  // 1. Sync Workspace Selection from URL (Immediate ID sync)
  // We omit selection.* from dependencies to prevent infinite loops when local state updates the URL.
  useEffect(() => {
    if (requestedProjectId && selection.projectId !== requestedProjectId) {
      setProject(requestedProjectId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedProjectId, setProject]);

  useEffect(() => {
    if (requestedAssignmentId && selection.assignmentId !== requestedAssignmentId) {
      setAssignment(requestedAssignmentId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedAssignmentId, setAssignment]);

  useEffect(() => {
    if (requestedDeliveryId && selection.deliveryId !== requestedDeliveryId) {
      setDelivery(requestedDeliveryId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedDeliveryId, setDelivery]);

  // 2. Sync Tab from URL
  useEffect(() => {
    if (requestedDetailTab !== detailTab) {
      setDetailTab(requestedDetailTab);
    }
  }, [requestedDetailTab]);

  // 3. Update Labels and handle report loading once data is available
  useEffect(() => {
    if (!requestedProjectId) return;
    const project = dc.projects.find(p => p.id === requestedProjectId);
    if (project && selection.projectTitle !== project.title) {
      setProject(project.id, project.title);
    }
  }, [dc.projects, requestedProjectId, selection.projectTitle, setProject]);

  useEffect(() => {
    if (!requestedAssignmentId) return;
    const assignment = dc.assignments.find(a => a.id === requestedAssignmentId);
    if (assignment && selection.assignmentLabel !== `${assignment.studentName} · ${assignment.projectTitle}`) {
      setAssignment(assignment.id, `${assignment.studentName} · ${assignment.projectTitle}`);
    }
  }, [dc.assignments, requestedAssignmentId, selection.assignmentLabel, setAssignment]);

  useEffect(() => {
    if (!requestedDeliveryId) return;
    const delivery = deliveries.find(d => d.id === requestedDeliveryId);
    
    // Update label if found
    if (delivery && selection.deliveryLabel !== `v${delivery.version} - ${delivery.studentName}`) {
      setDelivery(requestedDeliveryId, `v${delivery.version} - ${delivery.studentName}`);
    }

    // Trigger report load if needed
    if (delivery && detailTab !== "overview") {
      void dc.handleViewReport(requestedDeliveryId);
    }
  }, [deliveries, requestedDeliveryId, selection.deliveryLabel, setDelivery, detailTab]);

  useEffect(() => {
    if (!dc.selectedProjectId || !dc.selectedAssignmentId) {
      return;
    }

    const next = new URLSearchParams(searchParams);
    next.set("projectId", dc.selectedProjectId);
    next.set("assignmentId", dc.selectedAssignmentId);

    if (dc.selectedDeliveryId) {
      next.set("deliveryId", dc.selectedDeliveryId);
      next.set("tab", detailTab);
    } else if (!requestedDeliveryId) {
      // Only clear if neither local state nor URL has it
      next.delete("deliveryId");
      next.delete("tab");
    }

    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [
    dc.selectedAssignmentId,
    dc.selectedDeliveryId,
    dc.selectedProjectId,
    detailTab,
    requestedDeliveryId,
    searchParams,
    setSearchParams,
  ]);

  const projectOptions: VisualPickerOption[] = useMemo(() => 
    dc.projects.map(p => ({
      id: p.id,
      label: p.title,
      description: p.contextAcademico ? (p.contextAcademico.slice(0, 60) + (p.contextAcademico.length > 60 ? '...' : '')) : 'Sin descripción',
      icon: <RiStackFill />,
      badge: p.status,
    })), [dc.projects]);

  const assignmentOptions: VisualPickerOption[] = useMemo(() => 
    dc.assignments.map(a => ({
      id: a.id,
      label: a.studentName,
      description: a.studentEmail,
      icon: <RiUser3Fill />,
      badge: `${a.deliveryCount} entregas`,
    })), [dc.assignments]);

  const hubProjects: ProjectHubOption[] = useMemo(() => 
    dc.projects.map(p => ({
      id: p.id,
      title: p.title,
      description: p.contextAcademico || "Sin descripción operativa disponible.",
      studentCount: (p as any).assignmentCount || 0,
      activeRuns: 0, 
      status: p.status === 'ACTIVE' ? 'READY' : 'HALTED',
      teachers: (p as any).teachers,
    })), [dc.projects]);

  if (!dc.selectedProjectId) {
    return (
      <div className="space-y-8 animate-fade-in">
        <PageHeader
          title="Gestión de Entregas"
          subtitle="Selecciona un proyecto para revisar la cola de entregas, calificar el trabajo de los alumnos y auditar el código."
          icon={<RiInboxArchiveLine />}
          badge={dc.projects.length.toString()}
        />
        <section className="rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <ProjectSelectionHub
            projects={hubProjects}
            onSelect={(id, label) => setProject(id, label)}
            title="Selecciona un proyecto para comenzar"
            subtitle="Activa un contexto de trabajo para abrir asignaciones, cargar entregas y revisar informes técnicos."
          />
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader 
        title="Gestión de Entregas"
        subtitle="Auditoría de entregas, flujo de calificación técnica y evaluación de evidencia académica."
        icon={<RiInboxArchiveLine />}
        badge={deliveries.length.toString()}
      />

      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)] items-start relative max-w-full">
        <aside className="flex flex-col h-full rounded-lg border border-academic-surface-variant bg-white p-6 shadow-academic overflow-hidden lg:sticky lg:top-32">
          <div className="flex items-center justify-between gap-3 mb-6">
            <div>
              <p className="eyebrow !mb-1">Cola Operativa</p>
              <h3 className="text-xl font-bold tracking-tight text-slate-950">
                Entregas
              </h3>
            </div>
            <Button
              variant="secondary"
              className="h-10 w-10 !p-0 rounded-xl"
              onClick={() => void dc.refreshDeliveries()}
              disabled={!dc.selectedAssignmentId}
            >
              <RiRefreshLine className={dc.loadingDeliveries ? "animate-spin" : ""} />
            </Button>
          </div>

          <div className="mt-5 space-y-5">
            <div>
              <label className="ui-label ml-1">Proyecto</label>
              <VisualPicker
                options={projectOptions}
                value={dc.selectedProjectId}
                onSelect={(id, label) => setProject(id, label)}
                placeholder="Selecciona proyecto..."
                searchPlaceholder="Buscar por título..."
              />
            </div>

            <div>
              <label className="ui-label ml-1">Asignación</label>
              <VisualPicker
                options={assignmentOptions}
                value={dc.selectedAssignmentId}
                onSelect={(id, label) => setAssignment(id, label)}
                placeholder="Selecciona alumno..."
                searchPlaceholder="Buscar por nombre o email..."
                className={!dc.selectedProjectId ? 'opacity-50 grayscale pointer-events-none' : ''}
              />
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

          <div className="mt-6 grid grid-cols-1 gap-4">
            <MetricCard
              label="Visibles"
              value={visibleDeliveries.length}
              helper="Entregas registradas"
              variant="default"
              icon={<RiInboxArchiveLine />}
            />
            <div className="grid grid-cols-2 gap-4">
              <MetricCard
                label="Pendientes"
                value={submittedCount + reviewCount}
                helper="Por revisar"
                variant="warning"
                icon={<RiPulseLine />}
              />
              <MetricCard
                label="Cerradas"
                value={evaluatedCount}
                helper="Calificadas"
                variant="info"
                icon={<RiCheckFill />}
              />
            </div>
          </div>

          <div className="mt-6 border-t border-slate-100 pt-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="eyebrow">
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
            <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 shadow-sm">
              <EmptyState
                icon={<RiInboxArchiveLine className="text-6xl text-slate-200" />}
                title="Terminal de Auditoría de Entregas"
                description="Seleccione un registro de la cola operativa para iniciar el proceso de revisión técnica y académica."
                actionLabel={visibleDeliveries[0] ? "Empezar con la primera entrega" : undefined}
                onAction={
                  visibleDeliveries[0]
                    ? () => openDelivery(visibleDeliveries[0].id, "overview")
                    : undefined
                }
              />
            </div>
          ) : (
            <>
              <article className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
                <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
                  <div className="max-w-3xl">
                    <div className="flex flex-wrap items-center gap-2">
                      <DeliveryStatusPill status={selectedDelivery.status} />
                      <span
                        className={`rounded-full px-3 py-1 ui-label ${
                          selectedDelivery.isLate
                            ? "bg-rose-50 text-rose-700 border border-rose-100"
                            : "bg-emerald-50 text-emerald-700 border border-emerald-100"
                        }`}
                      >
                        {selectedDelivery.isLate ? "Entrega Tardía" : "A Tiempo"}
                      </span>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 ui-label text-slate-500">
                        Versión {selectedDelivery.version}
                      </span>
                    </div>

                    <h3 className="mt-6 text-4xl font-bold tracking-tight text-slate-950">
                      {selectedDelivery.studentName}
                    </h3>
                    <p className="mt-2 text-sm font-medium text-slate-500">
                      {selectedDelivery.projectTitle} · <span className="text-slate-400 font-normal">{selectedDelivery.studentEmail}</span>
                    </p>
                    <p className="mt-6 max-w-2xl text-sm leading-relaxed text-slate-600">
                      {selectedDelivery.notes ||
                        "Sin notas adicionales del alumno para esta entrega."}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Tabs 
                      tabs={[
                        { id: "overview", label: "Resumen", icon: RiStackLine },
                        { id: "grading", label: "Calificación", icon: RiFolderChartLine },
                        { 
                          id: "report", 
                          label: "Informe", 
                          icon: RiFileTextLine,
                        },
                      ]}
                      activeTab={detailTab}
                      onTabChange={(id) => {
                        const nextTab = id as DetailTab;
                        setDetailTab(nextTab);
                        if (nextTab !== "overview" && selectedDelivery) {
                          void dc.handleViewReport(selectedDelivery.id);
                        }
                      }}
                      variant="primary"
                    />
                    
                    <div className="mx-2 h-10 w-px bg-slate-200" />

                    <Button
                      variant="secondary"
                      onClick={() => handlePreview(selectedDelivery.id)}
                    >
                      <RiCodeSSlashLine />
                      Ver código
                    </Button>
                    
                    {dc.canWrite ? (
                      <Button
                        variant="secondary"
                        onClick={() =>
                          dc.navigate(
                            `/runtime?projectId=${selectedDelivery.projectId}&assignmentId=${selectedDelivery.assignmentId}&deliveryId=${selectedDelivery.id}&autorun=1`,
                          )
                        }
                      >
                        <RiArrowRightUpLine />
                        Runtime
                      </Button>
                    ) : null}
                  </div>
                </div>
              </article>

              {detailTab === "overview" && (
                <div className="space-y-6">
                  <section className="grid gap-4 lg:grid-cols-4">
                    <MetricCard
                      label="Recepción"
                      value={formatDateTime(selectedDelivery.createdAt)}
                      helper="Fecha y hora"
                      icon={<RiTimeLine />}
                      variant="default"
                    />
                    <MetricCard
                      label="Histórico"
                      value={`${selectedDelivery.deliveryCount} entregas`}
                      helper="Total acumulado"
                      icon={<RiStackLine />}
                    />
                    <MetricCard
                      label="Disponibles"
                      value={`${selectedDelivery.remainingDeliveries} intentos`}
                      helper="Cupo restante"
                      icon={<RiSparkling2Line />}
                    />
                    <MetricCard
                      label="Nota Oficial"
                      value={selectedDelivery.grade !== null ? selectedDelivery.grade.toFixed(2) : "Pendiente"}
                      helper="Escala 0-10"
                      icon={<RiFileChartLine />}
                      variant={selectedDelivery.grade !== null ? "default" : "warning"}
                    />
                  </section>

                  <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                    <article className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                      <h4 className="eyebrow">
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
                          {dc.selectedDeliveryReviewNotes.manualNotes ||
                            "Aún no hay feedback manual publicado."}
                        </div>
                      </div>
                    </article>

                    <article className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                      <h4 className="eyebrow">
                        Acciones rápidas
                      </h4>
                      <div className="mt-5 space-y-3">
                        <Button
                          variant="secondary"
                          className="w-full justify-start"
                          onClick={() => void dc.refreshDeliveries()}
                        >
                          <RiRefreshLine />
                          Refrescar cola actual
                        </Button>
                        <Button
                          variant="secondary"
                          className="w-full justify-start"
                          onClick={() => {
                            setDetailTab("report");
                            void dc.handleViewReport();
                          }}
                        >
                          <RiFileTextLine />
                          Cargar último informe
                        </Button>
                        <Button
                          variant="secondary"
                          className="w-full justify-start"
                          onClick={() => {
                            setDetailTab("grading");
                            void dc.handleViewReport();
                          }}
                        >
                          <RiFolderChartLine />
                          Editar nota y feedback
                        </Button>
                        {dc.canWrite ? (
                          <Button
                            variant="secondary"
                            className="w-full justify-start"
                            onClick={() =>
                              dc.navigate(
                                `/runtime?projectId=${selectedDelivery.projectId}&assignmentId=${selectedDelivery.assignmentId}&deliveryId=${selectedDelivery.id}&autorun=1`,
                              )
                            }
                          >
                            <RiPulseLine />
                            Abrir runtime contextual
                          </Button>
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
              )}

              {detailTab === "grading" && (
                <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
                  <TeacherReviewSummary
                    delivery={selectedDelivery}
                    latestRun={dc.reportRun}
                    manualGraderNotes={dc.selectedDeliveryReviewNotes.manualNotes}
                    legacyAiEvidence={dc.selectedDeliveryReviewNotes.legacyBlocks}
                  />

                  {dc.canWrite ? (
                    <form
                      className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm"
                      onSubmit={dc.handleGradingUpdate}
                    >
                      <div className="border-b border-slate-100 pb-5">
                        <p className="eyebrow">Calificación</p>
                        <h4 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                          Consolida la nota oficial
                        </h4>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          La nota vive en la entrega, no en el run del builder. Usa este bloque para cerrar evaluación académica y feedback manual.
                        </p>
                      </div>

                      <div className="mt-6 grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
                        <div>
                          <label className="ui-label">Nota oficial</label>
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
                          <label className="ui-label">Observaciones del corrector</label>
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
                        <Button type="submit" variant="primary">
                          Guardar calificación
                        </Button>
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
              )}

              {detailTab === "report" && (
                <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <h4 className="text-lg font-semibold tracking-tight text-slate-950">
                        Dictamen de Evaluación Técnica
                      </h4>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        Se carga desde el último run disponible de la entrega y convive aquí con el contexto de corrección.
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      onClick={() => void dc.handleViewReport(undefined, { force: true })}
                      disabled={!dc.selectedDeliveryId || dc.reportLoading}
                    >
                      <RiFileTextLine />
                      {dc.reportLoading ? "Cargando..." : "Recargar informe"}
                    </Button>
                  </div>

                  <div className="mt-6">
                    <TeacherReviewSummary
                      delivery={selectedDelivery}
                      latestRun={dc.reportRun}
                      manualGraderNotes={dc.selectedDeliveryReviewNotes.manualNotes}
                      legacyAiEvidence={dc.selectedDeliveryReviewNotes.legacyBlocks}
                    />
                  </div>

                  <div className="mt-8">
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
              )}
            </>
          )}
        </section>
      </div>
      {dc.canWrite && selectedDelivery ? (
        <TeacherGradingStudio
          isOpen={isPreviewModalOpen}
          onClose={() => setIsPreviewModalOpen(false)}
          delivery={selectedDelivery}
          reportRun={dc.reportRun}
          files={previewFiles}
          isLoadingFiles={isLoadingPreview}
          onSubmitGrading={async (grade, graderNotes) => {
            try {
              await deliveriesApi.updateGrading(selectedDelivery.id, {
                grade: grade.trim() ? Number(grade) : null,
                graderNotes: graderNotes,
              });
              pushToast({
                title: "Calificación guardada",
                description: "La nota oficial ha sido consolidada.",
                tone: "success",
              });
              setIsPreviewModalOpen(false);
              await dc.refreshDeliveries();
            } catch (error) {
              pushToast({
                title: "Error al calificar",
                description: getErrorMessage(error),
                tone: "error",
              });
            }
          }}
          initialGrade={dc.gradingForm.grade}
          initialNotes={dc.gradingForm.graderNotes}
        />
      ) : (
        <CodePreviewModal
          isOpen={isPreviewModalOpen}
          onClose={() => setIsPreviewModalOpen(false)}
          title="Explorador de Entrega"
          subtitle={`v${selectedDelivery?.version} — ${selectedDelivery?.studentName}`}
          isLoading={isLoadingPreview}
          files={previewFiles}
        />
      )}
    </div>
  );
}
