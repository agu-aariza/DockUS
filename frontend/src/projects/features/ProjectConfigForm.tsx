import type { FormEvent } from "react";
import { RiCheckFill, RiDeleteBin6Line } from "react-icons/ri";
import { Button } from "../../shared/components/ui/Button";
import { SectionCard } from "../../shared/components/ui/Layout";
import { RubricEditor } from "../components/RubricEditor";
import { ProjectTeachersSection } from "../components/ProjectTeachersSection";
import { ProjectSuiteSection } from "../components/ProjectSuiteSection";
import type { ProjectEntity, ProjectStatus, RubricCriterion } from "../../features/projects/types";
import type { UserEntity } from "../../features/auth/types";
import type { TestSuiteResult } from "../components/ProjectSuiteSection";

export interface EditFormState {
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
}

export interface ProjectConfigFormProps {
  project: ProjectEntity;
  editForm: EditFormState;
  setEditForm: React.Dispatch<React.SetStateAction<EditFormState>>;
  handleUpdate: (event: FormEvent<HTMLFormElement>) => void;
  testSuite: TestSuiteResult;
  isUploadingSuite: boolean;
  onUploadSuite: (file: File) => void;
  onDownloadSuite: () => void;
  onPreviewSuite: () => void;
  allTeachers: UserEntity[];
  onAddTeacher: (projectId: string, teacherId: string) => void;
  onRemoveTeacher: (projectId: string, teacherId: string) => void;
  loadingTeachers?: boolean;
  onDelete: () => void;
}

export function ProjectConfigForm({
  project,
  editForm,
  setEditForm,
  handleUpdate,
  testSuite,
  isUploadingSuite,
  onUploadSuite,
  onDownloadSuite,
  onPreviewSuite,
  allTeachers,
  onAddTeacher,
  onRemoveTeacher,
  onDelete,
}: ProjectConfigFormProps): JSX.Element {
  return (
    <div className="space-y-5">
      <nav className="surface-floating sticky top-0 z-10 -mx-1 flex flex-wrap gap-2 rounded-lg p-2">
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
            className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-600 transition-all hover:border-primary/30 hover:bg-primary-subtle hover:text-primary active:scale-[0.97]"
          >
            {label}
          </button>
        ))}
      </nav>
      <form className="space-y-5" onSubmit={handleUpdate}>
        <div id="section-settings" className="scroll-mt-20">
          <SectionCard
            title="Ajustes Generales"
            description="Identidad, estado y contexto técnico del proyecto."
          >
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <div className="space-y-1.5">
                <label className="label-text">Título del proyecto</label>
                <input
                  className="input-field"
                  required
                  value={editForm.title}
                  onChange={e => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <label className="label-text">Estado operativo</label>
                <select
                  className="input-field"
                  value={editForm.status}
                  onChange={e => setEditForm(prev => ({ ...prev, status: e.target.value as ProjectStatus }))}
                >
                  <option value="DRAFT">BORRADOR (No visible para alumnos)</option>
                  <option value="ACTIVE">ACTIVO (Visible y entregable)</option>
                  <option value="ARCHIVED">ARCHIVADO (Solo lectura)</option>
                </select>
              </div>
              <div className="space-y-1.5 lg:col-span-2">
                <label className="label-text">Contexto académico y objetivos</label>
                <textarea
                  className="input-field min-h-[120px]"
                  placeholder="Describe qué deben aprender y entregar los alumnos..."
                  value={editForm.contextAcademico}
                  onChange={e => setEditForm(prev => ({ ...prev, contextAcademico: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <label className="label-text">Tipo de stack esperado</label>
                <input
                  className="input-field"
                  placeholder="Ej. FastAPI + PostgreSQL"
                  value={editForm.expectedType}
                  onChange={e => setEditForm(prev => ({ ...prev, expectedType: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5 lg:col-span-2">
                <label className="label-text">Salida esperada (Oracle)</label>
                <textarea
                  className="input-field min-h-[100px] font-mono text-xs"
                  placeholder="Pega aquí la salida exacta que esperas que el programa imprima..."
                  value={editForm.expectedOutput}
                  onChange={e => setEditForm(prev => ({ ...prev, expectedOutput: e.target.value }))}
                />
                <p className="text-xs text-slate-400 mt-1">El LLM comparará la salida real con este texto para verificar la corrección.</p>
              </div>
              <div className="space-y-1.5">
                <label className="label-text">Intentos por alumno</label>
                <input
                  type="number"
                  min="1"
                  className="input-field"
                  value={editForm.maxDeliveriesPerStudent}
                  onChange={e => setEditForm(prev => ({ ...prev, maxDeliveriesPerStudent: e.target.value }))}
                />
              </div>
            </div>
          </SectionCard>
        </div>

        <div id="section-plazos" className="scroll-mt-20">
          <SectionCard
            title="Plazos y Evaluación"
            description="Define cuándo se entrega y bajo qué criterios se califica."
          >
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <div className="space-y-1.5">
                <label className="label-text">Apertura de entregas</label>
                <input
                  type="datetime-local"
                  className="input-field"
                  value={editForm.opensAt}
                  onChange={e => setEditForm(prev => ({ ...prev, opensAt: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <label className="label-text">Cierre de entregas</label>
                <input
                  type="datetime-local"
                  className="input-field"
                  value={editForm.closesAt}
                  onChange={e => setEditForm(prev => ({ ...prev, closesAt: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5 lg:col-span-2">
                <label className="label-text">Instrucciones de la rúbrica</label>
                <textarea
                  className="input-field min-h-[140px]"
                  placeholder="Criterios de evaluación, penalizaciones, etc."
                  value={editForm.rubricInstructions}
                  onChange={e => setEditForm(prev => ({ ...prev, rubricInstructions: e.target.value }))}
                />
              </div>
              <div className="lg:col-span-2">
                <RubricEditor
                  criteria={editForm.rubricCriteria}
                  onChange={(rubricCriteria) => setEditForm(prev => ({ ...prev, rubricCriteria }))}
                />
              </div>
            </div>
          </SectionCard>
        </div>

        <div id="section-profesores" className="scroll-mt-20">
          <ProjectTeachersSection
            projectId={project.id}
            teachers={project.teachers ?? []}
            allTeachers={allTeachers}
            onAddTeacher={onAddTeacher}
            onRemoveTeacher={onRemoveTeacher}
          />
        </div>

        <div id="section-suite" className="scroll-mt-20">
          <ProjectSuiteSection
            testSuite={testSuite}
            isUploading={isUploadingSuite}
            onUpload={onUploadSuite}
            onDownload={onDownloadSuite}
            onPreview={onPreviewSuite}
          />
        </div>

        <div className="flex flex-col items-center justify-between gap-4 pt-6 border-t border-app-border sm:flex-row">
          <div className="text-xs font-semibold text-slate-400">
            Última modificación detectada: <span className="font-semibold text-slate-900">Hace unos momentos</span>
          </div>
          <div className="flex flex-wrap gap-3 w-full sm:w-auto">
            <Button
              type="submit"
              variant="primary"
              className="flex-1 sm:flex-none shadow-sm"
            >
              <RiCheckFill />
              Guardar configuración
            </Button>
            <Button
              type="button"
              variant="danger"
              className="flex-1 sm:flex-none shadow-sm"
              onClick={onDelete}
            >
              <RiDeleteBin6Line />
              Eliminar
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
