/**
 * @fileoverview Vista y gestión de proyectos académicos (ProjectCreateForm).
 *
 * @module ProjectCreateForm
 */

import type { FormEvent } from "react";
import { RiCheckFill, RiFolderAddLine, RiFolderUploadLine, RiGroupLine } from "react-icons/ri";
import { Button } from "../../shared/components/ui/Button";
import { SectionCard } from "../../shared/components/ui/Layout";
import { RubricEditor } from "../components/RubricEditor";
import type { ProjectStatus, RubricCriterion } from "../../features/projects/types";
import type { CourseGroupEntity } from "../../features/groups/types";

export interface CreateFormState {
  title: string;
  contextAcademico: string;
  status: ProjectStatus;
  maxDeliveriesPerStudent: string;
  expectedType: string;
  expectedOutput: string;
  rubricInstructions: string;
  rubricCriteria: RubricCriterion[];
  opensAt: string;
  closesAt: string;
  assignedGroupIds: string[];
  suiteFile: File | null;
}

export interface ProjectCreateFormProps {
  createForm: CreateFormState;
  setCreateForm: React.Dispatch<React.SetStateAction<CreateFormState>>;
  groups: CourseGroupEntity[];
  handleCreate: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}

export function ProjectCreateForm({
  createForm,
  setCreateForm,
  groups,
  handleCreate,
  onCancel,
}: ProjectCreateFormProps): JSX.Element {
  const isInvalidDateWindow = Boolean(
    createForm.opensAt &&
    createForm.closesAt &&
    new Date(createForm.opensAt) >= new Date(createForm.closesAt)
  );

  return (
    <SectionCard
      title="Parametrización de Práctica Académica"
      description="Define el contrato académico, la ventana temporal y el tipo esperado para que el evaluador y el seguimiento sean coherentes desde el primer momento."
      headerAction={
        <Button
          variant="secondary"
          size="sm"
          onClick={onCancel}
          className="shadow-sm"
        >
          Volver al lienzo
        </Button>
      }
    >
      <form className="space-y-6" onSubmit={handleCreate}>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div>
            <label htmlFor="new-project-title" className="label-text">Título del proyecto</label>
            <input
              id="new-project-title"
              className="input-field"
              required
              value={createForm.title}
              onChange={(e) => setCreateForm(prev => ({ ...prev, title: e.target.value }))}
            />
          </div>
          <div>
            <label htmlFor="new-project-status" className="label-text">Estado</label>
            <select
              id="new-project-status"
              className="input-field"
              value={createForm.status}
              onChange={(e) => setCreateForm(prev => ({ ...prev, status: e.target.value as ProjectStatus }))}
            >
              <option value="DRAFT">DRAFT</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="ARCHIVED">ARCHIVED</option>
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="new-project-context" className="label-text">Contexto académico</label>
          <textarea
            id="new-project-context"
            className="input-field min-h-[140px]"
            placeholder="Describe objetivos, entregables, criterios y notas operativas."
            value={createForm.contextAcademico}
            onChange={(e) => setCreateForm(prev => ({ ...prev, contextAcademico: e.target.value }))}
          />
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div>
            <label htmlFor="new-project-max-deliveries" className="label-text">Intentos máximos por alumno</label>
            <input
              id="new-project-max-deliveries"
              type="number"
              min="1"
              className="input-field"
              value={createForm.maxDeliveriesPerStudent}
              onChange={(e) => setCreateForm(prev => ({ ...prev, maxDeliveriesPerStudent: e.target.value }))}
            />
          </div>
          <div>
            <label htmlFor="new-project-expected-type" className="label-text">Tipo esperado</label>
            <input
              id="new-project-expected-type"
              className="input-field"
              placeholder="CLI, Flask, FastAPI, Django simple..."
              value={createForm.expectedType}
              onChange={(e) => setCreateForm(prev => ({ ...prev, expectedType: e.target.value }))}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div>
            <label htmlFor="new-project-opens-at" className="label-text">Abre entregas en</label>
            <input
              id="new-project-opens-at"
              type="datetime-local"
              className={`input-field ${isInvalidDateWindow ? "border-danger focus:border-danger focus:ring-danger/20" : ""}`}
              value={createForm.opensAt}
              onChange={(e) => setCreateForm(prev => ({ ...prev, opensAt: e.target.value }))}
            />
          </div>
          <div>
            <label htmlFor="new-project-closes-at" className="label-text">Cierra entregas en</label>
            <input
              id="new-project-closes-at"
              type="datetime-local"
              className={`input-field ${isInvalidDateWindow ? "border-danger focus:border-danger focus:ring-danger/20" : ""}`}
              value={createForm.closesAt}
              onChange={(e) => setCreateForm(prev => ({ ...prev, closesAt: e.target.value }))}
            />
          </div>
          {isInvalidDateWindow && (
            <p className="col-span-full text-xs text-danger -mt-3">
              La fecha de apertura debe ser anterior a la fecha de cierre.
            </p>
          )}
        </div>
        <div>
          <label htmlFor="new-project-expected-output" className="label-text">Salida esperada (Oracle)</label>
          <textarea
            id="new-project-expected-output"
            className="input-field min-h-[120px] font-mono text-xs"
            placeholder="Pega aquí la salida esperada para que el evaluador compare stdout/stderr."
            value={createForm.expectedOutput}
            onChange={(e) => setCreateForm(prev => ({ ...prev, expectedOutput: e.target.value }))}
          />
        </div>
        <div>
          <label htmlFor="new-project-rubric-instructions" className="label-text">Instrucciones de rúbrica</label>
          <textarea
            id="new-project-rubric-instructions"
            className="input-field min-h-[160px]"
            placeholder="Indica los criterios docentes y el comportamiento esperado de la nota final."
            value={createForm.rubricInstructions}
            onChange={(e) => setCreateForm(prev => ({ ...prev, rubricInstructions: e.target.value }))}
          />
        </div>
        <div className="pt-2">
          <RubricEditor
            criteria={createForm.rubricCriteria}
            onChange={(rubricCriteria) => setCreateForm(prev => ({ ...prev, rubricCriteria }))}
          />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 pt-6 border-t border-app-border">
          <div className="space-y-3">
            <div>
              {/* Encabezado del grupo de botones de abajo, no de un control único. */}
              <span className="label-text">Asignar Grupos Académicos</span>
              <p className="text-[11px] text-app-text-muted mt-1">Los alumnos de los grupos seleccionados serán matriculados automáticamente.</p>
            </div>
            <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto pr-1">
              {groups.map((group) => {
                const isSelected = createForm.assignedGroupIds.includes(group.id);
                return (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => {
                      const newIds = isSelected
                        ? createForm.assignedGroupIds.filter(id => id !== group.id)
                        : [...createForm.assignedGroupIds, group.id];
                      setCreateForm(prev => ({ ...prev, assignedGroupIds: newIds }));
                    }}
                    className={`flex items-center justify-between rounded-md border p-3 text-left transition-colors ${isSelected
                        ? "border-primary/50 bg-primary-subtle"
                        : "border-app-border bg-app-surface hover:border-app-text-muted/40 hover:bg-app-bg-subtle"
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-md transition-colors ${isSelected ? "bg-primary text-white" : "bg-app-bg-subtle text-app-text-muted"
                        }`}>
                        <RiGroupLine />
                      </div>
                      <div>
                        <p className={`text-sm font-semibold ${isSelected ? "text-primary" : "text-app-text"}`}>{group.name}</p>
                        <p className="data-meta">{group.code || 'Sin código'}</p>
                      </div>
                    </div>
                    {isSelected && <RiCheckFill className="text-primary text-lg" />}
                  </button>
                );
              })}
              {groups.length === 0 && (
                <div className="rounded-md border border-dashed border-app-border bg-app-bg-subtle p-6 text-center">
                  <RiGroupLine className="mx-auto text-2xl text-app-text-muted mb-2" />
                  <p className="text-sm text-app-text-secondary">No hay grupos creados todavía.</p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label htmlFor="new-project-suite" className="label-text">Suite de Evaluación Inicial</label>
              <p className="text-xs text-app-text-secondary">Sube el archivo .zip con los tests docentes para este proyecto.</p>
            </div>

            <div
              className={`relative flex h-[300px] flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center transition-colors ${createForm.suiteFile
                  ? "border-success-300 bg-success-50/40 dark:border-success-800 dark:bg-success-950/40"
                  : "border-app-border bg-app-bg-subtle/60 hover:border-app-text-muted/50"
                }`}
            >
              <input
                id="new-project-suite"
                type="file"
                className="hidden"
                accept=".zip"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setCreateForm(prev => ({ ...prev, suiteFile: file }));
                }}
              />

              <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-md transition-colors ${createForm.suiteFile ? "border border-success-200 bg-success-50 text-success-600 dark:border-success-800 dark:bg-success-950 dark:text-success-400" : "border border-app-border bg-app-surface text-app-text-muted"
                }`}>
                {createForm.suiteFile ? <RiCheckFill className="text-2xl" /> : <RiFolderUploadLine className="text-2xl" />}
              </div>

              {createForm.suiteFile ? (
                <>
                  <h5 className="text-sm font-semibold text-success-900 dark:text-success-400">{createForm.suiteFile.name}</h5>
                   <p className="mt-1 text-xs text-success-700 dark:text-success-500">{(createForm.suiteFile.size / 1024).toFixed(1)} KB listo para subir</p>
                  <button
                    type="button"
                    className="mt-4 text-xs font-semibold text-danger-600 hover:underline"
                    onClick={() => setCreateForm(prev => ({ ...prev, suiteFile: null }))}
                  >
                    Quitar archivo
                  </button>
                </>
              ) : (
                <>
                  <h5 className="text-sm font-semibold text-app-text">Seleccionar Suite (.zip)</h5>
                  <p className="mt-1 text-xs text-app-text-secondary">Haz clic para buscar en tu equipo</p>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="mt-4 shadow-sm"
                    onClick={() => document.getElementById('new-project-suite')?.click()}
                  >
                    Explorar archivos
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-app-border pt-5">
          <Button
            type="submit"
            variant="primary"
            className="shadow-sm"
            disabled={isInvalidDateWindow}
          >
            <RiFolderAddLine />
            Crear proyecto
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            className="shadow-sm"
          >
            Cancelar
          </Button>
        </div>
      </form>
    </SectionCard>
  );
}
