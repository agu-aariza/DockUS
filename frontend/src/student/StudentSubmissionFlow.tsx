import { useState } from "react";
import type { SessionRecord } from "../shared/types";
import { deliveriesApi, storageApi } from "../shared/api/services";
import { builderApi } from "../shared/api/builderApi";
import { getErrorMessage } from "../shared/utils/errors";
import { computeSha256Hex } from "../shared/utils/hash";
import { useWorkspace } from "../shared/workspace/WorkspaceContext";
import {
  RiUploadCloud2Line,
  RiCheckLine,
  RiLoader4Line,
  RiArrowRightLine,
  RiArrowLeftLine,
  RiFolderOpenLine,
  RiFileZipLine,
  RiRocketLine,
  RiCheckboxCircleLine,
  RiAlertLine,
} from "react-icons/ri";
import type { StudentWorkspaceData } from "./hooks/useStudentWorkspaceData";
import {
  describeAssignmentTimeline,
  formatAssignmentDate,
} from "./deadlineUtils";
import {
  deriveStudentWorkflowState,
  describeStudentWorkflowState,
} from "./studentWorkflowState";

interface Props {
  session: SessionRecord | null;
  data: StudentWorkspaceData;
  onNavigate: (tab: any) => void;
}

type Step = 1 | 2 | 3 | 4;

export function StudentSubmissionFlow({ session, data, onNavigate }: Props): JSX.Element {
  const { selection, setDelivery, setProject, setAssignment } = useWorkspace();
  const { assignments, deliveries, latestRunByDeliveryId, refresh } = data;
  
  const [step, setStep] = useState<Step>(1);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState(selection.assignmentId || (assignments[0]?.id ?? ""));
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  const [status, setStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [createdVersion, setCreatedVersion] = useState<number | null>(null);
  const [createdDeliveryId, setCreatedDeliveryId] = useState<string | null>(null);
  const [buildLaunched, setBuildLaunched] = useState(false);
  const [buildLaunching, setBuildLaunching] = useState(false);
  const [buildError, setBuildError] = useState<string | null>(null);

  const activeAssignment = assignments.find(a => a.id === selectedAssignmentId);
  const latestAssignmentDelivery =
    deliveries.find((delivery) => delivery.assignmentId === selectedAssignmentId) ??
    null;
  const latestAssignmentRun = latestAssignmentDelivery
    ? latestRunByDeliveryId[latestAssignmentDelivery.id] ?? null
    : null;
  const noAssignments = assignments.length === 0;
  const noRemainingDeliveries = activeAssignment && activeAssignment.remainingDeliveries <= 0;
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

  const handleNextStep = () => {
    if (step === 1 && selectedAssignmentId && !noRemainingDeliveries && !notYetOpen) setStep(2);
    else if (step === 2 && file) setStep(3);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const selected = e.dataTransfer.files?.[0];
    if (selected && selected.size > 50 * 1024 * 1024) {
      alert("El archivo no puede superar los 50MB.");
      setFile(null);
    } else {
      setFile(selected || null);
    }
  };

  const handleSubmit = async () => {
    if (!selectedAssignmentId || !file) return;

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
        hash: hash,
        sizeBytes: file.size,
        file: file,
      });

      if (activeAssignment) {
        setProject(activeAssignment.projectId, activeAssignment.projectTitle);
        setAssignment(activeAssignment.id, activeAssignment.studentEmail);
      }
      setDelivery(delivery.id, `v${delivery.version}`);
      setCreatedVersion(delivery.version);
      setCreatedDeliveryId(delivery.id);
      
      await refresh();
      setStatus("success");
      setStep(4); // Move to the optional builder step
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setStatus("error");
    }
  };

  const handleLaunchBuilder = async () => {
    if (!createdDeliveryId) return;
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

  // Step 4: Post-submission options
  if (step === 4) {
    return (
      <div className="rounded-3xl border border-emerald-200 bg-emerald-50 px-6 py-10 max-w-2xl mx-auto shadow-sm">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <RiCheckLine className="text-3xl" />
          </div>
          <h3 className="mt-4 text-xl font-bold text-slate-900">Versión v{createdVersion} entregada</h3>
          <p className="mt-2 text-sm text-slate-600">
            Hemos recibido tu archivo <strong>{file?.name}</strong> correctamente.
          </p>
        </div>

        {/* Builder launch section */}
        <div className="mt-8 rounded-2xl border border-emerald-300 bg-white p-6">
          <h4 className="font-semibold text-slate-900 flex items-center gap-2">
            <RiRocketLine className="text-indigo-500" />
            ¿Quieres evaluar tu código ahora?
          </h4>
          <p className="mt-1 text-sm text-slate-600">
            El sistema analizará tu código, lo construirá en un contenedor y ejecutará las pruebas del profesor automáticamente.
          </p>

          {buildLaunched ? (
            <div className="mt-4 flex items-center gap-2 text-sm text-emerald-700 font-medium">
              <RiCheckboxCircleLine className="text-lg" />
              Evaluación lanzada. Recibirás una notificación cuando termine.
            </div>
          ) : buildError ? (
            <div className="mt-4 space-y-3">
              <div className="flex items-start gap-2 text-sm text-rose-700">
                <RiAlertLine className="text-lg mt-0.5 flex-shrink-0" />
                <span>{buildError}</span>
              </div>
              <button className="btn-primary text-sm" onClick={handleLaunchBuilder} disabled={buildLaunching}>
                Reintentar
              </button>
            </div>
          ) : (
            <div className="mt-4 flex gap-3">
              <button
                className="btn-primary"
                onClick={handleLaunchBuilder}
                disabled={buildLaunching}
              >
                {buildLaunching ? (
                  <>
                    <RiLoader4Line className="animate-spin text-lg" />
                    Lanzando...
                  </>
                ) : (
                  <>
                    <RiRocketLine className="text-lg" />
                    Evaluar ahora
                  </>
                )}
              </button>
              <button
                className="btn-secondary"
                onClick={() => onNavigate("informes")}
              >
                Omitir por ahora
              </button>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-center gap-4">
          <button className="btn-secondary" onClick={() => onNavigate("entregas")}>
            Ver mis entregas
          </button>
          {buildLaunched && (
            <button className="btn-primary" onClick={() => onNavigate("informes")}>
              Seguir el estado <RiArrowRightLine />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {activeAssignment && activeTimeline ? (
        <div
          className={`rounded-2xl border px-5 py-4 text-sm shadow-sm ${
            activeTimeline.state === "late"
              ? "border-amber-200 bg-amber-50 text-amber-900"
              : activeTimeline.state === "upcoming"
                ? "border-sky-200 bg-sky-50 text-sky-900"
                : "border-emerald-200 bg-emerald-50 text-emerald-900"
          }`}
        >
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="font-semibold">{activeAssignment.projectTitle}</div>
              <div className="mt-1">{activeTimeline.detail}</div>
            </div>
            <div className="rounded-full bg-white/70 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em]">
              {activeTimeline.countdownLabel ?? "Sin fecha límite"}
            </div>
          </div>
        </div>
      ) : null}

      {activeAssignment ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Estado académico actual
              </div>
              <div className={`mt-2 inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${workflow.badgeClassName}`}>
                {workflow.label}
              </div>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                {workflow.description}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-xs text-slate-600">
              {activeAssignment.deliveryCount} entrega(s) registradas · {activeAssignment.remainingDeliveries} intento(s) disponibles
            </div>
          </div>
        </div>
      ) : null}

      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        {/* Wizard Header */}
        <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-100">
          {[
            { num: 1, label: "Proyecto" },
            { num: 2, label: "Archivo" },
            { num: 3, label: "Confirmar" },
          ].map((s, i) => (
            <div key={s.num} className="flex items-center">
              {i > 0 && <div className="h-px w-8 md:w-12 bg-slate-200 mx-2" />}
              <div className="flex items-center gap-2 md:gap-3">
                <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-colors ${
                  step > s.num 
                    ? "bg-emerald-500 text-white" 
                    : step >= s.num 
                      ? "bg-indigo-600 text-white" 
                      : "bg-slate-100 text-slate-400"
                }`}>
                  {step > s.num ? <RiCheckLine /> : s.num}
                </div>
                <span className={`text-sm font-semibold hidden sm:inline ${step >= s.num ? "text-slate-900" : "text-slate-400"}`}>
                  {s.label}
                </span>
              </div>
            </div>
          ))}
        </div>

        {status === "error" && (
          <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            Error al procesar la entrega: {errorMessage}
          </div>
        )}

        {/* Step 1 — Select Assignment */}
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in">
            <h3 className="text-xl font-bold text-slate-900">¿Qué práctica vas a entregar?</h3>

            {noAssignments ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                <RiFolderOpenLine className="mx-auto text-4xl text-slate-400 mb-3" />
                <p className="text-sm text-slate-600">
                  No tienes asignaciones activas. Contacta con tu profesor para que te asigne una práctica.
                </p>
              </div>
            ) : (
              <div className="grid gap-3">
                {assignments.map(a => (
                  <label 
                    key={a.id} 
                    className={`flex cursor-pointer items-center gap-4 rounded-xl border p-4 transition-all ${
                      a.remainingDeliveries <= 0
                        ? "border-slate-100 bg-slate-50 opacity-60 cursor-not-allowed"
                        : selectedAssignmentId === a.id 
                          ? "border-indigo-600 bg-indigo-50/50 shadow-sm" 
                          : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <input 
                      type="radio" 
                      name="assignment" 
                      value={a.id} 
                      checked={selectedAssignmentId === a.id} 
                      onChange={() => setSelectedAssignmentId(a.id)}
                      disabled={a.remainingDeliveries <= 0}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-600"
                    />
                    <RiFolderOpenLine className={`text-2xl ${selectedAssignmentId === a.id ? "text-indigo-600" : "text-slate-400"}`} />
                    <div className="flex-1">
                      <div className="font-semibold text-slate-900">{a.projectTitle}</div>
                      <div className={`text-xs mt-0.5 ${a.remainingDeliveries <= 0 ? "text-rose-500 font-medium" : "text-slate-500"}`}>
                        {a.remainingDeliveries <= 0 
                          ? "Sin intentos disponibles" 
                          : `Te quedan ${a.remainingDeliveries} intentos`}
                      </div>
                      <div className="mt-2 text-xs text-slate-500">
                        Abre {formatAssignmentDate(a.opensAt)} · Cierra {formatAssignmentDate(a.closesAt)}
                      </div>
                      {a.opensAt && new Date(a.opensAt).getTime() > now ? (
                        <div className="mt-2 text-xs font-medium text-amber-700">
                          La entrega todavía no está abierta.
                        </div>
                      ) : null}
                      {a.closesAt && new Date(a.closesAt).getTime() < now ? (
                        <div className="mt-2 text-xs font-medium text-amber-700">
                          El plazo venció; aún puedes entregar con marca de retraso.
                        </div>
                      ) : null}
                    </div>
                    {a.deliveryCount > 0 && (
                      <span className="text-xs text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">
                        {a.deliveryCount} enviadas
                      </span>
                    )}
                  </label>
                ))}
              </div>
            )}
            <div className="flex justify-end pt-4">
              <button 
                className="btn-primary" 
                disabled={!selectedAssignmentId || noAssignments || !!noRemainingDeliveries || notYetOpen} 
                onClick={handleNextStep}
              >
                Continuar <RiArrowRightLine />
              </button>
            </div>
          </div>
        )}

        {/* Step 2 — File Upload */}
        {step === 2 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
            <div>
              <h3 className="text-xl font-bold text-slate-900">Adjunta tu trabajo</h3>
              <p className="mt-1 text-sm text-slate-600">
                Sube un archivo comprimido (<code>.zip</code> o <code>.tar.gz</code>) con el código de <strong>{activeAssignment?.projectTitle}</strong>.
              </p>
            </div>
            
            <div 
              className={`rounded-2xl border-2 border-dashed p-8 text-center transition-all relative ${
                isDragging 
                  ? 'border-indigo-500 bg-indigo-100 scale-[1.02] shadow-inner' 
                  : 'border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/50 bg-slate-50'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input
                type="file"
                className="absolute inset-0 h-full w-full opacity-0 cursor-pointer"
                accept=".zip,.tar,.gz,.tgz"
                onChange={(e) => {
                  const selected = e.target.files?.[0];
                  if (selected && selected.size > 50 * 1024 * 1024) {
                    alert("El archivo no puede superar los 50MB.");
                    e.target.value = '';
                    setFile(null);
                  } else {
                    setFile(selected || null);
                  }
                }}
              />
              <RiFileZipLine className={`mx-auto text-5xl mb-3 transition-colors ${isDragging ? 'text-indigo-600' : 'text-indigo-300'}`} />
              {file ? (
                <div>
                  <div className="font-bold text-lg text-indigo-700">{file.name}</div>
                  <div className="text-sm font-medium text-slate-500 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</div>
                </div>
              ) : (
                <>
                  <div className={`font-bold text-lg ${isDragging ? 'text-indigo-800' : 'text-slate-700'}`}>
                    {isDragging ? '¡Suelta el archivo aquí!' : 'Haz clic o arrastra tu archivo aquí'}
                  </div>
                  <div className="text-sm font-medium text-slate-500 mt-2">Max 50MB. Formatos: .zip, .tar.gz</div>
                </>
              )}
            </div>

            <div className="flex justify-between pt-4">
              <button className="btn-secondary text-sm flex items-center gap-1" onClick={() => setStep(1)}>
                <RiArrowLeftLine /> Volver
              </button>
              <button className="btn-primary" disabled={!file} onClick={handleNextStep}>
                Continuar <RiArrowRightLine />
              </button>
            </div>
          </div>
        )}

        {/* Step 3 — Confirmation */}
        {step === 3 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
            <h3 className="text-xl font-bold text-slate-900">Confirma tu entrega</h3>
            <div className="rounded-xl bg-slate-50 p-5 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Proyecto:</span>
                <span className="font-semibold text-slate-900">{activeAssignment?.projectTitle}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Archivo:</span>
                <span className="font-semibold text-slate-900">{file?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Ventana:</span>
                <span className="font-semibold text-slate-900">
                  {formatAssignmentDate(activeAssignment?.opensAt)} → {formatAssignmentDate(activeAssignment?.closesAt)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Tamaño:</span>
                <span className="font-semibold text-slate-900">{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : "—"}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-3">
                <span className="text-slate-500">Intentos tras esta entrega:</span>
                <span className={`font-semibold ${
                  activeAssignment && activeAssignment.remainingDeliveries - 1 <= 1 
                    ? "text-amber-600" 
                    : "text-slate-900"
                }`}>
                  {activeAssignment ? Math.max(0, activeAssignment.remainingDeliveries - 1) : 0} restantes
                </span>
              </div>
            </div>

            <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-4 text-sm text-indigo-800">
              <strong>Nota:</strong> Tras enviar podrás lanzar la evaluación automática de tu código.
            </div>
            {afterDeadline ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                Esta entrega quedará marcada como fuera de plazo porque la fecha de cierre ya pasó.
              </div>
            ) : null}

            <div className="flex justify-between pt-4">
              <button className="btn-secondary text-sm flex items-center gap-1" disabled={status === "uploading"} onClick={() => setStep(2)}>
                <RiArrowLeftLine /> Volver
              </button>
              <button
                className="btn-primary"
                disabled={status === "uploading"}
                onClick={handleSubmit}
              >
                {status === "uploading" ? (
                  <>
                    <RiLoader4Line className="animate-spin text-lg" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <RiUploadCloud2Line className="text-lg" />
                    Enviar ahora
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
