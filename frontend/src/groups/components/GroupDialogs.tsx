import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  RiCheckLine,
  RiCloseLine,
  RiFileList3Line,
  RiInformationLine,
} from "react-icons/ri";
import type { BulkGroupEnrollResponse } from "../../features/groups/types";
import { useFocusTrap } from "../../shared/hooks/useFocusTrap";
import { Button } from "../../shared/components/ui/Button";
import type { GroupFormValues } from "../hooks/useGroupManagement";

const EMPTY_FORM: GroupFormValues = {
  name: "",
  code: "",
  description: "",
};

interface GroupFormDialogProps {
  open: boolean;
  mode: "create" | "edit";
  initialValues?: GroupFormValues;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (_values: GroupFormValues) => Promise<boolean>;
}

export function GroupFormDialog({
  open,
  mode,
  initialValues = EMPTY_FORM,
  submitting,
  onClose,
  onSubmit,
}: GroupFormDialogProps) {
  const [values, setValues] = useState<GroupFormValues>(initialValues);
  const nameRef = useRef<HTMLInputElement>(null);
  const dialogRef = useFocusTrap<HTMLFormElement>(open, nameRef);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    setValues(initialValues);
  }, [
    open,
    initialValues.name,
    initialValues.code,
    initialValues.description,
  ]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, submitting]);

  if (!open) return null;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!values.name.trim() || submitting) return;
    if (await onSubmit(values)) onClose();
  };

  const title = mode === "create" ? "Crear grupo" : "Editar grupo";

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4" role="presentation">
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-slate-950/50 backdrop-blur-sm motion-modal-backdrop"
        onClick={onClose}
        disabled={submitting}
        aria-label="Cerrar diálogo"
      />
      <form
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onSubmit={handleSubmit}
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-lg border border-app-border bg-app-surface shadow-md motion-modal-panel"
      >
        <div className="flex items-start justify-between gap-4 border-b border-app-border px-5 py-4">
          <div>
            <h2 id={titleId} className="text-base font-semibold text-app-text">
              {title}
            </h2>
            <p className="mt-1 text-sm text-app-text-secondary">
              Define la identidad docente que verán profesores y alumnos.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-md p-1 text-app-text-muted hover:bg-app-bg-subtle hover:text-app-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            aria-label="Cerrar"
          >
            <RiCloseLine className="text-xl" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div>
            <label htmlFor="group-name" className="label-text">
              Nombre del grupo
            </label>
            <input
              ref={nameRef}
              id="group-name"
              className="input-field"
              value={values.name}
              maxLength={150}
              required
              placeholder="2º Desarrollo de Aplicaciones Web"
              onChange={(event) =>
                setValues((current) => ({ ...current, name: event.target.value }))
              }
            />
          </div>
          <div>
            <label htmlFor="group-code" className="label-text">
              Código identificador
            </label>
            <input
              id="group-code"
              className="input-field"
              value={values.code}
              maxLength={50}
              placeholder="DAW-2A"
              onChange={(event) =>
                setValues((current) => ({ ...current, code: event.target.value }))
              }
            />
          </div>
          <div>
            <label htmlFor="group-description" className="label-text">
              Descripción <span className="font-normal text-app-text-muted">(opcional)</span>
            </label>
            <textarea
              id="group-description"
              className="input-field min-h-24 resize-y"
              value={values.description}
              placeholder="Contexto, curso académico o notas internas del grupo."
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-app-border bg-app-bg-subtle/50 px-5 py-3">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" disabled={!values.name.trim() || submitting}>
            {submitting
              ? mode === "create"
                ? "Creando..."
                : "Guardando..."
              : mode === "create"
                ? "Crear grupo"
                : "Guardar cambios"}
          </Button>
        </div>
      </form>
    </div>
  );
}

interface BulkEnrollmentDialogProps {
  open: boolean;
  groupName: string;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (_rawInput: string) => Promise<BulkGroupEnrollResponse | null>;
}

export function BulkEnrollmentDialog({
  open,
  groupName,
  submitting,
  onClose,
  onSubmit,
}: BulkEnrollmentDialogProps) {
  const [rawInput, setRawInput] = useState("");
  const [result, setResult] = useState<BulkGroupEnrollResponse | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dialogRef = useFocusTrap<HTMLFormElement>(open, textareaRef);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    setRawInput("");
    setResult(null);
  }, [open, groupName]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, submitting]);

  if (!open) return null;

  const lines = rawInput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const unresolved = result
    ? [...result.summary.unresolvedEmails, ...result.summary.unresolvedNames]
    : [];

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (lines.length === 0 || submitting) return;
    const response = await onSubmit(rawInput);
    if (!response) return;
    setResult(response);
    const remaining = [
      ...response.summary.unresolvedEmails,
      ...response.summary.unresolvedNames,
    ];
    if (remaining.length === 0) setRawInput("");
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4" role="presentation">
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-slate-950/50 backdrop-blur-sm motion-modal-backdrop"
        onClick={onClose}
        disabled={submitting}
        aria-label="Cerrar diálogo"
      />
      <form
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onSubmit={handleSubmit}
        className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-app-border bg-app-surface shadow-md motion-modal-panel"
      >
        <div className="flex items-start justify-between gap-4 border-b border-app-border px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary-subtle text-primary">
              <RiFileList3Line className="text-xl" />
            </span>
            <div>
              <h2 id={titleId} className="text-base font-semibold text-app-text">
                Importar alumnos
              </h2>
              <p className="mt-1 text-sm text-app-text-secondary">
                Matrícula masiva en <strong>{groupName}</strong>.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-md p-1 text-app-text-muted hover:bg-app-bg-subtle hover:text-app-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            aria-label="Cerrar"
          >
            <RiCloseLine className="text-xl" />
          </button>
        </div>

        <div className="custom-scrollbar space-y-5 overflow-y-auto p-5">
          <div className="rounded-md border border-primary/15 bg-primary-subtle/60 p-3 text-sm text-app-text-secondary">
            <div className="flex gap-2">
              <RiInformationLine className="mt-0.5 shrink-0 text-primary" />
              <p>
                Introduce un correo, un nombre completo o <strong>Apellidos, Nombre</strong> por línea.
                Los registros ya matriculados se reconocerán automáticamente.
              </p>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <label htmlFor="bulk-enrollment-input" className="label-text">
                Lista de alumnos
              </label>
              <span className="font-mono text-xs text-app-text-muted">
                {lines.length} {lines.length === 1 ? "registro" : "registros"}
              </span>
            </div>
            <textarea
              ref={textareaRef}
              id="bulk-enrollment-input"
              className="input-field min-h-56 resize-y font-mono text-sm leading-6"
              value={rawInput}
              placeholder={`García López, Ana\nalumno@educode.ai\nCarlos Martín`}
              onChange={(event) => {
                setRawInput(event.target.value);
                setResult(null);
              }}
            />
          </div>

          {result ? (
            <div className="space-y-3" aria-live="polite">
              <h3 className="text-sm font-semibold text-app-text">Resultado de la importación</h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  ["Altas", result.summary.enrolledCount],
                  ["Reactivados", result.summary.reactivatedCount],
                  ["Ya activos", result.summary.alreadyActiveCount],
                  ["Por revisar", unresolved.length],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-md border border-app-border bg-app-bg-subtle p-3">
                    <div className="font-mono text-lg font-semibold text-app-text">{value}</div>
                    <div className="text-xs text-app-text-muted">{label}</div>
                  </div>
                ))}
              </div>

              {unresolved.length > 0 ? (
                <div className="rounded-md border border-warning-200 bg-warning-50 p-3 dark:border-warning-800 dark:bg-warning-subtle">
                  <p className="text-sm font-semibold text-warning-800 dark:text-warning-400">
                    Revisa estos registros
                  </p>
                  <ul className="mt-2 space-y-1 font-mono text-xs text-warning-800 dark:text-warning-300">
                    {unresolved.map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-md border border-success-200 bg-success-50 p-3 text-sm text-success-700 dark:border-success-800 dark:bg-success-subtle dark:text-success-400">
                  <RiCheckLine /> Todos los registros se procesaron correctamente.
                </div>
              )}
            </div>
          ) : null}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-app-border bg-app-bg-subtle/50 px-5 py-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cerrar
          </Button>
          <Button type="submit" disabled={lines.length === 0 || submitting}>
            {submitting ? "Procesando..." : "Procesar matrículas"}
          </Button>
        </div>
      </form>
    </div>
  );
}
/**
 * Diálogos de gestión de grupos; concentran formularios y confirmaciones sin poseer el estado remoto.
 */
