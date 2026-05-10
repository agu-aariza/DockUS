import { useState } from "react";
import {
  RiAlertLine,
  RiArrowLeftLine,
  RiArrowRightLine,
  RiCheckLine,
  RiCheckboxCircleLine,
  RiFileList3Line,
  RiFileZipLine,
  RiFolderOpenLine,
  RiInboxArchiveLine,
  RiLoader4Line,
  RiRocketLine,
  RiUploadCloud2Line,
} from "react-icons/ri";

import { builderApi } from "../shared/api/builderApi";
import { deliveriesApi, storageApi } from "../shared/api/services";
import { MetricCard } from "../shared/components/MetricCard";
import { EmptyState } from "../shared/components/EmptyState";
import { Button } from "../shared/components/ui/Button";
import type { SessionRecord } from "../shared/types";
import { getErrorMessage } from "../shared/utils/errors";
import { computeSha256Hex } from "../shared/utils/hash";
import { useWorkspace } from "../shared/workspace/WorkspaceContext";
import { StudentKeyValueList, StudentSurface, StudentSurfaceHeader } from "./components/StudentWorkspaceSurface";
import {
  describeAssignmentTimeline,
  formatAssignmentDate,
  pickPrimaryAssignment,
} from "./deadlineUtils";
import type { StudentWorkspaceData } from "./hooks/useStudentWorkspaceData";
import { SubmissionCoachingPreview } from "./SubmissionCoachingPreview";
import {
  deriveStudentWorkflowState,
  describeStudentWorkflowState,
} from "./studentWorkflowState";
import { deriveStudentWorkspaceInsights } from "./studentWorkspaceInsights";

interface Props {
  session: SessionRecord | null;
  data: StudentWorkspaceData;
  onNavigate: (tab: any) => void;
}

type Step = 1 | 2 | 3 | 4;

function getStepState(currentStep: Step, targetStep: number): "complete" | "active" | "idle" {
  if (currentStep > targetStep) {
    return "complete";
  }
  if (currentStep === targetStep) {
    return "active";
  }
  return "idle";
}

export function StudentSubmissionFlow({
  data,
  onNavigate,
}: Props): JSX.Element {
  const { selection, setDelivery, setProject, setAssignment } = useWorkspace();
  const { assignments, deliveries, latestRunByDeliveryId, refresh } = data;

  const initialAssignment =
    pickPrimaryAssignment(
      assignments,
      selection.assignmentId,
      selection.projectId,
    ) ?? assignments[0] ?? null;

  const [step, setStep] = useState<Step>(1);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState(
    initialAssignment?.id ?? "",
  );
  const [file, setFile] = useState<File | null>(null);
  const [fileSizeError, setFileSizeError] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<"idle" | "uploading" | "success" | "error">(
    "idle",
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [createdVersion, setCreatedVersion] = useState<number | null>(null);
  const [createdDeliveryId, setCreatedDeliveryId] = useState<string | null>(null);
  const [buildLaunched, setBuildLaunched] = useState(false);
  const [buildLaunching, setBuildLaunching] = useState(false);
  const [buildError, setBuildError] = useState<string | null>(null);

  const activeAssignment =
    assignments.find((assignment) => assignment.id === selectedAssignmentId) ?? null;
  const latestAssignmentDelivery =
    deliveries.find((delivery) => delivery.assignmentId === selectedAssignmentId) ??
    null;
  const latestAssignmentRun = latestAssignmentDelivery
    ? latestRunByDeliveryId[latestAssignmentDelivery.id] ?? null
    : null;
  const noAssignments = assignments.length === 0;
  const noRemainingDeliveries =
    activeAssignment !== null && activeAssignment.remainingDeliveries <= 0;
  const now = Date.now();
  const notYetOpen = Boolean(
    activeAssignment?.opensAt && new Date(activeAssignment.opensAt).getTime() > now,
  );
  const afterDeadline = Boolean(
    activeAssignment?.closesAt && new Date(activeAssignment.closesAt).getTime() < now,
  );
  const activeTimeline = activeAssignment
    ? describeAssignmentTimeline(activeAssignment, now)
    : null;
  const workflow = describeStudentWorkflowState(
    deriveStudentWorkflowState({
      assignment: activeAssignment,
      delivery: latestAssignmentDelivery,
      latestRun: latestAssignmentRun,
      now,
    }),
    {
      isLate: latestAssignmentDelivery?.isLate,
      projectTitle: activeAssignment?.projectTitle,
    },
  );

  const insights = deriveStudentWorkspaceInsights(
    activeAssignment ? [activeAssignment] : [],
    latestAssignmentDelivery ? [latestAssignmentDelivery] : [],
    latestRunByDeliveryId,
  );

  const canContinueFromStep1 =
    Boolean(selectedAssignmentId) &&
    !noAssignments &&
    !noRemainingDeliveries &&
    !notYetOpen;

  const handleNextStep = () => {
    if (step === 1 && canContinueFromStep1) {
      setStep(2);
      return;
    }

    if (step === 2 && file) {
      setStep(3);
    }
  };

  const handleFileSelection = (selectedFile: File | null) => {
    if (selectedFile && selectedFile.size > 50 * 1024 * 1024) {
      setFileSizeError(true);
      setFile(null);
      return;
    }

    setFileSizeError(false);
    setFile(selectedFile);
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
    handleFileSelection(event.dataTransfer.files?.[0] ?? null);
  };

  const handleSubmit = async () => {
    if (!selectedAssignmentId || !file) {
      return;
    }

    setStatus("uploading");
    setErrorMessage("");

    try {
      const delivery = await deliveriesApi.create({
        assignmentId: selectedAssignmentId,
      });

      const hash = await computeSha256Hex(file);

      await storageApi.upload({
        deliveryId: delivery.id,
        logicalName: file.name,
        logicalPath: `student-uploads/${file.name}`,
        contentType: file.type || "application/octet-stream",
        hash,
        sizeBytes: file.size,
        file,
      });

      if (activeAssignment) {
        setProject(activeAssignment.projectId, activeAssignment.projectTitle);
        setAssignment(activeAssignment.id, activeAssignment.projectTitle);
      }
      setDelivery(delivery.id, `v${delivery.version}`);
      setCreatedVersion(delivery.version);
      setCreatedDeliveryId(delivery.id);

      await refresh();
      setStatus("success");
      setStep(4);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setStatus("error");
    }
  };

  const handleLaunchBuilder = async () => {
    if (!createdDeliveryId) {
      return;
    }

    setBuildLaunching(true);
    setBuildError(null);

    try {
      await builderApi.runForDelivery(createdDeliveryId);
      setBuildLaunched(true);
    } catch (error) {
      setBuildError(getErrorMessage(error));
    } finally {
      setBuildLaunching(false);
    }
  };

  if (noAssignments) {
    return (
      <div className="space-y-6">
        <StudentSurface tone="accent">
          <StudentSurfaceHeader
            eyebrow="Nueva entrega"
            title="Aun no tienes practicas disponibles"
            description="En cuanto el profesorado te asigne una practica, desde aqui podras preparar la siguiente version y seguir el circuito completo de remediacion."
            actions={
              <Button variant="secondary" onClick={() => onNavigate("proyectos")}>
                Ver proyectos
              </Button>
            }
          />
        </StudentSurface>
        <EmptyState
          icon={<RiFolderOpenLine className="text-4xl text-slate-400" />}
          title="Sin convocatorias activas"
          description="No hay ninguna practica disponible para subir en este momento. Revisa el resumen o espera a nuevas asignaciones."
        />
      </div>
    );
  }

  if (step === 4) {
    return (
      <div className="space-y-6">
        <StudentSurface tone="accent">
          <StudentSurfaceHeader
            eyebrow="Entrega registrada"
            title={`Version v${createdVersion ?? "?"} enviada correctamente`}
            description={`Tu archivo ${file?.name ?? ""} ya forma parte del historial de la practica. Ahora puedes dejar lanzada la evaluacion tecnica o volver al workspace para seguirla despues.`}
            badge={
              <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                Entrega confirmada
              </span>
            }
          />
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <MetricCard
              label="Practica"
              value={activeAssignment?.projectTitle ?? "Proyecto"}
              helper="Contexto activo"
              icon={<RiFolderOpenLine />}
              variant="default"
            />
            <MetricCard
              label="Version"
              value={`v${createdVersion ?? "?"}`}
              helper="Nueva entrega registrada"
              icon={<RiUploadCloud2Line />}
              variant="success"
            />
            <MetricCard
              label="Intentos restantes"
              value={Math.max(0, (activeAssignment?.remainingDeliveries ?? 1) - 1)}
              helper="Despues de esta subida"
              icon={<RiInboxArchiveLine />}
              variant="info"
            />
          </div>
        </StudentSurface>

        <div className="grid gap-6 xl:grid-cols-[1.05fr,1.35fr]">
          <StudentSurface>
            <StudentSurfaceHeader
              eyebrow="Siguiente decision"
              title="Quieres lanzar la evaluacion automatica ahora?"
              description="Si la ejecutas ahora, DockUS analizara el codigo, intentara construirlo y te devolvera un informe tecnico con evidencia y coaching para la siguiente version."
            />

            {buildLaunched ? (
              <div className="mt-6 rounded-[1.5rem] border border-emerald-200 bg-emerald-50 p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-emerald-600 shadow-sm">
                    <RiCheckboxCircleLine className="text-xl" />
                  </div>
                  <div>
                    <div className="font-semibold text-emerald-900">
                      Evaluacion ya lanzada
                    </div>
                    <p className="mt-2 text-sm leading-6 text-emerald-800">
                      El run tecnico ya esta en marcha. Puedes seguirlo desde informes
                      o volver al resumen para esperar el resultado.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                <div className="rounded-[1.5rem] border border-academic-surface-variant bg-academic-surface-container-lowest p-5 text-sm leading-6 text-academic-on-surface-variant">
                  Lanzar el builder ahora te ahorra contexto perdido: el siguiente
                  informe quedara asociado a esta version y podras usarlo para reenviar
                  con criterio si aun te quedan intentos.
                </div>

                {buildError ? (
                  <div className="rounded-[1.5rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                    {buildError}
                  </div>
                ) : null}

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    variant="primary"
                    disabled={buildLaunching}
                    onClick={handleLaunchBuilder}
                  >
                    {buildLaunching ? (
                      <>
                        <RiLoader4Line className="animate-spin" />
                        Lanzando evaluacion
                      </>
                    ) : (
                      <>
                        <RiRocketLine />
                        Evaluar ahora
                      </>
                    )}
                  </Button>
                  <Button variant="secondary" onClick={() => onNavigate("informes")}>
                    Seguir despues
                  </Button>
                </div>
              </div>
            )}
          </StudentSurface>

          <StudentSurface tone="subtle">
            <StudentSurfaceHeader
              eyebrow="Navegacion rapida"
              title="Sigue trabajando desde el workspace"
              description="Ya no necesitas rehacer el contexto: la practica, la version y el historial quedan enlazados para las siguientes superficies."
            />
            <StudentKeyValueList
              className="mt-6"
              items={[
                {
                  label: "Historial",
                  value: "Revisar el registro completo de tus versiones",
                },
                {
                  label: "Informes",
                  value: buildLaunched
                    ? "Esperar el nuevo informe tecnico"
                    : "Consultar informes anteriores o seguir mas tarde",
                },
                {
                  label: "Resumen",
                  value: "Volver al command center del alumno",
                },
              ]}
            />
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button variant="secondary" onClick={() => onNavigate("entregas")}>
                Ver mis entregas
              </Button>
              <Button variant="primary" onClick={() => onNavigate("resumen")}>
                Ir al resumen
              </Button>
            </div>
          </StudentSurface>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <StudentSurface tone="accent">
        <StudentSurfaceHeader
          eyebrow="Nueva version"
          title="Prepara la siguiente entrega desde un unico flujo"
          description="Selecciona la practica, revisa el estado real de la convocatoria y sube el archivo con el mismo contexto que luego veras en informes y entregas."
          actions={
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button variant="secondary" onClick={() => onNavigate("entregas")}>
                Ver historial
              </Button>
              <Button variant="primary" onClick={() => onNavigate("informes")}>
                Consultar informes
              </Button>
            </div>
          }
        />

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <MetricCard
            label="Practica activa"
            value={activeAssignment?.projectTitle ?? "Sin seleccionar"}
            helper={activeTimeline?.headline ?? "Elige una convocatoria"}
            icon={<RiFolderOpenLine />}
            variant="default"
          />
          <MetricCard
            label="Intentos restantes"
            value={activeAssignment?.remainingDeliveries ?? 0}
            helper={`${activeAssignment?.deliveryCount ?? 0} entrega(s) registradas`}
            icon={<RiInboxArchiveLine />}
            variant={noRemainingDeliveries ? "warning" : "info"}
          />
          <MetricCard
            label="Informes disponibles"
            value={insights.reportsReady}
            helper={`${insights.blockedReports} con bloqueos`}
            icon={<RiFileList3Line />}
            variant={insights.blockedReports > 0 ? "warning" : "success"}
          />
          <MetricCard
            label="Estado actual"
            value={workflow.label}
            helper={workflow.description}
            icon={<RiRocketLine />}
            variant={
              workflow.state === "REPORT_READY" || workflow.state === "GRADED"
                ? "success"
                : workflow.state === "BUILD_FAILED"
                  ? "warning"
                  : "default"
            }
          />
        </div>
      </StudentSurface>

      <div className="grid gap-6 xl:grid-cols-[1.02fr,1.45fr]">
        <div className="space-y-6">
          {activeAssignment && activeTimeline ? (
            <StudentSurface
              tone={
                activeTimeline.state === "late"
                  ? "warm"
                  : activeTimeline.state === "upcoming"
                    ? "subtle"
                    : "default"
              }
            >
              <StudentSurfaceHeader
                eyebrow="Ventana academica"
                title={activeTimeline.headline}
                description={activeTimeline.detail}
                badge={
                  activeTimeline.countdownLabel ? (
                    <span className="inline-flex rounded-full border border-white/70 bg-white/70 px-3 py-1 text-xs font-semibold text-academic-on-surface">
                      {activeTimeline.countdownLabel}
                    </span>
                  ) : undefined
                }
              />
            </StudentSurface>
          ) : null}

          <StudentSurface>
            <StudentSurfaceHeader
              eyebrow="Briefing de la practica"
              title={activeAssignment?.projectTitle ?? "Selecciona una practica"}
              description="Antes de subir nada, confirma que esta es la convocatoria correcta y revisa si conviene reenviar ahora o esperar otro momento."
              badge={
                <span
                  className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${workflow.badgeClassName}`}
                >
                  {workflow.label}
                </span>
              }
            />
            <StudentKeyValueList
              className="mt-6"
              items={[
                {
                  label: "Apertura",
                  value: formatAssignmentDate(activeAssignment?.opensAt),
                },
                {
                  label: "Cierre",
                  value: formatAssignmentDate(activeAssignment?.closesAt),
                },
                {
                  label: "Ultima entrega",
                  value: latestAssignmentDelivery
                    ? `v${latestAssignmentDelivery.version}`
                    : "Aun no hay entregas",
                },
                {
                  label: "Siguiente foco",
                  value: noRemainingDeliveries
                    ? "Ya no quedan intentos disponibles"
                    : notYetOpen
                      ? "Esperar a que se abra la ventana"
                      : "Preparar archivo y confirmar subida",
                },
              ]}
            />

            {(noRemainingDeliveries || notYetOpen || afterDeadline) && activeAssignment ? (
              <div className="mt-6 rounded-[1.5rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
                {noRemainingDeliveries
                  ? "Esta practica ya no tiene intentos restantes. Puedes seguir revisando el informe y el historial, pero no se habilitara otra subida."
                  : notYetOpen
                    ? "La convocatoria sigue cerrada. En cuanto se abra, podras continuar con el asistente de subida."
                    : "La fecha de cierre ya paso. Puedes seguir entregando, pero esta version quedara marcada como fuera de plazo."}
              </div>
            ) : null}
          </StudentSurface>

          {latestAssignmentRun?.report?.coaching ? (
            <SubmissionCoachingPreview
              run={latestAssignmentRun}
              remainingDeliveries={activeAssignment?.remainingDeliveries ?? 0}
            />
          ) : null}
        </div>

        <StudentSurface className="overflow-hidden p-0">
          <div className="border-b border-academic-surface-variant bg-academic-surface-container-lowest px-6 py-5 sm:px-8">
            <div className="flex flex-wrap items-center gap-4">
              {[
                { number: 1, label: "Practica" },
                { number: 2, label: "Archivo" },
                { number: 3, label: "Confirmar" },
              ].map((item) => {
                const state = getStepState(step, item.number);

                return (
                  <div key={item.number} className="flex items-center gap-3">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold ${
                        state === "complete"
                          ? "bg-emerald-500 text-white"
                          : state === "active"
                            ? "bg-brand-blue text-white"
                            : "bg-white text-academic-outline"
                      }`}
                    >
                      {state === "complete" ? <RiCheckLine /> : item.number}
                    </div>
                    <div>
                      <div className="ui-label text-academic-outline">Paso {item.number}</div>
                      <div className="text-sm font-semibold text-academic-on-surface">
                        {item.label}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-6 sm:p-8">
            {status === "error" ? (
              <div className="mb-6 rounded-[1.5rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                Error al procesar la entrega: {errorMessage}
              </div>
            ) : null}

            {step === 1 ? (
              <div className="space-y-6">
                <div>
                  <div className="eyebrow text-academic-outline">
                    Paso 1 · Convocatoria
                  </div>
                  <h3 className="mt-2 font-display text-3xl font-semibold tracking-tight text-academic-on-surface">
                    Elige la practica que vas a entregar
                  </h3>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-academic-on-surface-variant">
                    El asistente se queda con la practica seleccionada para
                    reutilizar el contexto en entregas, informes y coaching.
                  </p>
                </div>

                <div className="grid gap-3">
                  {assignments.map((assignment) => {
                    const assignmentTimeline = describeAssignmentTimeline(
                      assignment,
                      now,
                    );
                    const disabled =
                      assignment.remainingDeliveries <= 0 ||
                      Boolean(
                        assignment.opensAt &&
                          new Date(assignment.opensAt).getTime() > now,
                      );

                    return (
                      <label
                        key={assignment.id}
                        className={`flex cursor-pointer items-start gap-4 rounded-[1.5rem] border p-5 transition-all ${
                          disabled
                            ? "cursor-not-allowed border-slate-200 bg-slate-50 opacity-70"
                            : selectedAssignmentId === assignment.id
                              ? "border-brand-blue bg-brand-blue/5 shadow-sm"
                              : "border-academic-surface-variant bg-white hover:-translate-y-0.5 hover:shadow-sm"
                        }`}
                      >
                        <input
                          type="radio"
                          name="assignment"
                          value={assignment.id}
                          checked={selectedAssignmentId === assignment.id}
                          disabled={disabled}
                          onChange={() => setSelectedAssignmentId(assignment.id)}
                          className="mt-1 h-4 w-4 text-brand-blue focus:ring-brand-blue"
                        />
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-academic-surface-container-lowest text-brand-blue">
                          <RiFolderOpenLine className="text-xl" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="font-semibold text-academic-on-surface">
                              {assignment.projectTitle}
                            </div>
                            <span className="inline-flex rounded-full border border-academic-surface-variant bg-academic-surface-container-lowest px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-academic-on-surface-variant">
                              {assignmentTimeline.headline}
                            </span>
                          </div>
                          <p className="mt-2 text-sm leading-6 text-academic-on-surface-variant">
                            {assignmentTimeline.detail}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2 text-xs text-academic-on-surface-variant">
                            <span className="rounded-full border border-academic-surface-variant px-2.5 py-1">
                              {assignment.remainingDeliveries} intento(s) disponibles
                            </span>
                            <span className="rounded-full border border-academic-surface-variant px-2.5 py-1">
                              Abre {formatAssignmentDate(assignment.opensAt)}
                            </span>
                            <span className="rounded-full border border-academic-surface-variant px-2.5 py-1">
                              Cierra {formatAssignmentDate(assignment.closesAt)}
                            </span>
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    variant="primary"
                    disabled={!canContinueFromStep1}
                    onClick={handleNextStep}
                  >
                    Continuar
                    <RiArrowRightLine />
                  </Button>
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="space-y-6">
                <div>
                  <div className="eyebrow text-academic-outline">Paso 2 · Archivo</div>
                  <h3 className="mt-2 font-display text-3xl font-semibold tracking-tight text-academic-on-surface">
                    Adjunta el codigo de la nueva version
                  </h3>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-academic-on-surface-variant">
                    Sube un archivo comprimido en formato <code>.zip</code> o
                    <code> .tar.gz</code> con el contenido de{" "}
                    <strong>{activeAssignment?.projectTitle}</strong>.
                  </p>
                </div>

                <div
                  className={`relative rounded-[2rem] border-2 border-dashed px-6 py-10 text-center transition-all ${
                    isDragging
                      ? "border-brand-blue bg-brand-blue/5 shadow-inner"
                      : "border-academic-surface-variant bg-academic-surface-container-lowest hover:border-brand-blue/40 hover:bg-brand-blue/5"
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <input
                    type="file"
                    accept=".zip,.tar,.gz,.tgz"
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    onChange={(event) =>
                      handleFileSelection(event.target.files?.[0] ?? null)
                    }
                  />
                  <RiFileZipLine className="mx-auto text-5xl text-brand-blue/60" />
                  {file ? (
                    <div className="mt-4">
                      <div className="text-lg font-semibold text-academic-on-surface">
                        {file.name}
                      </div>
                      <div className="mt-1 text-sm text-academic-on-surface-variant">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4">
                      <div className="text-lg font-semibold text-academic-on-surface">
                        {isDragging
                          ? "Suelta el archivo aqui"
                          : "Haz clic o arrastra el archivo a esta zona"}
                      </div>
                      <div className="mt-2 text-sm text-academic-on-surface-variant">
                        Maximo 50 MB · Formatos admitidos: .zip, .tar.gz
                      </div>
                    </div>
                  )}
                </div>

                {fileSizeError ? (
                  <div className="flex items-center gap-2 rounded-[1.5rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                    <RiAlertLine className="shrink-0 text-base" />
                    El archivo no puede superar los 50 MB. Selecciona uno mas
                    ligero antes de continuar.
                  </div>
                ) : null}

                <div className="flex flex-col gap-3 border-t border-academic-surface-variant pt-4 sm:flex-row sm:justify-between">
                  <Button variant="secondary" onClick={() => setStep(1)}>
                    <RiArrowLeftLine />
                    Volver
                  </Button>
                  <Button variant="primary" disabled={!file} onClick={handleNextStep}>
                    Continuar
                    <RiArrowRightLine />
                  </Button>
                </div>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="space-y-6">
                <div>
                  <div className="eyebrow text-academic-outline">
                    Paso 3 · Confirmacion
                  </div>
                  <h3 className="mt-2 font-display text-3xl font-semibold tracking-tight text-academic-on-surface">
                    Revisa el envio antes de registrarlo
                  </h3>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-academic-on-surface-variant">
                    Esta confirmacion cierra el asistente y registra la version
                    en el historial de la practica.
                  </p>
                </div>

                <div className="rounded-[2rem] border border-academic-surface-variant bg-academic-surface-container-lowest p-5">
                  <StudentKeyValueList
                    items={[
                      {
                        label: "Practica",
                        value: activeAssignment?.projectTitle ?? "Sin practica",
                      },
                      { label: "Archivo", value: file?.name ?? "Sin archivo" },
                      {
                        label: "Ventana",
                        value: `${formatAssignmentDate(activeAssignment?.opensAt)} -> ${formatAssignmentDate(activeAssignment?.closesAt)}`,
                      },
                      {
                        label: "Tamano",
                        value: file
                          ? `${(file.size / 1024 / 1024).toFixed(2)} MB`
                          : "Sin archivo",
                      },
                      {
                        label: "Intentos despues del envio",
                        value: String(
                          Math.max(
                            0,
                            (activeAssignment?.remainingDeliveries ?? 1) - 1,
                          ),
                        ),
                      },
                    ]}
                  />
                </div>

                <div className="rounded-[1.5rem] border border-brand-blue/20 bg-brand-blue/5 px-4 py-3 text-sm leading-6 text-brand-blue-dark">
                  Tras enviar esta version, podras lanzar el builder en el mismo
                  flujo para obtener evaluacion tecnica y coaching de remediacion.
                </div>

                {afterDeadline ? (
                  <div className="rounded-[1.5rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
                    La fecha de cierre ya paso. La entrega quedara marcada como
                    fuera de plazo, aunque seguira registrada y evaluable.
                  </div>
                ) : null}

                <div className="flex flex-col gap-3 border-t border-academic-surface-variant pt-4 sm:flex-row sm:justify-between">
                  <Button
                    variant="secondary"
                    disabled={status === "uploading"}
                    onClick={() => setStep(2)}
                  >
                    <RiArrowLeftLine />
                    Volver
                  </Button>
                  <Button
                    variant="primary"
                    disabled={status === "uploading"}
                    onClick={handleSubmit}
                  >
                    {status === "uploading" ? (
                      <>
                        <RiLoader4Line className="animate-spin" />
                        Enviando
                      </>
                    ) : (
                      <>
                        <RiUploadCloud2Line />
                        Enviar ahora
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </StudentSurface>
      </div>
    </div>
  );
}
