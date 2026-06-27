import { VisualPicker } from "../../shared/components/ui/VisualPicker";
import { formatBytes } from "../../shared/utils/format";
import {
  RiSettings4Line,
  RiCalendarScheduleLine,
  RiTeamFill,
  RiInformationFill,
  RiCloseLine,
  RiTestTubeLine,
  RiCheckFill,
  RiEyeLine,
  RiFileDownloadLine,
  RiFolderUploadLine,
  RiLoader4Line,
  RiDeleteBin6Line,
} from "react-icons/ri";
import type { ProjectStatus } from "../../features/projects/types";

export function ProjectSettingsForm({
  pc,
  selectedCanvasProject,
  isUploadingSuite,
  handleOpenPreview,
  handleDownloadSuite,
  handleFileChange,
}: {
  pc: any;
  selectedCanvasProject: any;
  isUploadingSuite: boolean;
  handleOpenPreview: () => void;
  handleDownloadSuite: () => void;
  handleFileChange: (e: any) => void;
}) {
  return (
    <div className="space-y-8 animate-fade-in">
      <nav className="sticky top-0 z-10 -mx-1 flex flex-wrap gap-2 rounded-[1.5rem] border border-academic-surface-variant bg-white/90 px-4 py-3 shadow-sm backdrop-blur-sm">
        {[
          { id: "section-settings", label: "Ajustes" },
          { id: "section-plazos", label: "Plazos" },
          { id: "section-profesores", label: "Profesores" },
          { id: "section-suite", label: "Suite" },
        ].map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() =>
              document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
            className="rounded-full border border-academic-surface-variant bg-academic-surface-container-lowest px-4 py-1.5 text-xs font-semibold text-academic-on-surface-variant transition-colors hover:border-brand-blue/40 hover:bg-brand-blue/5 hover:text-brand-blue"
          >
            {label}
          </button>
        ))}
      </nav>
      <form className="space-y-8" onSubmit={pc.handleUpdate}>
        {/* Tarjeta: Ajustes Generales */}
        <div id="section-settings" className="rounded-[2.5rem] border border-academic-outline-variant/30 bg-white p-8 shadow-academic scroll-mt-20">
          <div className="flex items-center gap-4 mb-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-maroon/5 text-brand-maroon text-xl">
              <RiSettings4Line />
            </div>
            <div>
              <h4 className="text-xl font-bold tracking-tight text-academic-on-surface">Ajustes Generales</h4>
              <p className="text-sm text-academic-on-surface-variant">Identidad, estado y contexto técnico del proyecto.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <div className="space-y-2">
              <label className="ui-label">Título del proyecto</label>
              <input
                className="input-field h-12"
                required
                value={pc.editForm.title}
                onChange={e => pc.setEditForm((prev: any) => ({ ...prev, title: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="ui-label">Estado operativo</label>
              <select
                className="input-field h-12"
                value={pc.editForm.status}
                onChange={e => pc.setEditForm((prev: any) => ({ ...prev, status: e.target.value as ProjectStatus }))}
              >
                <option value="DRAFT">BORRADOR (No visible para alumnos)</option>
                <option value="ACTIVE">ACTIVO (Visible y entregable)</option>
                <option value="ARCHIVED">ARCHIVED (Solo lectura)</option>
              </select>
            </div>
            <div className="space-y-2 lg:col-span-2">
              <label className="ui-label">Contexto académico y objetivos</label>
              <textarea
                className="input-field min-h-[120px] py-4"
                placeholder="Describe qué deben aprender y entregar los alumnos..."
                value={pc.editForm.contextAcademico}
                onChange={e => pc.setEditForm((prev: any) => ({ ...prev, contextAcademico: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="ui-label">Tipo de stack esperado</label>
              <input
                className="input-field h-12"
                placeholder="Ej. FastAPI + PostgreSQL"
                value={pc.editForm.expectedType}
                onChange={e => pc.setEditForm((prev: any) => ({ ...prev, expectedType: e.target.value }))}
              />
            </div>
            <div className="space-y-2 lg:col-span-2">
              <label className="ui-label">Salida esperada (Oracle)</label>
              <textarea
                className="input-field min-h-[100px] py-4 font-mono text-xs"
                placeholder="Pega aquí la salida exacta que esperas que el programa imprima..."
                value={pc.editForm.expectedOutput}
                onChange={e => pc.setEditForm((prev: any) => ({ ...prev, expectedOutput: e.target.value }))}
              />
              <p className="text-[10px] text-slate-400">El LLM comparará la salida real con este texto para verificar la corrección.</p>
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Intentos por alumno</label>
              <input
                type="number"
                min="1"
                className="input-field h-12"
                value={pc.editForm.maxDeliveriesPerStudent}
                onChange={e => pc.setEditForm((prev: any) => ({ ...prev, maxDeliveriesPerStudent: e.target.value }))}
              />
            </div>
          </div>
        </div>

        {/* Tarjeta: Plazos y Evaluación */}
        <div id="section-plazos" className="rounded-[2.5rem] border border-academic-outline-variant/30 bg-white p-8 shadow-academic scroll-mt-20">
          <div className="flex items-center gap-4 mb-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 text-xl">
              <RiCalendarScheduleLine />
            </div>
            <div>
              <h4 className="text-xl font-bold tracking-tight text-academic-on-surface">Plazos y Evaluación</h4>
              <p className="text-sm text-academic-on-surface-variant">Define cuándo se entrega y bajo qué criterios se califica.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <div className="space-y-2">
              <label className="ui-label">Apertura de entregas</label>
              <input
                type="datetime-local"
                className="input-field h-12"
                value={pc.editForm.opensAt}
                onChange={e => pc.setEditForm((prev: any) => ({ ...prev, opensAt: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="ui-label">Cierre de entregas</label>
              <input
                type="datetime-local"
                className="input-field h-12"
                value={pc.editForm.closesAt}
                onChange={e => pc.setEditForm((prev: any) => ({ ...prev, closesAt: e.target.value }))}
              />
            </div>
            <div className="space-y-2 lg:col-span-2">
              <label className="ui-label">Instrucciones de la rúbrica</label>
              <textarea
                className="input-field min-h-[140px] py-4"
                placeholder="Criterios de evaluación, penalizaciones, etc."
                value={pc.editForm.rubricInstructions}
                onChange={e => pc.setEditForm((prev: any) => ({ ...prev, rubricInstructions: e.target.value }))}
              />
            </div>
          </div>
        </div>

        {/* Tarjeta: Equipo Docente */}
        <div id="section-profesores" className="rounded-[2.5rem] border border-academic-outline-variant/30 bg-white overflow-hidden shadow-academic scroll-mt-20">
          <div className="bg-white px-8 pt-8">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-blue/5 text-brand-blue">
                <RiTeamFill className="text-xl" />
              </div>
              <div>
                <h4 className="text-lg font-bold text-academic-on-surface">Equipo Docente</h4>
                <p className="text-xs text-academic-on-surface-variant">Profesores con permisos administrativos.</p>
              </div>
            </div>
          </div>

          <div className="p-8">
            <div className="space-y-6">
              {/* Add Teacher Selection */}
              <div className="flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1 w-full">
                  <label className="ui-label mb-2 block">
                    Añadir Colaborador
                  </label>
                  <VisualPicker
                    options={pc.allTeachers
                      .filter((t: any) => !selectedCanvasProject.teachers?.some((st: any) => st.id === t.id))
                      .map((teacher: any) => ({
                        id: teacher.id,
                        label: `${teacher.firstName} ${teacher.lastName}`,
                        description: teacher.email,
                        icon: <div className="h-6 w-6 rounded-full bg-academic-surface-container flex items-center justify-center text-[10px] font-bold text-academic-outline uppercase">
                          {teacher.firstName[0]}{teacher.lastName[0]}
                        </div>
                      }))
                    }
                    value={null}
                    onSelect={(id) => pc.handleAddTeacher(selectedCanvasProject.id, id)}
                    placeholder="Buscar profesor por nombre o email..."
                  />
                </div>
                <div className="px-4 py-3 bg-brand-blue/5 rounded-2xl border border-brand-blue/10 text-brand-blue text-[10px] font-bold uppercase tracking-wider h-[46px] flex items-center shrink-0">
                  <RiInformationFill className="mr-2 text-brand-blue-light" />
                  {pc.allTeachers.filter((t: any) => !selectedCanvasProject.teachers?.some((st: any) => st.id === t.id)).length} disponibles
                </div>
              </div>

              {/* Teachers Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
                {selectedCanvasProject.teachers?.map((teacher: any) => (
                  <div
                    key={teacher.id}
                    className="group flex items-center justify-between p-4 rounded-3xl border border-academic-outline-variant/20 bg-academic-surface-container/30 hover:bg-white hover:border-brand-blue/10 hover:shadow-academic transition-all duration-300"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-2xl bg-brand-blue/10 flex items-center justify-center text-xs font-bold text-brand-blue shadow-sm group-hover:scale-110 transition-transform">
                        {teacher.firstName[0]}{teacher.lastName[0]}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-academic-on-surface">{teacher.firstName} {teacher.lastName}</p>
                        <p className="text-[11px] text-academic-on-surface-variant">{teacher.email}</p>
                      </div>
                    </div>

                    {selectedCanvasProject.teachers!.length > 1 && (
                      <button
                        type="button"
                        onClick={() => pc.handleRemoveTeacher(selectedCanvasProject.id, teacher.id)}
                        className="p-2 rounded-xl text-academic-outline hover:text-rose-500 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-all"
                        title="Eliminar del equipo"
                      >
                        <RiCloseLine size={20} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Tarjeta: Suite Docente */}
        <div id="section-suite" className="rounded-[2.5rem] border border-academic-outline-variant/30 bg-white overflow-hidden shadow-academic scroll-mt-20">
          <div className="bg-academic-primary p-8 text-academic-on-primary">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-white text-xl">
                <RiTestTubeLine />
              </div>
              <div>
                <h4 className="text-xl font-bold tracking-tight">Suite de Evaluación Técnica</h4>
                <p className="text-sm text-academic-on-primary/70">Tests automáticos para validar las entregas.</p>
              </div>
            </div>
          </div>

          <div className="p-8 bg-white">
            {pc.testSuiteResult && 'id' in pc.testSuiteResult ? (
              <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-5">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-600 border border-emerald-100 shadow-sm">
                    <RiCheckFill className="text-4xl" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-lg font-bold text-academic-on-surface">{pc.testSuiteResult.logicalName}</p>
                    <div className="flex items-center gap-3 text-sm text-academic-on-surface-variant">
                      <span>{formatBytes(pc.testSuiteResult.sizeBytes)}</span>
                      <span className="h-1 w-1 rounded-full bg-academic-outline-variant/30" />
                      <span>Subido el {new Date(pc.testSuiteResult.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handleOpenPreview}
                  >
                    <RiEyeLine className="text-xl" />
                    Ver tests
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handleDownloadSuite}
                  >
                    <RiFileDownloadLine className="text-xl" />
                    Descargar
                  </button>
                  <div className="h-8 w-px bg-academic-outline-variant/20 mx-2 hidden md:block" />
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={isUploadingSuite}
                    onClick={() => document.getElementById('suite-upload')?.click()}
                  >
                    <RiFolderUploadLine className="text-xl" />
                    {isUploadingSuite ? "Subiendo..." : "Reemplazar Suite"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-[2rem] border-2 border-dashed border-academic-outline-variant/30 bg-academic-surface-container/30 py-16 px-6 text-center">
                <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-white text-academic-outline shadow-sm">
                  <RiFolderUploadLine className="text-4xl" />
                </div>
                <h5 className="text-lg font-bold text-academic-on-surface">No hay suite técnica configurada</h5>
                <p className="mt-2 mb-8 max-w-sm text-sm text-academic-on-surface-variant">
                  Para evaluar automáticamente las entregas, sube una suite de tests compatible con <span className="font-bold text-academic-on-surface">pytest</span>.
                </p>
                <button
                  type="button"
                  className="btn-primary px-10"
                  disabled={isUploadingSuite}
                  onClick={() => document.getElementById('suite-upload')?.click()}
                >
                  {isUploadingSuite ? (
                    <RiLoader4Line className="animate-spin text-xl" />
                  ) : (
                    <RiFolderUploadLine className="text-xl" />
                  )}
                  {isUploadingSuite ? "Subiendo archivo..." : "Subir Suite (.zip)"}
                </button>
              </div>
            )}
            <input
              type="file"
              id="suite-upload"
              className="hidden"
              accept=".zip,.tar.gz"
              onChange={handleFileChange}
            />
          </div>
        </div>

        {/* Acciones de Guardado Final */}
        <div className="flex flex-col items-center justify-between gap-6 pt-10 border-t border-academic-outline-variant/20 sm:flex-row">
          <div className="text-sm text-academic-on-surface-variant">
            Última modificación detectada: <span className="font-bold text-academic-on-surface">Hace unos momentos</span>
          </div>
          <div className="flex flex-wrap gap-4 w-full sm:w-auto">
            <button
              type="submit"
              className="btn-primary px-10 flex-1 sm:flex-none"
            >
              <RiCheckFill className="text-2xl" />
              Guardar configuración
            </button>
            <button
              type="button"
              className="btn-danger px-8 flex-1 sm:flex-none"
              onClick={() => {
                if (selectedCanvasProject) {
                  pc.setDeleteId(selectedCanvasProject.id);
                  pc.setConfirmOpen(true);
                }
              }}
            >
              <RiDeleteBin6Line className="text-xl" />
              Eliminar
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
