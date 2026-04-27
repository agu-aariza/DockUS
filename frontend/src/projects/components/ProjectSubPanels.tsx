import { RiTeamLine, RiRefreshLine, RiTestTubeLine, RiDeleteBin6Line, RiSettings4Line } from "react-icons/ri";
import type {
  CourseGroupEntity,
  GroupEnrollmentEntity,
  ProjectEntity,
  ProjectAssignmentEntity,
  UserEntity,
} from "../../shared/types";

function formatOptionalDate(value?: string | null): string {
  return value ? new Date(value).toLocaleString("es-ES") : "Sin definir";
}

interface ProjectDetailsProps {
  project: ProjectEntity;
  onRefreshAssignments: () => void;
  onManageAssignments: () => void;
  onFetchTestSuite: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function ProjectDetails({
  project,
  onRefreshAssignments,
  onManageAssignments,
  onFetchTestSuite,
  onEdit,
  onDelete,
}: ProjectDetailsProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Estado actual</span>
          <div className="text-sm font-bold text-slate-900">{project.status}</div>
        </div>
        <div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Máximo de entregas</span>
          <div className="text-sm font-bold text-slate-900">{project.maxDeliveriesPerStudent}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Apertura</span>
          <div className="text-sm font-bold text-slate-900">{formatOptionalDate(project.opensAt)}</div>
        </div>
        <div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Cierre</span>
          <div className="text-sm font-bold text-slate-900">{formatOptionalDate(project.closesAt)}</div>
        </div>
      </div>

      <div>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Tipo esperado</span>
        <div className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-lg border border-slate-100">
          {project.expectedType || "No se ha definido un tipo esperado para el proyecto."}
        </div>
      </div>

      <div>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Contexto académico</span>
        <div className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-lg border border-slate-100">
          {project.contextAcademico || "No hay una descripción académica registrada para este proyecto."}
        </div>
      </div>

      <div className="flex flex-col gap-2 pt-4 border-t border-slate-100">
        <button
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-lg font-bold text-sm hover:bg-slate-800 transition shadow-sm"
          onClick={onManageAssignments}
        >
          <RiTeamLine /> Asignar alumnos
        </button>
        <button
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 transition shadow-sm"
          onClick={onEdit}
        >
          <RiSettings4Line /> Editar proyecto
        </button>
        <div className="flex gap-2">
          <button
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-slate-300 rounded-lg font-bold text-sm text-slate-700 hover:bg-slate-50 transition shadow-sm"
            onClick={onRefreshAssignments}
          >
            <RiRefreshLine /> Actualizar
          </button>
          <button
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-slate-300 rounded-lg font-bold text-sm text-slate-700 hover:bg-slate-50 transition shadow-sm"
            onClick={onFetchTestSuite}
          >
            <RiTestTubeLine /> Suite docente
          </button>
        </div>
      </div>

      {/* Danger zone */}
      <div className="pt-4 border-t border-dashed border-slate-200">
        <button
          className="flex items-center gap-2 w-full justify-center px-4 py-2.5 rounded-lg border border-rose-200 text-sm font-medium text-rose-600 hover:bg-rose-50 hover:border-rose-300 transition"
          onClick={onDelete}
        >
          <RiDeleteBin6Line />
          Eliminar proyecto
        </button>
      </div>
    </div>
  );
}

type GroupFormState = {
  name: string;
  code: string;
  description: string;
};

interface ProjectAssignmentManagerProps {
  project: ProjectEntity;
  students: UserEntity[];
  groups: CourseGroupEntity[];
  focusedGroup: CourseGroupEntity | null;
  groupEnrollments: GroupEnrollmentEntity[];
  assignments: ProjectAssignmentEntity[];
  selectedStudentIds: string[];
  bulkStudentEmails: string;
  groupStudentSearch: string;
  selectedGroupIds: string[];
  selectedGroupStudentIds: string[];
  bulkGroupStudentEmails: string;
  groupForm: GroupFormState;
  preparedStudentCount: number;
  searchTerm: string;
  loadingGroups: boolean;
  assignmentBusy: string | null;
  onSearchChange: (value: string) => void;
  onGroupStudentSearchChange: (value: string) => void;
  onBulkEmailChange: (value: string) => void;
  onBulkGroupEmailChange: (value: string) => void;
  onImportCsvFile: (file: File | null) => void;
  onImportGroupCsvFile: (file: File | null) => void;
  onSelectionChange: (studentIds: string[]) => void;
  onGroupSelectionChange: (groupIds: string[]) => void;
  onFocusedGroupChange: (groupId: string) => void;
  onGroupStudentSelectionChange: (studentIds: string[]) => void;
  onGroupFormChange: (patch: Partial<GroupFormState>) => void;
  onCreateGroup: () => void;
  onAssignSelected: () => void;
  onAssignGroups: () => void;
  onEnrollGroupStudents: () => void;
  onRefreshGroups: () => void;
  onRefreshGroupEnrollments: () => void;
  onRefreshAssignments: () => void;
  onRevokeGroupEnrollment: (enrollmentId: string) => void;
  onRevokeAssignment: (assignmentId: string, studentId: string) => void;
}

export function ProjectAssignmentManager({
  project,
  students,
  groups,
  focusedGroup,
  groupEnrollments,
  assignments,
  selectedStudentIds,
  bulkStudentEmails,
  groupStudentSearch,
  selectedGroupIds,
  selectedGroupStudentIds,
  bulkGroupStudentEmails,
  groupForm,
  preparedStudentCount,
  searchTerm,
  loadingGroups,
  assignmentBusy,
  onSearchChange,
  onGroupStudentSearchChange,
  onBulkEmailChange,
  onBulkGroupEmailChange,
  onImportCsvFile,
  onImportGroupCsvFile,
  onSelectionChange,
  onGroupSelectionChange,
  onFocusedGroupChange,
  onGroupStudentSelectionChange,
  onGroupFormChange,
  onCreateGroup,
  onAssignSelected,
  onAssignGroups,
  onEnrollGroupStudents,
  onRefreshGroups,
  onRefreshGroupEnrollments,
  onRefreshAssignments,
  onRevokeGroupEnrollment,
  onRevokeAssignment,
}: ProjectAssignmentManagerProps) {
  const assignedStudentIds = new Set(assignments.map((assignment) => assignment.studentId));
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const availableStudents = students.filter(
    (student) => !assignedStudentIds.has(student.id),
  );
  const visibleStudents = availableStudents.filter((student) => {
    if (!normalizedSearch) return true;
    return [student.firstName, student.lastName, student.email]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(normalizedSearch));
  });
  const visibleStudentIds = visibleStudents.map((student) => student.id);
  const normalizedGroupStudentSearch = groupStudentSearch.trim().toLowerCase();
  const activeGroupEnrollments = groupEnrollments.filter((enrollment) => !enrollment.revokedAt);
  const enrolledGroupStudentIds = new Set(
    activeGroupEnrollments.map((enrollment) => enrollment.studentId),
  );
  const groupAvailableStudents = students.filter(
    (student) => !enrolledGroupStudentIds.has(student.id),
  );
  const visibleGroupStudents = groupAvailableStudents.filter((student) => {
    if (!normalizedGroupStudentSearch) return true;
    return [student.firstName, student.lastName, student.email]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(normalizedGroupStudentSearch));
  });
  const visibleGroupStudentIds = visibleGroupStudents.map((student) => student.id);
  const preparedGroupStudentCount =
    selectedGroupStudentIds.length +
    bulkGroupStudentEmails
      .split(/[\n,;]+/)
      .map((value) => value.trim())
      .filter(Boolean).length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
            Proyecto activo
          </div>
          <div className="mt-2 text-lg font-semibold tracking-tight text-slate-950">
            {project.title}
          </div>
          <div className="mt-2 text-sm text-slate-500">
            Estado {project.status} · máximo {project.maxDeliveriesPerStudent} entregas por alumno
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
            Ya asignados
          </div>
          <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            {assignments.length}
          </div>
          <div className="mt-2 text-sm text-slate-500">
            Estudiantes vinculados actualmente al proyecto.
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
            Pendientes de asignar
          </div>
          <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            {preparedStudentCount}
          </div>
          <div className="mt-2 text-sm text-slate-500">
            Selección preparada para la próxima reasignación.
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
            Grupos listos
          </div>
          <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            {selectedGroupIds.length}
          </div>
          <div className="mt-2 text-sm text-slate-500">
            Grupos preparados para asignación masiva al proyecto.
          </div>
        </div>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="panel-header">
          <div>
            <h3 className="text-lg font-semibold tracking-tight text-slate-950">
              Grupos docentes
            </h3>
            <p className="section-copy">
              Crea grupos, matricula alumnos y asigna cohortes enteras al proyecto sin salir del contexto.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
              {groups.length} grupos
            </span>
            <button className="btn-secondary" onClick={onRefreshGroups}>
              Actualizar
            </button>
          </div>
        </div>

        <div className="grid gap-6 p-6 xl:grid-cols-[1.02fr_1.18fr]">
          <div className="space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col gap-4">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">
                    Nuevo grupo
                  </h4>
                  <p className="mt-1 text-sm text-slate-500">
                    Úsalo para organizar clases, laboratorios o convocatorias antes de asignar el proyecto.
                  </p>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    className="input-field"
                    value={groupForm.name}
                    onChange={(event) => onGroupFormChange({ name: event.target.value })}
                    placeholder="Ej. 1º DAW - Grupo A"
                  />
                  <input
                    className="input-field"
                    value={groupForm.code}
                    onChange={(event) => onGroupFormChange({ code: event.target.value })}
                    placeholder="Código corto (opcional)"
                  />
                </div>
                <textarea
                  className="input-field min-h-[90px]"
                  value={groupForm.description}
                  onChange={(event) => onGroupFormChange({ description: event.target.value })}
                  placeholder="Descripción opcional del grupo"
                />
                <button
                  className="btn-primary self-start"
                  onClick={onCreateGroup}
                  disabled={!groupForm.name.trim() || assignmentBusy === "group:create"}
                >
                  {assignmentBusy === "group:create" ? "Creando grupo..." : "Crear grupo"}
                </button>
              </div>
            </div>

            {loadingGroups ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                Cargando grupos docentes...
              </div>
            ) : groups.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                Todavía no hay grupos creados. Crea el primero para empezar a asignar cohortes completas.
              </div>
            ) : (
              <div className="grid gap-3">
                {groups.map((group) => {
                  const isFocused = focusedGroup?.id === group.id;
                  const isSelected = selectedGroupIds.includes(group.id);
                  return (
                    <article
                      key={group.id}
                      className={`rounded-2xl border p-4 transition ${
                        isFocused
                          ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                          : "border-slate-200 bg-white"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <button
                          type="button"
                          className="min-w-0 text-left"
                          onClick={() => onFocusedGroupChange(group.id)}
                        >
                          <div className="truncate text-sm font-semibold">
                            {group.name}
                          </div>
                          <div
                            className={`mt-1 text-sm ${
                              isFocused ? "text-slate-200" : "text-slate-500"
                            }`}
                          >
                            {group.code || "Sin código"} · {group.studentCount} alumno{group.studentCount === 1 ? "" : "s"}
                          </div>
                        </button>
                        <button
                          type="button"
                          className={`rounded-full border px-3 py-1 text-xs font-medium ${
                            isSelected
                              ? isFocused
                                ? "border-white/20 bg-white/10 text-white"
                                : "border-slate-900 bg-slate-900 text-white"
                              : isFocused
                                ? "border-white/25 bg-transparent text-white"
                                : "border-slate-200 bg-slate-50 text-slate-600"
                          }`}
                          onClick={() =>
                            onGroupSelectionChange(
                              isSelected
                                ? selectedGroupIds.filter((candidateId) => candidateId !== group.id)
                                : [...selectedGroupIds, group.id],
                            )
                          }
                        >
                          {isSelected ? "Listo" : "Marcar"}
                        </button>
                      </div>
                      {group.description ? (
                        <p
                          className={`mt-3 text-sm leading-6 ${
                            isFocused ? "text-slate-100" : "text-slate-600"
                          }`}
                        >
                          {group.description}
                        </p>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            )}

            <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-4">
              <button
                className="btn-primary"
                onClick={onAssignGroups}
                disabled={selectedGroupIds.length === 0 || assignmentBusy === "assign:groups"}
              >
                {assignmentBusy === "assign:groups"
                  ? "Asignando grupos..."
                  : `Asignar ${selectedGroupIds.length || ""} grupo${
                      selectedGroupIds.length === 1 ? "" : "s"
                    } al proyecto`}
              </button>
              <button
                className="btn-secondary"
                onClick={() => onGroupSelectionChange([])}
                disabled={selectedGroupIds.length === 0}
              >
                Limpiar selección de grupos
              </button>
            </div>
          </div>

          <div className="space-y-5">
            {!focusedGroup ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-12 text-center text-sm text-slate-500">
                Selecciona un grupo para matricular alumnos y revisar sus miembros.
              </div>
            ) : (
              <>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <h4 className="text-lg font-semibold tracking-tight text-slate-950">
                        {focusedGroup.name}
                      </h4>
                      <p className="mt-1 text-sm text-slate-500">
                        {focusedGroup.code || "Sin código"} · {focusedGroup.studentCount} alumno{focusedGroup.studentCount === 1 ? "" : "s"} activos
                      </p>
                    </div>
                    <button className="btn-secondary" onClick={onRefreshGroupEnrollments}>
                      Refrescar matrículas
                    </button>
                  </div>
                  {focusedGroup.description ? (
                    <p className="mt-3 text-sm leading-6 text-slate-600">
                      {focusedGroup.description}
                    </p>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto]">
                    <input
                      className="input-field"
                      value={groupStudentSearch}
                      onChange={(event) => onGroupStudentSearchChange(event.target.value)}
                      placeholder="Filtra por nombre o correo"
                    />
                    <button
                      className="btn-secondary"
                      onClick={() =>
                        onGroupStudentSelectionChange(
                          Array.from(new Set([...selectedGroupStudentIds, ...visibleGroupStudentIds])),
                        )
                      }
                      disabled={visibleGroupStudentIds.length === 0}
                    >
                      Seleccionar visibles
                    </button>
                    <button
                      className="btn-secondary"
                      onClick={() => onGroupStudentSelectionChange([])}
                      disabled={selectedGroupStudentIds.length === 0}
                    >
                      Limpiar
                    </button>
                  </div>

                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <h4 className="text-sm font-semibold text-slate-900">
                          Matriculación por correo
                        </h4>
                        <p className="mt-1 text-sm text-slate-500">
                          Pega emails separados por línea, coma o punto y coma. También puedes importar un CSV simple.
                        </p>
                      </div>
                      <label className="btn-secondary cursor-pointer">
                        Importar CSV
                        <input
                          type="file"
                          accept=".csv,.txt"
                          className="hidden"
                          onChange={(event) => {
                            onImportGroupCsvFile(event.target.files?.[0] ?? null);
                            event.currentTarget.value = "";
                          }}
                        />
                      </label>
                    </div>
                    <textarea
                      className="input-field mt-4 min-h-[120px]"
                      value={bulkGroupStudentEmails}
                      onChange={(event) => onBulkGroupEmailChange(event.target.value)}
                      placeholder="alumno1@centro.es&#10;alumno2@centro.es"
                    />
                  </div>

                  {visibleGroupStudents.length === 0 ? (
                    <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                      {groupAvailableStudents.length === 0
                        ? "Todos los alumnos disponibles ya están matriculados en este grupo."
                        : "No hay coincidencias con el filtro actual."}
                    </div>
                  ) : (
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {visibleGroupStudents.map((student) => {
                        const checked = selectedGroupStudentIds.includes(student.id);
                        const studentName =
                          [student.firstName, student.lastName]
                            .filter(Boolean)
                            .join(" ")
                            .trim() || student.email;

                        return (
                          <button
                            key={student.id}
                            type="button"
                            className={`rounded-2xl border px-4 py-4 text-left transition ${
                              checked
                                ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                                : "border-slate-200 bg-white hover:border-slate-300"
                            }`}
                            onClick={() =>
                              onGroupStudentSelectionChange(
                                checked
                                  ? selectedGroupStudentIds.filter((candidateId) => candidateId !== student.id)
                                  : [...selectedGroupStudentIds, student.id],
                              )
                            }
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="truncate text-sm font-semibold">
                                  {studentName}
                                </div>
                                <div
                                  className={`mt-1 truncate text-sm ${
                                    checked ? "text-slate-200" : "text-slate-500"
                                  }`}
                                >
                                  {student.email}
                                </div>
                              </div>
                              <span
                                className={`rounded-full border px-2 py-1 text-[11px] font-medium ${
                                  checked
                                    ? "border-white/25 bg-white/10 text-white"
                                    : "border-slate-200 bg-slate-50 text-slate-600"
                                }`}
                              >
                                {checked ? "Incluido" : "Disponible"}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap gap-3 border-t border-slate-100 pt-4">
                    <button
                      className="btn-primary"
                      onClick={onEnrollGroupStudents}
                      disabled={preparedGroupStudentCount === 0 || assignmentBusy === "group:enroll"}
                    >
                      {assignmentBusy === "group:enroll"
                        ? "Matriculando..."
                        : `Matricular ${preparedGroupStudentCount || ""} alumno${
                            preparedGroupStudentCount === 1 ? "" : "s"
                          }`}
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Matrículas activas
                      </h4>
                      <p className="mt-2 text-sm text-slate-500">
                        Alumnos actualmente incluidos en el grupo seleccionado.
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                      {activeGroupEnrollments.length}
                    </span>
                  </div>

                  {activeGroupEnrollments.length === 0 ? (
                    <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                      Este grupo todavía no tiene alumnos matriculados.
                    </div>
                  ) : (
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {activeGroupEnrollments.map((enrollment) => (
                        <article
                          key={enrollment.id}
                          className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold text-slate-950">
                                {enrollment.studentName}
                              </div>
                              <div className="mt-1 truncate text-sm text-slate-500">
                                {enrollment.studentEmail}
                              </div>
                            </div>
                            <button
                              type="button"
                              className="rounded-full border border-rose-200 bg-white px-3 py-1 text-xs font-medium text-rose-700 transition hover:bg-rose-50"
                              onClick={() => onRevokeGroupEnrollment(enrollment.id)}
                              disabled={assignmentBusy === `group:revoke:${enrollment.id}`}
                            >
                              {assignmentBusy === `group:revoke:${enrollment.id}`
                                ? "Retirando..."
                                : "Retirar"}
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.02fr_1.18fr]">
        <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="panel-header">
            <div>
              <h3 className="text-lg font-semibold tracking-tight text-slate-950">
                Alumnos disponibles
              </h3>
              <p className="section-copy">
                Selecciona los estudiantes que quieras incorporar a este proyecto.
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
              {visibleStudents.length} visibles
            </span>
          </div>

          <div className="space-y-4 p-6">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto]">
              <input
                className="input-field"
                value={searchTerm}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Filtra por nombre o correo"
              />
              <button
                className="btn-secondary"
                onClick={() =>
                  onSelectionChange(
                    Array.from(new Set([...selectedStudentIds, ...visibleStudentIds])),
                  )
                }
                disabled={visibleStudentIds.length === 0}
              >
                Seleccionar visibles
              </button>
              <button
                className="btn-secondary"
                onClick={() => onSelectionChange([])}
                disabled={selectedStudentIds.length === 0}
              >
                Limpiar
              </button>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <h4 className="text-sm font-semibold text-slate-900">
                    Asignación masiva por correo
                  </h4>
                  <p className="mt-1 text-sm text-slate-500">
                    Pega emails separados por línea, coma o punto y coma. También puedes importar un CSV simple.
                  </p>
                </div>
                <label className="btn-secondary cursor-pointer">
                  Importar CSV
                  <input
                    type="file"
                    accept=".csv,.txt"
                    className="hidden"
                    onChange={(event) => {
                      onImportCsvFile(event.target.files?.[0] ?? null);
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
              </div>
              <textarea
                className="input-field mt-4 min-h-[120px]"
                value={bulkStudentEmails}
                onChange={(event) => onBulkEmailChange(event.target.value)}
                placeholder="alumno1@centro.es&#10;alumno2@centro.es"
              />
            </div>

            {visibleStudents.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                {availableStudents.length === 0
                  ? "Todos los alumnos disponibles ya están asignados a este proyecto."
                  : "No hay coincidencias con el filtro actual."}
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {visibleStudents.map((student) => {
                  const checked = selectedStudentIds.includes(student.id);
                  const studentName =
                    [student.firstName, student.lastName]
                      .filter(Boolean)
                      .join(" ")
                      .trim() || student.email;

                  return (
                    <button
                      key={student.id}
                      type="button"
                      className={`rounded-2xl border px-4 py-4 text-left transition ${
                        checked
                          ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                      onClick={() =>
                        onSelectionChange(
                          checked
                            ? selectedStudentIds.filter((candidateId) => candidateId !== student.id)
                            : [...selectedStudentIds, student.id],
                        )
                      }
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold">
                            {studentName}
                          </div>
                          <div
                            className={`mt-1 truncate text-sm ${
                              checked ? "text-slate-200" : "text-slate-500"
                            }`}
                          >
                            {student.email}
                          </div>
                        </div>
                        <span
                          className={`rounded-full border px-2 py-1 text-[11px] font-medium ${
                            checked
                              ? "border-white/25 bg-white/10 text-white"
                              : "border-slate-200 bg-slate-50 text-slate-600"
                          }`}
                        >
                          {checked ? "Incluido" : "Disponible"}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-4">
              <button
                className="btn-primary"
                onClick={onAssignSelected}
                disabled={preparedStudentCount === 0 || assignmentBusy === "assign"}
              >
                {assignmentBusy === "assign"
                  ? "Asignando alumnos..."
                  : `Asignar ${preparedStudentCount || ""} alumno${
                      preparedStudentCount === 1 ? "" : "s"
                    }`}
              </button>
              <button className="btn-secondary" onClick={onRefreshAssignments}>
                Actualizar listado
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="panel-header">
            <div>
              <h3 className="text-lg font-semibold tracking-tight text-slate-950">
                Asignaciones activas
              </h3>
              <p className="section-copy">
                Controla quién forma parte del proyecto y retira alumnos cuando necesites reasignarlos.
              </p>
            </div>
          </div>

          <div className="space-y-5 p-6">
            {assignments.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                Todavía no hay estudiantes asignados a este proyecto.
              </div>
            ) : (
              <>
                <div className="grid gap-3 lg:grid-cols-2">
                  {assignments.map((assignment) => (
                    <article
                      key={assignment.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-slate-950">
                            {assignment.studentName}
                          </div>
                          <div className="mt-1 truncate text-sm text-slate-500">
                            {assignment.studentEmail}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="rounded-full border border-rose-200 bg-white px-3 py-1 text-xs font-medium text-rose-700 transition hover:bg-rose-50"
                          onClick={() =>
                            onRevokeAssignment(assignment.id, assignment.studentId)
                          }
                          disabled={assignmentBusy === `revoke:${assignment.id}`}
                        >
                          {assignmentBusy === `revoke:${assignment.id}`
                            ? "Retirando..."
                            : "Retirar"}
                        </button>
                      </div>

                      <div className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-3">
                        <div>Entregas {assignment.deliveryCount}</div>
                        <div>Restantes {assignment.remainingDeliveries}</div>
                        <div>
                          Requisito {assignment.minimumRequirementMet ? "cumplido" : "pendiente"}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>

              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
