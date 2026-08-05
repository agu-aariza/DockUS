/**
 * @fileoverview Vista y gestión de proyectos académicos (ProjectConfigForm).
 *
 * @module ProjectConfigForm
 */

import { useState, type FormEvent, type ReactNode } from "react";
import { RiArrowDownSLine, RiCheckFill, RiDeleteBin6Line } from "react-icons/ri";
import { Button } from "../../shared/components/ui/Button";
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
  onSearchTeachers?: (query?: string) => void;
  onAddTeacher: (projectId: string, teacherId: string) => void;
  onRemoveTeacher: (projectId: string, teacherId: string) => void;
  loadingTeachers?: boolean;
  onDelete: () => void;
}

const SECTIONS = [
  { id: "section-settings", label: "Ajustes" },
  { id: "section-plazos", label: "Plazos" },
  { id: "section-profesores", label: "Profesores" },
  { id: "section-suite", label: "Suite" },
] as const;

// Desplegable, no una pared de cinco tarjetas siempre abiertas: solo la
// primera sección arranca visible y las píldoras de arriba abren + desplazan
// a la que se pulse, en vez de solo desplazar sobre contenido ya visible.
function ConfigSection({
  id,
  title,
  description,
  isOpen,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  description: string;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div
      id={id}
      className="scroll-mt-20 overflow-hidden rounded-lg border border-app-border bg-app-surface shadow-sm"
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left"
      >
        <div>
          <h3 className="text-sm font-semibold text-app-text">{title}</h3>
          <p className="mt-0.5 text-xs text-app-text-muted">{description}</p>
        </div>
        <RiArrowDownSLine
          className={`shrink-0 text-lg text-app-text-muted transition-transform duration-200 motion-reduce:transition-none ${
            isOpen ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        />
      </button>
      {isOpen && (
        <div className="border-t border-app-border p-4 motion-rise-in">
          {children}
        </div>
      )}
    </div>
  );
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
  onSearchTeachers,
  onAddTeacher,
  onRemoveTeacher,
  onDelete,
}: ProjectConfigFormProps): JSX.Element {
  const [openSections, setOpenSections] = useState<Set<string>>(
    () => new Set(["section-settings"]),
  );

  const toggleSection = (id: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const openAndScrollTo = (id: string) => {
    setOpenSections((prev) => new Set(prev).add(id));
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="space-y-5">
      <nav className="surface-floating sticky top-0 z-10 -mx-1 flex flex-wrap gap-2 rounded-lg p-2">
        {SECTIONS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => openAndScrollTo(id)}
            className="rounded-xl border border-app-border bg-app-bg-subtle px-3.5 py-2 text-xs font-semibold text-app-text-secondary transition-all hover:border-primary/30 hover:bg-primary-subtle hover:text-primary active:scale-[0.97]"
          >
            {label}
          </button>
        ))}
      </nav>
      <form className="space-y-5" onSubmit={handleUpdate}>
        <ConfigSection
          id="section-settings"
          title="Ajustes Generales"
          description="Identidad, estado y contexto técnico del proyecto."
          isOpen={openSections.has("section-settings")}
          onToggle={() => toggleSection("section-settings")}
        >
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="project-config-title" className="label-text">Título del proyecto</label>
              <input
                id="project-config-title"
                className="input-field"
                required
                value={editForm.title}
                onChange={e => setEditForm(prev => ({ ...prev, title: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="project-config-status" className="label-text">Estado operativo</label>
              <select
                id="project-config-status"
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
              <label htmlFor="project-config-context" className="label-text">Contexto académico y objetivos</label>
              <textarea
                id="project-config-context"
                className="input-field min-h-[120px]"
                placeholder="Describe qué deben aprender y entregar los alumnos..."
                value={editForm.contextAcademico}
                onChange={e => setEditForm(prev => ({ ...prev, contextAcademico: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="project-config-expected-type" className="label-text">Tipo de stack esperado</label>
              <input
                id="project-config-expected-type"
                className="input-field"
                placeholder="Ej. FastAPI + PostgreSQL"
                value={editForm.expectedType}
                onChange={e => setEditForm(prev => ({ ...prev, expectedType: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5 lg:col-span-2">
              <label htmlFor="project-config-expected-output" className="label-text">Salida esperada (Oracle)</label>
              <textarea
                id="project-config-expected-output"
                className="input-field min-h-[100px] font-mono text-xs"
                placeholder="Pega aquí la salida exacta que esperas que el programa imprima..."
                value={editForm.expectedOutput}
                onChange={e => setEditForm(prev => ({ ...prev, expectedOutput: e.target.value }))}
              />
              <p className="text-xs text-app-text-muted mt-1">El LLM comparará la salida real con este texto para verificar la corrección.</p>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="project-config-max-deliveries" className="label-text">Intentos por alumno</label>
              <input
                id="project-config-max-deliveries"
                type="number"
                min="1"
                className="input-field"
                value={editForm.maxDeliveriesPerStudent}
                onChange={e => setEditForm(prev => ({ ...prev, maxDeliveriesPerStudent: e.target.value }))}
              />
            </div>
          </div>
        </ConfigSection>

        <ConfigSection
          id="section-plazos"
          title="Plazos y Evaluación"
          description="Define cuándo se entrega y bajo qué criterios se califica."
          isOpen={openSections.has("section-plazos")}
          onToggle={() => toggleSection("section-plazos")}
        >
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="project-config-opens-at" className="label-text">Apertura de entregas</label>
              <input
                id="project-config-opens-at"
                type="datetime-local"
                className="input-field"
                value={editForm.opensAt}
                onChange={e => setEditForm(prev => ({ ...prev, opensAt: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="project-config-closes-at" className="label-text">Cierre de entregas</label>
              <input
                id="project-config-closes-at"
                type="datetime-local"
                className="input-field"
                value={editForm.closesAt}
                onChange={e => setEditForm(prev => ({ ...prev, closesAt: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5 lg:col-span-2">
              <label htmlFor="project-config-rubric-instructions" className="label-text">Instrucciones de la rúbrica</label>
              <textarea
                id="project-config-rubric-instructions"
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
        </ConfigSection>

        <ConfigSection
          id="section-profesores"
          title="Equipo Docente"
          description="Profesores con permisos administrativos."
          isOpen={openSections.has("section-profesores")}
          onToggle={() => toggleSection("section-profesores")}
        >
          <ProjectTeachersSection
            projectId={project.id}
            teachers={project.teachers ?? []}
            allTeachers={allTeachers}
            onSearchTeachers={onSearchTeachers}
            onAddTeacher={onAddTeacher}
            onRemoveTeacher={onRemoveTeacher}
          />
        </ConfigSection>

        <ConfigSection
          id="section-suite"
          title="Suite de Evaluación Técnica"
          description="Tests automáticos para validar las entregas."
          isOpen={openSections.has("section-suite")}
          onToggle={() => toggleSection("section-suite")}
        >
          <ProjectSuiteSection
            testSuite={testSuite}
            isUploading={isUploadingSuite}
            onUpload={onUploadSuite}
            onDownload={onDownloadSuite}
            onPreview={onPreviewSuite}
          />
        </ConfigSection>

        <div className="flex flex-col items-center justify-between gap-4 pt-6 border-t border-app-border sm:flex-row">
          <div className="data-meta font-semibold">
            Última modificación detectada: <span className="font-semibold text-app-text">Hace unos momentos</span>
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
