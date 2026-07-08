import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  RiGroupLine,
  RiAddLine,
  RiDeleteBinLine,
  RiArrowRightSLine,
  RiUser3Fill,
  RiCheckFill,
  RiInformationFill,
  RiRefreshLine,
  RiTeamFill,
  RiEditLine,
  RiCloseLine,
} from "react-icons/ri";
import { useGroupManagement } from "../hooks/useGroupManagement";
import { UserEntity } from "../../features/auth/types";
import { EmptyState } from "../../shared/components/EmptyState";
import { useNoticeToasts } from "../../shared/toast/useNoticeToasts";
import { PageHeader } from "../../shared/components/ui/PageHeader";
import { Button } from "../../shared/components/ui/Button";
import { Tabs } from "../../shared/components/ui/Tabs";
import { Card } from "../../shared/components/ui/Layout";
import { SectionCard } from "../../shared/components/ui/Layout";
import { Badge } from "../../shared/components/ui/Layout";
import { SearchInput } from "../../shared/components/ui/SearchInput";
import { StatusBadge } from "../../shared/components/ui/StatusBadge";

export function TeacherGroupsPanel({ session }: { session: any }) {
  const canWrite = ["TEACHER", "ADMIN"].includes(session.role);
  const location = useLocation();
  const {
    groups,
    focusedGroupId,
    setFocusedGroupId,
    groupEnrollments,
    allStudents,
    groupForm,
    setGroupForm,
    bulkInput,
    setBulkInput,
    loading,
    busy,
    notice,
    refreshGroups,
    refreshStudents,
    handleCreateGroup,
    handleUpdateGroup,
    handleEnrollStudents,
    handleToggleEnrollment,
    handleDeleteGroup,
  } = useGroupManagement(canWrite);

  // Deep linking: focus group from URL
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const gId = params.get("focusedGroupId");
    if (gId && gId !== focusedGroupId) {
      setFocusedGroupId(gId);
    }
  }, [location.search, focusedGroupId, setFocusedGroupId]);

  // Ensure groups and students are loaded
  useEffect(() => {
    void refreshGroups();
    void refreshStudents();
  }, []);

  useNoticeToasts([notice], "Gestión de Grupos");

  const [studentSearch, setStudentSearch] = useState("");
  const [groupSearch, setGroupSearch] = useState("");
  const [enrollmentFilter, setEnrollmentFilter] = useState<"all" | "enrolled" | "not_enrolled">("all");
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", code: "", description: "" });

  const focusedGroup = groups.find((g) => g.id === focusedGroupId);

  const filteredGroups = groups.filter(
    (g) =>
      !groupSearch.trim() ||
      g.name.toLowerCase().includes(groupSearch.toLowerCase()) ||
      g.code?.toLowerCase().includes(groupSearch.toLowerCase())
  );

  const filteredStudents = allStudents.filter((student: UserEntity) => {
    const searchLower = studentSearch.toLowerCase().trim();
    const matchesSearch =
      !searchLower ||
      student.firstName.toLowerCase().includes(searchLower) ||
      student.lastName.toLowerCase().includes(searchLower) ||
      student.email.toLowerCase().includes(searchLower);

    if (!focusedGroup) return matchesSearch;

    const isEnrolled = groupEnrollments?.some(
      (e) => e.studentId === student.id && !e.revokedAt
    );
    const matchesFilter =
      enrollmentFilter === "all" ||
      (enrollmentFilter === "enrolled" && isEnrolled) ||
      (enrollmentFilter === "not_enrolled" && !isEnrolled);

    return matchesSearch && matchesFilter;
  });

  const openEditModal = () => {
    if (!focusedGroup) return;
    setEditForm({
      name: focusedGroup.name,
      code: focusedGroup.code || "",
      description: focusedGroup.description || "",
    });
    setIsEditing(true);
  };

  return (
    <div className="w-full max-w-full space-y-6 overflow-x-hidden">
      <PageHeader
        title="Gestión de Grupos"
        subtitle="Administración de grupos docentes, matriculaciones y cohortes."
        icon={<RiTeamFill />}
        badge={groups.length.toString()}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="md"
              onClick={refreshGroups}
              disabled={loading}
              title="Refrescar datos"
            >
              <RiRefreshLine className={loading ? "animate-spin" : ""} />
              <span>{loading ? "Actualizando..." : "Actualizar"}</span>
            </Button>
            {canWrite && (
              <Button
                variant="primary"
                size="md"
                onClick={() => setIsCreating(true)}
              >
                <RiAddLine /> Nuevo Grupo
              </Button>
            )}
          </div>
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* Sidebar: Group Selection & Creation */}
        <SectionCard
          title="Grupos"
          description="Selecciona un grupo para gestionar sus matriculaciones."
          headerAction={
            <Badge variant="info">{groups.length} grupos</Badge>
          }
          className="lg:sticky lg:top-8"
        >
          {isCreating && (
            <div className="mb-4 rounded-lg border border-app-border bg-slate-50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Crear grupo
                </h4>
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                  aria-label="Cerrar formulario"
                >
                  <RiCloseLine />
                </button>
              </div>
              <div className="space-y-3">
                <input
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                  placeholder="Nombre del grupo (ej: 2º DAW)"
                  value={groupForm.name}
                  onChange={(e) =>
                    setGroupForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                />
                <input
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                  placeholder="Código corto (ej: DAW-24)"
                  value={groupForm.code}
                  onChange={(e) =>
                    setGroupForm((prev) => ({ ...prev, code: e.target.value }))
                  }
                />
                <Button
                  variant="primary"
                  size="md"
                  className="w-full"
                  disabled={!groupForm.name || !!busy}
                  onClick={async () => {
                    await handleCreateGroup();
                    setIsCreating(false);
                  }}
                >
                  {busy === "create" ? "Creando..." : "Crear grupo"}
                </Button>
              </div>
            </div>
          )}

          <div className="mb-4">
            <SearchInput
              value={groupSearch}
              onChange={setGroupSearch}
              placeholder="Buscar grupo..."
            />
          </div>

          <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1 -mr-1 custom-scrollbar">
            {filteredGroups.map((group) => {
              const isSelected = focusedGroupId === group.id;
              return (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => setFocusedGroupId(group.id)}
                  className={`group flex w-full flex-col gap-3 rounded-md border p-4 text-left transition-colors ${
                    isSelected
                      ? "border-primary bg-primary-subtle"
                      : "border-app-border bg-white hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <RiGroupLine
                        className={
                          isSelected
                            ? "text-primary"
                            : "text-slate-400 group-hover:text-slate-500"
                        }
                      />
                      <span
                        className={`line-clamp-1 text-sm font-semibold ${
                          isSelected ? "text-primary" : "text-slate-900"
                        }`}
                      >
                        {group.name}
                      </span>
                    </div>
                    <RiArrowRightSLine
                      className={`shrink-0 text-lg ${
                        isSelected
                          ? "text-primary"
                          : "text-slate-300 group-hover:text-slate-400"
                      }`}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">
                      {group.code || "Sin código"}
                    </span>
                    <StatusBadge tone={isSelected ? "info" : "idle"}>
                      {group.studentCount} alumnos
                    </StatusBadge>
                  </div>
                </button>
              );
            })}

            {filteredGroups.length === 0 && !loading && (
              <EmptyState
                title={groups.length === 0 ? "Sin grupos" : "Sin resultados"}
                description={
                  groups.length === 0
                    ? "Crea tu primer grupo para empezar a matricular alumnos."
                    : "No se encontraron grupos con ese criterio de búsqueda."
                }
                icon={<RiGroupLine className="text-3xl text-slate-400" />}
                actionLabel={
                  canWrite
                    ? groups.length === 0
                      ? "Crear grupo"
                      : "Limpiar búsqueda"
                    : undefined
                }
                onAction={
                  canWrite
                    ? () => {
                        setGroupSearch("");
                        setIsCreating(true);
                      }
                    : undefined
                }
              />
            )}
          </div>
        </SectionCard>

        {/* Main Content: Enrollment Management */}
        <section className="space-y-6">
          {focusedGroup ? (
            <>
              <SectionCard
                title={focusedGroup.name}
                description={focusedGroup.description || "Grupo docente"}
                headerAction={
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={openEditModal}
                    >
                      <RiEditLine />
                      Editar
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => {
                        if (
                          window.confirm(
                            "¿Estás seguro de que deseas eliminar este grupo? Esta acción no se puede deshacer."
                          )
                        ) {
                          handleDeleteGroup(focusedGroup.id);
                        }
                      }}
                      title="Eliminar grupo"
                    >
                      <RiDeleteBinLine />
                    </Button>
                  </div>
                }
              >
                <div className="flex flex-wrap items-center gap-6 text-sm">
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <RiInformationFill className="text-slate-400" />
                    <span>Código:</span>
                    <span className="font-medium text-slate-900">
                      {focusedGroup.code || "No asignado"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <RiUser3Fill className="text-slate-400" />
                    <span>Matriculados:</span>
                    <span className="font-medium text-slate-900">
                      {focusedGroup.studentCount}
                    </span>
                  </div>
                </div>
              </SectionCard>

              <div className="grid items-start gap-6 lg:grid-cols-[1fr_360px]">
                {/* Student directory */}
                <Card
                  title="Matriculaciones"
                  headerAction={
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <SearchInput
                        value={studentSearch}
                        onChange={setStudentSearch}
                        placeholder="Buscar por nombre o email..."
                        className="w-full sm:w-56"
                      />
                      <Tabs
                        tabs={[
                          { id: "all", label: "Todos" },
                          { id: "enrolled", label: "Matriculados" },
                          { id: "not_enrolled", label: "No matriculados" },
                        ]}
                        activeTab={enrollmentFilter}
                        onTabChange={(id) =>
                          setEnrollmentFilter(id as "all" | "enrolled" | "not_enrolled")
                        }
                      />
                    </div>
                  }
                >
                  <div className="space-y-2">
                    {(() => {
                      if (loading && allStudents.length === 0) {
                        return (
                          <div className="py-12 text-center">
                            <RiRefreshLine className="mx-auto mb-2 text-2xl text-primary animate-spin" />
                            <p className="text-sm text-slate-500">Cargando alumnos...</p>
                          </div>
                        );
                      }

                      if (filteredStudents.length === 0) {
                        return (
                          <EmptyState
                            title={
                              studentSearch
                                ? "No hay coincidencias"
                                : "No hay alumnos registrados"
                            }
                            description={
                              studentSearch
                                ? "Intenta con otro nombre o correo."
                                : "Utiliza el panel de la derecha para matricular alumnos masivamente."
                            }
                            icon={<RiUser3Fill className="text-3xl text-slate-400" />}
                          />
                        );
                      }

                      return filteredStudents.map((student: UserEntity) => {
                        const enrollment = groupEnrollments?.find(
                          (e) => e.studentId === student.id && !e.revokedAt
                        );
                        const isEnrolled = !!enrollment;
                        const isBusy =
                          busy === `enroll:${student.id}` ||
                          (enrollment && busy === `revoke:${enrollment.id}`);

                        return (
                          <div
                            key={student.id}
                            className={`flex items-center justify-between rounded-md border p-4 transition-colors ${
                              isEnrolled
                                ? "border-primary/20 bg-primary-subtle/50"
                                : "border-app-border bg-white hover:border-slate-300"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-base ${
                                  isEnrolled
                                    ? "bg-primary text-white"
                                    : "bg-slate-100 text-slate-500"
                                }`}
                              >
                                {isEnrolled ? <RiCheckFill /> : <RiUser3Fill />}
                              </div>
                              <div>
                                <h5 className="text-sm font-semibold text-slate-900">
                                  {student.lastName}, {student.firstName}
                                </h5>
                                <p className="text-xs text-slate-500">{student.email}</p>
                              </div>
                            </div>

                            {isBusy ? (
                              <RiRefreshLine className="animate-spin text-primary" />
                            ) : (
                              <button
                                type="button"
                                role="switch"
                                aria-checked={isEnrolled}
                                onClick={() =>
                                  handleToggleEnrollment(student.id, isEnrolled)
                                }
                                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                                  isEnrolled ? "bg-emerald-500" : "bg-slate-200"
                                }`}
                              >
                                <span
                                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                                    isEnrolled ? "translate-x-5" : "translate-x-0"
                                  }`}
                                />
                              </button>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>
                </Card>

                {/* Bulk enrollment */}
                <Card title="Ingesta masiva">
                  <div className="space-y-4">
                    <p className="text-sm text-slate-500">
                      Pega una lista de <strong>nombres y apellidos</strong> o correos
                      electrónicos, uno por línea.
                    </p>
                    <textarea
                      className="w-full min-h-[180px] rounded-md border border-slate-300 bg-white p-3 text-sm text-slate-900 placeholder:text-slate-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                      placeholder={`Apellidos, Nombre\nGarcía, Juan\nestudiante@dockus.io`}
                      value={bulkInput}
                      onChange={(e) => setBulkInput(e.target.value)}
                    />
                    <Button
                      variant="primary"
                      size="md"
                      className="w-full"
                      disabled={!bulkInput.trim() || !!busy}
                      onClick={handleEnrollStudents}
                    >
                      <RiCheckFill />
                      {busy === "enroll" ? "Procesando..." : "Matricular en grupo"}
                    </Button>
                  </div>
                </Card>
              </div>
            </>
          ) : (
            <Card
              title="Listado general de alumnos"
              headerAction={
                <SearchInput
                  value={studentSearch}
                  onChange={setStudentSearch}
                  placeholder="Buscar alumnos..."
                  className="w-full sm:w-64"
                />
              }
            >
              <div className="space-y-2">
                {(() => {
                  if (filteredStudents.length === 0) {
                    return (
                      <EmptyState
                        title="No se encontraron alumnos"
                        description="Prueba con otros criterios de búsqueda."
                        icon={<RiUser3Fill className="text-3xl text-slate-400" />}
                      />
                    );
                  }

                  return filteredStudents.map((student: UserEntity) => (
                    <div
                      key={student.id}
                      className="flex items-center justify-between rounded-md border border-app-border bg-white p-4 opacity-70"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-slate-100 text-xs font-semibold uppercase text-slate-500">
                          {student.firstName[0]}
                          {student.lastName[0]}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {student.lastName}, {student.firstName}
                          </p>
                          <p className="text-xs text-slate-500">{student.email}</p>
                        </div>
                      </div>
                      <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                        Selecciona un grupo
                      </span>
                    </div>
                  ));
                })()}
              </div>
            </Card>
          )}
        </section>
      </div>

      {/* Edit modal */}
      {isEditing && focusedGroup && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-lg border border-app-border bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-app-border px-6 py-4">
              <div>
                <h4 className="text-base font-semibold text-slate-900">Editar grupo</h4>
                <p className="text-sm text-slate-500">Modifica los datos del grupo.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Cerrar"
              >
                <RiCloseLine />
              </button>
            </div>

            <div className="space-y-4 p-6">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500">Nombre del grupo</label>
                <input
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500">Código identificador</label>
                <input
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                  value={editForm.code}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, code: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500">Descripción (opcional)</label>
                <textarea
                  className="w-full min-h-[100px] rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                  value={editForm.description}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, description: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="flex gap-3 border-t border-app-border bg-slate-50 px-6 py-4">
              <Button
                variant="secondary"
                size="md"
                className="flex-1"
                onClick={() => setIsEditing(false)}
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                size="md"
                className="flex-1"
                disabled={!editForm.name || busy === `update:${focusedGroupId}`}
                onClick={async () => {
                  if (focusedGroupId) {
                    await handleUpdateGroup(focusedGroupId, editForm);
                    setIsEditing(false);
                  }
                }}
              >
                {busy === `update:${focusedGroupId}` ? "Guardando..." : "Guardar cambios"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
