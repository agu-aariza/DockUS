import { RiCloseLine, RiInformationFill } from "react-icons/ri";
import { VisualPicker } from "../../shared/components/ui/VisualPicker";
import { SectionCard } from "../../shared/components/ui/Layout";
import type { UserEntity } from "../../features/auth/types";

export interface ProjectTeachersSectionProps {
  projectId: string;
  teachers: UserEntity[];
  allTeachers: UserEntity[];
  onSearchTeachers?: (query?: string) => void;
  onAddTeacher: (projectId: string, teacherId: string) => void;
  onRemoveTeacher: (projectId: string, teacherId: string) => void;
  isLoading?: boolean;
}

export function ProjectTeachersSection({
  projectId,
  teachers,
  allTeachers,
  onSearchTeachers,
  onAddTeacher,
  onRemoveTeacher,
}: ProjectTeachersSectionProps): JSX.Element {
  const availableTeachers = allTeachers.filter(
    (teacher) => !teachers.some((assigned) => assigned.id === teacher.id),
  );

  return (
    <SectionCard
      title="Equipo Docente"
      description="Profesores con permisos administrativos."
    >
      <div className="space-y-5">
        <div className="flex flex-col md:flex-row gap-3 items-end">
          <div className="flex-1 w-full">
            <label htmlFor="project-teachers-picker" className="label-text">
              Añadir Colaborador
            </label>
            <VisualPicker
              id="project-teachers-picker"
              options={availableTeachers.map(teacher => ({
                id: teacher.id,
                label: `${teacher.firstName} ${teacher.lastName}`,
                description: teacher.email,
                icon: <div className="flex h-6 w-6 items-center justify-center rounded-full border border-app-border bg-slate-100 text-[10px] font-semibold uppercase text-slate-500">
                  {teacher.firstName[0]}{teacher.lastName[0]}
                </div>,
              }))}
              value={null}
              onSelect={(id) => onAddTeacher(projectId, id)}
              onSearchChange={onSearchTeachers}
              placeholder="Buscar profesor por nombre o email..."
            />
          </div>
          <div className="px-3.5 py-2 bg-primary-subtle rounded-xl border border-primary/10 text-primary text-xs font-semibold h-10 flex items-center shrink-0 shadow-sm">
            <RiInformationFill className="mr-1.5" />
            {availableTeachers.length} disponibles
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {teachers.map((teacher) => (
            <div
              key={teacher.id}
              className="group flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-slate-300 hover:shadow-sm transition-all duration-200"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">
                  {teacher.firstName[0]}{teacher.lastName[0]}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{teacher.firstName} {teacher.lastName}</p>
                  <p className="text-xs text-slate-400">{teacher.email}</p>
                </div>
              </div>

              {teachers.length > 1 && (
                <button
                  type="button"
                  onClick={() => onRemoveTeacher(projectId, teacher.id)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-danger-600 hover:bg-danger-50 opacity-0 group-hover:opacity-100 transition-all focus-visible:ring-2 focus-visible:ring-danger-400/50 focus-visible:outline-none"
                  title="Eliminar del equipo"
                  aria-label="Eliminar del equipo"
                >
                  <RiCloseLine size={18} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </SectionCard>
  );
}
