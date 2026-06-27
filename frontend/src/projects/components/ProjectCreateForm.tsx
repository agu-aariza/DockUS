import { Button } from "../../shared/components/ui/Button";
import {
  RiGroupLine,
  RiCheckFill,
  RiFolderUploadLine,
  RiFolderAddLine,
} from "react-icons/ri";
import type { ProjectStatus } from "../../features/projects/types";

export function ProjectCreateForm({
  createForm,
  setCreateForm,
  groups,
  handleCreate,
  onCancel,
}: {
  createForm: any;
  setCreateForm: (updater: any) => void;
  groups: any[];
  handleCreate: (e: React.FormEvent) => void;
  onCancel: () => void;
}) {
  return (
    <div className="rounded-lg border border-academic-surface-variant bg-white p-8 shadow-academic">
      <div className="flex flex-col gap-3 border-b border-academic-outline-variant/20 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="eyebrow">Definición de Proyecto</p>
          <h3 className="mt-2 text-2xl font-semibold tracking-tight text-academic-on-surface">
            Parametrización de Práctica Académica
          </h3>
          <p className="mt-2 text-sm leading-6 text-academic-on-surface-variant">
            Define el contrato académico, la ventana temporal y el tipo esperado para que el builder y el seguimiento sean coherentes desde el primer momento.
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={onCancel}
        >
          Volver al lienzo
        </Button>
      </div>

      <form className="mt-8 space-y-6" onSubmit={handleCreate}>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div>
            <label className="label-text">Título del proyecto</label>
            <input
              className="input-field"
              required
              value={createForm.title}
              onChange={(e) => setCreateForm((prev: any) => ({ ...prev, title: e.target.value }))}
            />
          </div>
          <div>
            <label className="label-text">Estado</label>
            <select
              className="input-field"
              value={createForm.status}
              onChange={(e) => setCreateForm((prev: any) => ({ ...prev, status: e.target.value as ProjectStatus }))}
            >
              <option value="DRAFT">DRAFT</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="ARCHIVED">ARCHIVED</option>
            </select>
          </div>
        </div>
        <div>
          <label className="label-text">Contexto académico</label>
          <textarea
            className="input-field min-h-[140px]"
            placeholder="Describe objetivos, entregables, criterios y notas operativas."
            value={createForm.contextAcademico}
            onChange={(e) => setCreateForm((prev: any) => ({ ...prev, contextAcademico: e.target.value }))}
          />
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div>
            <label className="label-text">Intentos máximos por alumno</label>
            <input
              type="number"
              min="1"
              className="input-field"
              value={createForm.maxDeliveriesPerStudent}
              onChange={(e) => setCreateForm((prev: any) => ({ ...prev, maxDeliveriesPerStudent: e.target.value }))}
            />
          </div>
          <div>
            <label className="label-text">Tipo esperado</label>
            <input
              className="input-field"
              placeholder="CLI, Flask, FastAPI, Django simple..."
              value={createForm.expectedType}
              onChange={(e) => setCreateForm((prev: any) => ({ ...prev, expectedType: e.target.value }))}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div>
            <label className="label-text">Abre entregas en</label>
            <input
              type="datetime-local"
              className="input-field"
              value={createForm.opensAt}
              onChange={(e) => setCreateForm((prev: any) => ({ ...prev, opensAt: e.target.value }))}
            />
          </div>
          <div>
            <label className="label-text">Cierra entregas en</label>
            <input
              type="datetime-local"
              className="input-field"
              value={createForm.closesAt}
              onChange={(e) => setCreateForm((prev: any) => ({ ...prev, closesAt: e.target.value }))}
            />
          </div>
        </div>
        <div>
          <label className="label-text">Salida esperada (Oracle)</label>
          <textarea
            className="input-field min-h-[120px] font-mono text-xs"
            placeholder="Pega aquí la salida esperada para que el evaluador compare stdout/stderr."
            value={createForm.expectedOutput}
            onChange={(e) => setCreateForm((prev: any) => ({ ...prev, expectedOutput: e.target.value }))}
          />
        </div>
        <div>
          <label className="label-text">Instrucciones de rúbrica</label>
          <textarea
            className="input-field min-h-[160px]"
            placeholder="Indica los criterios docentes y el comportamiento esperado de la nota final."
            value={createForm.rubricInstructions}
            onChange={(e) => setCreateForm((prev: any) => ({ ...prev, rubricInstructions: e.target.value }))}
          />
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 pt-6 border-t border-academic-outline-variant/20">
          <div className="space-y-4">
            <label className="label-text">Asignar Grupos Académicos</label>
            <p className="text-xs text-academic-on-surface-variant mb-3">Los alumnos de los grupos seleccionados serán matriculados automáticamente.</p>
            <div className="grid grid-cols-1 gap-3 max-h-[300px] overflow-y-auto pr-2">
              {groups.map((group) => {
                const isSelected = createForm.assignedGroupIds.includes(group.id);
                return (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => {
                      const newIds = isSelected
                        ? createForm.assignedGroupIds.filter((id: string) => id !== group.id)
                        : [...createForm.assignedGroupIds, group.id];
                      setCreateForm((prev: any) => ({ ...prev, assignedGroupIds: newIds }));
                    }}
                    className={`flex items-center justify-between p-4 rounded-2xl border transition-all text-left ${isSelected
                        ? "bg-brand-maroon/5 border-brand-maroon shadow-sm"
                        : "bg-white border-academic-outline hover:border-academic-outline-variant hover:bg-academic-surface-container/60"
                      }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${isSelected ? "bg-brand-maroon text-white" : "bg-academic-surface-container text-academic-outline"
                        }`}>
                        <RiGroupLine className="text-lg" />
                      </div>
                      <div>
                        <p className={`font-bold text-sm ${isSelected ? "text-brand-maroon" : "text-academic-on-surface"}`}>{group.name}</p>
                        <p className="text-xs text-academic-on-surface-variant">{group.code || 'Sin código'}</p>
                      </div>
                    </div>
                    {isSelected && <RiCheckFill className="text-brand-maroon text-xl" />}
                  </button>
                );
              })}
              {groups.length === 0 && (
                <div className="p-8 text-center rounded-2xl bg-academic-surface-container/40 border border-academic-outline-variant/20">
                  <RiGroupLine className="mx-auto text-3xl text-academic-outline mb-3" />
                  <p className="text-sm text-academic-on-surface-variant">No hay grupos creados todavía.</p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <label className="label-text">Suite de Evaluación Inicial</label>
            <p className="text-xs text-academic-on-surface-variant mb-3">Sube el archivo .zip con los tests docentes para este proyecto.</p>

            <div
              className={`relative flex flex-col items-center justify-center rounded-3xl border-2 border-dashed p-8 text-center transition-all h-[300px] ${createForm.suiteFile
                  ? "bg-emerald-50 border-emerald-200 shadow-sm"
                  : "bg-academic-surface-container/30 border-academic-outline hover:bg-academic-surface-container/50 hover:border-academic-outline-variant"
                }`}
            >
              <input
                id="new-project-suite"
                type="file"
                className="hidden"
                accept=".zip"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setCreateForm((prev: any) => ({ ...prev, suiteFile: file }));
                }}
              />

              <div className={`mb-4 flex h-16 w-16 items-center justify-center rounded-2xl shadow-sm transition-colors ${createForm.suiteFile ? "bg-emerald-500 text-white" : "bg-academic-surface-container-lowest text-academic-outline"
                }`}>
                {createForm.suiteFile ? <RiCheckFill className="text-3xl" /> : <RiFolderUploadLine className="text-3xl" />}
              </div>

              {createForm.suiteFile ? (
                <>
                  <h5 className="text-sm font-bold text-emerald-900">{createForm.suiteFile.name}</h5>
                  <p className="mt-1 text-xs text-emerald-600">{(createForm.suiteFile.size / 1024).toFixed(1)} KB pronto para subir</p>
                  <button
                    type="button"
                    className="mt-4 text-xs font-bold text-rose-600 hover:underline"
                    onClick={() => setCreateForm((prev: any) => ({ ...prev, suiteFile: null }))}
                  >
                    Quitar archivo
                  </button>
                </>
              ) : (
                <>
                  <h5 className="text-sm font-bold text-academic-on-surface">Seleccionar Suite (.zip)</h5>
                  <p className="mt-1 text-xs text-academic-outline">Haz clic para buscar en tu equipo</p>
                  <button
                    type="button"
                    className="mt-6 btn-secondary !py-2"
                    onClick={() => document.getElementById('new-project-suite')?.click()}
                  >
                    Explorar archivos
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-academic-outline-variant/20 pt-5">
          <Button type="submit" variant="primary">
            <RiFolderAddLine />
            Crear proyecto
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
          >
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  );
}
