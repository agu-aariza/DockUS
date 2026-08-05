import {
  RiAddLine,
  RiCheckLine,
  RiGroupLine,
  RiRefreshLine,
  RiUserAddLine,
  RiUserUnfollowLine,
} from "react-icons/ri";
import type { GroupEnrollmentEntity } from "../../features/groups/types";
import type { UserEntity } from "../../features/auth/types";
import type { PaginatedMeta } from "../../shared/types";
import { EmptyState } from "../../shared/components/EmptyState";
import { Skeleton } from "../../shared/components/Skeleton";
import { Button } from "../../shared/components/ui/Button";
import { SectionCard } from "../../shared/components/ui/Layout";
import { SearchInput } from "../../shared/components/ui/SearchInput";
import { Tabs } from "../../shared/components/ui/Tabs";

export type RosterView = "enrolled" | "directory";

interface GroupRosterProps {
  view: RosterView;
  enrollments: GroupEnrollmentEntity[];
  students: UserEntity[];
  studentMeta: PaginatedMeta | null;
  studentSearch: string;
  studentPage: number;
  enrollmentsLoading: boolean;
  studentsLoading: boolean;
  enrollmentsError: string | null;
  studentsError: string | null;
  isEnrollingStudent: (_studentId: string) => boolean;
  isRevokingEnrollment: (_enrollmentId: string) => boolean;
  onViewChange: (_view: RosterView) => void;
  onStudentSearchChange: (_value: string) => void;
  onStudentPageChange: (_page: number) => void;
  onEnroll: (_studentId: string) => void;
  onRevoke: (_enrollmentId: string) => void;
  onRetryEnrollments: () => void;
  onRetryStudents: () => void;
}

function PersonAvatar({ name, enrolled }: { name: string; enrolled?: boolean }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <span
      className={[
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border text-xs font-semibold",
        enrolled
          ? "border-success-200 bg-success-50 text-success-700 dark:border-success-800 dark:bg-success-subtle dark:text-success-400"
          : "border-app-border bg-app-bg-subtle text-app-text-muted",
      ].join(" ")}
      aria-hidden="true"
    >
      {enrolled ? <RiCheckLine className="text-base" /> : initials || "A"}
    </span>
  );
}

function QueryError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-md border border-danger-200 bg-danger-50 p-4 text-sm text-danger-700 dark:border-danger-800 dark:bg-danger-subtle dark:text-danger-400">
      <p>{message}</p>
      <Button variant="secondary" size="sm" className="mt-3" onClick={onRetry}>
        <RiRefreshLine /> Reintentar
      </Button>
    </div>
  );
}

function RosterSkeleton() {
  return (
    <div className="space-y-2.5" aria-busy="true" aria-label="Cargando alumnos">
      {[1, 2, 3, 4, 5].map((item) => (
        <div key={item} className="flex items-center gap-3 rounded-md border border-app-border p-3">
          <Skeleton type="rounded" className="h-9 w-9" />
          <div className="flex-1 space-y-2">
            <Skeleton type="text" className="h-3.5 w-1/3" />
            <Skeleton type="text" className="h-3 w-1/2" />
          </div>
          <Skeleton type="rounded" className="h-8 w-20" />
        </div>
      ))}
    </div>
  );
}

export function GroupRoster({
  view,
  enrollments,
  students,
  studentMeta,
  studentSearch,
  studentPage,
  enrollmentsLoading,
  studentsLoading,
  enrollmentsError,
  studentsError,
  isEnrollingStudent,
  isRevokingEnrollment,
  onViewChange,
  onStudentSearchChange,
  onStudentPageChange,
  onEnroll,
  onRevoke,
  onRetryEnrollments,
  onRetryStudents,
}: GroupRosterProps) {
  const enrolledIds = new Set(enrollments.map((enrollment) => enrollment.studentId));
  const availableStudents = students.filter((student) => !enrolledIds.has(student.id));

  return (
    <SectionCard
      title="Matriculaciones"
      description="Consulta el roster actual o incorpora alumnos desde el directorio."
    >
      <Tabs
        tabs={[
          {
            id: "enrolled",
            label: "Matriculados",
            icon: RiGroupLine,
            badge: enrollments.length,
          },
          {
            id: "directory",
            label: "Añadir alumnos",
            icon: RiUserAddLine,
          },
        ]}
        activeTab={view}
        onTabChange={(id) => onViewChange(id as RosterView)}
        className="-mx-4 -mt-4 mb-4 px-2"
      />

      {view === "enrolled" ? (
        enrollmentsLoading ? (
          <RosterSkeleton />
        ) : enrollmentsError ? (
          <QueryError message={enrollmentsError} onRetry={onRetryEnrollments} />
        ) : enrollments.length === 0 ? (
          <EmptyState
            title="Este grupo aún no tiene alumnos"
            description="Abre Añadir alumnos o utiliza la importación masiva para crear el roster."
            icon={<RiGroupLine className="text-3xl text-app-text-muted" />}
            actionLabel="Añadir alumnos"
            onAction={() => onViewChange("directory")}
          />
        ) : (
          <div className="space-y-2">
            {enrollments.map((enrollment) => {
              const busy = isRevokingEnrollment(enrollment.id);
              return (
                <div
                  key={enrollment.id}
                  className="flex flex-col gap-3 rounded-md border border-app-border bg-app-surface p-3 transition-colors hover:border-app-text-muted/40 sm:flex-row sm:items-center"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <PersonAvatar name={enrollment.studentName} enrolled />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-app-text">
                        {enrollment.studentName}
                      </p>
                      <p className="truncate text-xs text-app-text-muted">
                        {enrollment.studentEmail ?? "Cuenta eliminada"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 pl-12 sm:justify-end sm:pl-0">
                    <span className="hidden whitespace-nowrap font-mono text-[10px] text-app-text-muted xl:inline">
                      Desde {new Date(enrollment.enrolledAt).toLocaleDateString("es-ES")}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() => onRevoke(enrollment.id)}
                      className="text-danger-700 hover:bg-danger-50 hover:text-danger-700 dark:text-danger-400 dark:hover:bg-danger-subtle"
                      aria-label={`Retirar a ${enrollment.studentName} del grupo`}
                    >
                      {busy ? <RiRefreshLine className="animate-spin" /> : <RiUserUnfollowLine />}
                      {busy ? "Retirando..." : "Retirar"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col gap-2 border-b border-app-border pb-4 sm:flex-row sm:items-center sm:justify-between">
            <SearchInput
              value={studentSearch}
              onChange={onStudentSearchChange}
              placeholder="Buscar por nombre o correo..."
              aria-label="Buscar alumnos para matricular"
              className="w-full sm:max-w-md"
            />
            {studentMeta ? (
              <span className="whitespace-nowrap text-xs text-app-text-muted">
                {studentMeta.total} alumnos en el directorio
              </span>
            ) : null}
          </div>

          {studentsLoading ? (
            <RosterSkeleton />
          ) : studentsError ? (
            <QueryError message={studentsError} onRetry={onRetryStudents} />
          ) : availableStudents.length === 0 ? (
            <EmptyState
              title={studentSearch ? "Sin coincidencias disponibles" : "No hay alumnos disponibles"}
              description={
                studentSearch
                  ? "Prueba con otro nombre o correo; los ya matriculados no aparecen aquí."
                  : "Todos los alumnos de esta página ya pertenecen al grupo."
              }
              icon={<RiUserAddLine className="text-3xl text-app-text-muted" />}
            />
          ) : (
            <div className="space-y-2">
              {availableStudents.map((student) => {
                const name = `${student.lastName}, ${student.firstName}`;
                const busy = isEnrollingStudent(student.id);
                return (
                  <div
                    key={student.id}
                    className="flex flex-col gap-3 rounded-md border border-app-border bg-app-surface p-3 transition-colors hover:border-primary/30 sm:flex-row sm:items-center"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <PersonAvatar name={`${student.firstName} ${student.lastName}`} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-app-text">{name}</p>
                        <p className="truncate text-xs text-app-text-muted">{student.email}</p>
                      </div>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={busy}
                      onClick={() => onEnroll(student.id)}
                      className="ml-12 self-start sm:ml-0 sm:self-auto"
                      aria-label={`Matricular a ${name}`}
                    >
                      {busy ? <RiRefreshLine className="animate-spin" /> : <RiAddLine />}
                      {busy ? "Matriculando..." : "Matricular"}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          {studentMeta && studentMeta.totalPages > 1 ? (
            <div className="flex items-center justify-between gap-3 border-t border-app-border pt-4">
              <Button
                variant="secondary"
                size="sm"
                disabled={!studentMeta.hasPrevPage || studentsLoading}
                onClick={() => onStudentPageChange(Math.max(1, studentPage - 1))}
              >
                Anterior
              </Button>
              <span className="font-mono text-xs text-app-text-muted">
                Página {studentMeta.page} de {studentMeta.totalPages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={!studentMeta.hasNextPage || studentsLoading}
                onClick={() => onStudentPageChange(studentPage + 1)}
              >
                Siguiente
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </SectionCard>
  );
}
/**
 * Tabla de integrantes de un grupo con selección, paginación y acciones docentes.
 */
