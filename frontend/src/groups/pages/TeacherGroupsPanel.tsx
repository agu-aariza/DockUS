/**
 * @fileoverview Gestión maestro-detalle de grupos y matrículas.
 *
 * @module TeacherGroupsPanel
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import {
  RiAddLine,
  RiDeleteBinLine,
  RiEditLine,
  RiFileList3Line,
  RiGroupLine,
  RiInformationLine,
  RiRefreshLine,
  RiTeamFill,
  RiUser3Line,
} from "react-icons/ri";
import { useGroupManagement } from "../hooks/useGroupManagement";
import { nextGroupIdAfterDeletion, resolveFocusedGroupId } from "../groupsSelection";
import { GroupSelector } from "../components/GroupSelector";
import { GroupRoster, type RosterView } from "../components/GroupRoster";
import {
  BulkEnrollmentDialog,
  GroupFormDialog,
} from "../components/GroupDialogs";
import { useSession } from "../../shared/session/SessionContext";
import { EmptyState } from "../../shared/components/EmptyState";
import { DangerConfirmModal } from "../../shared/components/DangerConfirmModal";
import { Skeleton } from "../../shared/components/Skeleton";
import { useNoticeToasts } from "../../shared/toast/useNoticeToasts";
import { PageHeader } from "../../shared/components/ui/PageHeader";
import { Button } from "../../shared/components/ui/Button";

export function TeacherGroupsPanel() {
  const { activeSession } = useSession();
  const canWrite = ["TEACHER", "ADMIN"].includes(activeSession?.role ?? "");
  const [searchParams, setSearchParams] = useSearchParams();

  const [focusedGroupId, setFocusedGroupId] = useState("");
  const [groupSearch, setGroupSearch] = useState("");
  const [rosterView, setRosterView] = useState<RosterView>("enrolled");
  const [studentSearch, setStudentSearch] = useState("");
  const [debouncedStudentSearch, setDebouncedStudentSearch] = useState("");
  const [studentPage, setStudentPage] = useState(1);

  const [groupDialogMode, setGroupDialogMode] = useState<"create" | "edit" | null>(null);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  useEffect(() => {
    const handle = window.setTimeout(
      () => setDebouncedStudentSearch(studentSearch),
      300,
    );
    return () => window.clearTimeout(handle);
  }, [studentSearch]);

  const management = useGroupManagement({
    canWrite,
    focusedGroupId,
    studentSearch: debouncedStudentSearch,
    studentPage,
    directoryEnabled: rosterView === "directory",
  });

  useNoticeToasts([management.notice], "Gestión de grupos");

  const sortedGroups = useMemo(
    () =>
      [...management.groups].sort((left, right) =>
        left.name.localeCompare(right.name, "es", {
          numeric: true,
          sensitivity: "base",
        }),
      ),
    [management.groups],
  );

  const visibleGroups = useMemo(() => {
    const query = groupSearch.trim().toLocaleLowerCase("es");
    if (!query) return sortedGroups;
    return sortedGroups.filter(
      (group) =>
        group.name.toLocaleLowerCase("es").includes(query) ||
        group.code?.toLocaleLowerCase("es").includes(query),
    );
  }, [groupSearch, sortedGroups]);

  const focusedGroup = sortedGroups.find((group) => group.id === focusedGroupId);

  const writeFocusedGroupParam = useCallback(
    (groupId: string, replace = false) => {
      const next = new URLSearchParams(searchParams);
      if (groupId) next.set("focusedGroupId", groupId);
      else next.delete("focusedGroupId");
      setSearchParams(next, { replace });
    },
    [searchParams, setSearchParams],
  );

  const selectGroup = useCallback(
    (groupId: string, replace = false) => {
      setFocusedGroupId(groupId);
      writeFocusedGroupParam(groupId, replace);
      setRosterView("enrolled");
      setStudentSearch("");
      setDebouncedStudentSearch("");
      setStudentPage(1);
    },
    [writeFocusedGroupParam],
  );

  // Resuelve una única vez la selección válida: enlace profundo, selección
  // actual o primer grupo alfabético. Las consultas de matrículas no arrancan
  // hasta tener un id validado contra la lista real.
  useEffect(() => {
    if (management.isGroupsLoading || management.groupsError) return;

    if (sortedGroups.length === 0) {
      if (focusedGroupId) setFocusedGroupId("");
      if (searchParams.has("focusedGroupId")) writeFocusedGroupParam("", true);
      return;
    }

    const requestedId = searchParams.get("focusedGroupId") ?? "";
    const nextId = resolveFocusedGroupId(
      sortedGroups,
      focusedGroupId,
      requestedId,
    );

    if (nextId !== focusedGroupId) setFocusedGroupId(nextId);
    if (requestedId !== nextId) writeFocusedGroupParam(nextId, true);
  }, [
    focusedGroupId,
    management.groupsError,
    management.isGroupsLoading,
    searchParams,
    sortedGroups,
    writeFocusedGroupParam,
  ]);

  const groupFormInitialValues = useMemo(
    () => ({
      name: groupDialogMode === "edit" ? focusedGroup?.name ?? "" : "",
      code: groupDialogMode === "edit" ? focusedGroup?.code ?? "" : "",
      description:
        groupDialogMode === "edit" ? focusedGroup?.description ?? "" : "",
    }),
    [focusedGroup, groupDialogMode],
  );

  const handleDeleteGroup = async () => {
    if (!focusedGroup) return;
    const nextGroupId = nextGroupIdAfterDeletion(sortedGroups, focusedGroup.id);

    if (await management.deleteGroup(focusedGroup.id)) {
      selectGroup(nextGroupId, true);
    }
  };

  return (
    <div className="w-full max-w-full space-y-6 overflow-x-hidden">
      <PageHeader
        title="Grupos"
        subtitle="Organiza cohortes y gestiona sus matrículas desde un único lugar."
        icon={<RiTeamFill />}
        badge={String(sortedGroups.length)}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => void management.refetchGroups()}
              disabled={management.isGroupsFetching}
              title="Actualizar grupos"
            >
              <RiRefreshLine
                className={management.isGroupsFetching ? "animate-spin" : ""}
              />
              <span className="hidden sm:inline">Actualizar</span>
            </Button>
            {canWrite ? (
              <Button onClick={() => setGroupDialogMode("create")}>
                <RiAddLine /> Nuevo grupo
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <GroupSelector
          groups={visibleGroups}
          selectedId={focusedGroupId}
          search={groupSearch}
          loading={management.isGroupsLoading}
          error={management.groupsError}
          onSearchChange={setGroupSearch}
          onSelect={selectGroup}
          onRetry={() => void management.refetchGroups()}
        />

        <main className="min-w-0 space-y-4">
          {management.isGroupsLoading ? (
            <div className="rounded-lg border border-app-border bg-app-surface p-5 shadow-sm">
              <div className="flex items-center gap-4">
                <Skeleton type="rounded" className="h-12 w-12" />
                <div className="flex-1 space-y-2">
                  <Skeleton type="text" className="h-5 w-1/3" />
                  <Skeleton type="text" className="h-3 w-1/2" />
                </div>
              </div>
            </div>
          ) : management.groupsError ? (
            <div className="rounded-lg border border-danger-200 bg-danger-50 p-5 text-danger-700 dark:border-danger-800 dark:bg-danger-subtle dark:text-danger-400">
              <h2 className="font-semibold">No se pudieron cargar los grupos</h2>
              <p className="mt-1 text-sm">{management.groupsError}</p>
              <Button
                variant="secondary"
                size="sm"
                className="mt-4"
                onClick={() => void management.refetchGroups()}
              >
                <RiRefreshLine /> Reintentar
              </Button>
            </div>
          ) : focusedGroup ? (
            <>
              <section className="overflow-hidden rounded-lg border border-app-border bg-app-surface shadow-sm">
                <div className="flex flex-col gap-5 p-5 xl:flex-row xl:items-start xl:justify-between">
                  <div className="flex min-w-0 items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-primary/15 bg-primary-subtle text-xl text-primary">
                      <RiGroupLine />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-xl font-semibold tracking-tight text-app-text">
                          {focusedGroup.name}
                        </h2>
                        <span className="rounded border border-app-border bg-app-bg-subtle px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-app-text-secondary">
                          {focusedGroup.code || "Sin código"}
                        </span>
                      </div>
                      <p className="mt-1 max-w-2xl text-sm leading-6 text-app-text-secondary">
                        {focusedGroup.description ||
                          "Grupo docente sin descripción. Añade contexto para identificarlo mejor."}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-app-text-muted">
                        <span className="inline-flex items-center gap-1.5">
                          <RiUser3Line />
                          <strong className="font-mono text-app-text">
                            {focusedGroup.studentCount}
                          </strong>
                          matriculados
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <RiInformationLine />
                          Actualizado {new Date(focusedGroup.updatedAt).toLocaleDateString("es-ES")}
                        </span>
                      </div>
                    </div>
                  </div>

                  {canWrite ? (
                    <div className="flex flex-wrap items-center gap-2 pl-16 xl:pl-0">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setBulkDialogOpen(true)}
                      >
                        <RiFileList3Line /> Importar lista
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setGroupDialogMode("edit")}
                      >
                        <RiEditLine /> Editar
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => setDeleteDialogOpen(true)}
                        aria-label={`Eliminar ${focusedGroup.name}`}
                      >
                        <RiDeleteBinLine />
                      </Button>
                    </div>
                  ) : null}
                </div>
              </section>

              <GroupRoster
                view={rosterView}
                enrollments={management.activeEnrollments}
                students={management.studentDirectory}
                studentMeta={management.studentMeta}
                studentSearch={studentSearch}
                studentPage={studentPage}
                enrollmentsLoading={management.isEnrollmentsLoading}
                studentsLoading={management.isStudentsLoading}
                enrollmentsError={management.enrollmentsError}
                studentsError={management.studentsError}
                isEnrollingStudent={management.isEnrollingStudent}
                isRevokingEnrollment={management.isRevokingEnrollment}
                onViewChange={(view) => {
                  setRosterView(view);
                  if (view === "directory") setStudentPage(1);
                }}
                onStudentSearchChange={(value) => {
                  setStudentSearch(value);
                  setStudentPage(1);
                }}
                onStudentPageChange={setStudentPage}
                onEnroll={(studentId) => void management.enrollStudent(studentId)}
                onRevoke={(enrollmentId) =>
                  void management.revokeEnrollment(enrollmentId)
                }
                onRetryEnrollments={() => void management.refetchEnrollments()}
                onRetryStudents={() => void management.refetchStudents()}
              />
            </>
          ) : (
            <div className="rounded-lg border border-app-border bg-app-surface p-6 shadow-sm">
              <EmptyState
                title="Aún no hay grupos"
                description="Crea un grupo docente para empezar a organizar y matricular alumnos."
                icon={<RiGroupLine className="text-4xl text-app-text-muted" />}
                actionLabel={canWrite ? "Crear primer grupo" : undefined}
                onAction={canWrite ? () => setGroupDialogMode("create") : undefined}
              />
            </div>
          )}
        </main>
      </div>

      <GroupFormDialog
        open={groupDialogMode !== null}
        mode={groupDialogMode ?? "create"}
        initialValues={groupFormInitialValues}
        submitting={
          groupDialogMode === "create"
            ? management.isCreating
            : management.isUpdating
        }
        onClose={() => setGroupDialogMode(null)}
        onSubmit={async (values) => {
          if (groupDialogMode === "edit" && focusedGroup) {
            return management.updateGroup(focusedGroup.id, values);
          }
          const created = await management.createGroup(values);
          if (!created) return false;
          selectGroup(created.id, true);
          return true;
        }}
      />

      <BulkEnrollmentDialog
        open={bulkDialogOpen && Boolean(focusedGroup)}
        groupName={focusedGroup?.name ?? ""}
        submitting={management.isBulkEnrolling}
        onClose={() => setBulkDialogOpen(false)}
        onSubmit={management.bulkEnroll}
      />

      <DangerConfirmModal
        open={deleteDialogOpen && Boolean(focusedGroup)}
        title="Eliminar grupo"
        description={`Se eliminará "${focusedGroup?.name ?? ""}" y sus matrículas activas. Esta acción no se puede deshacer.`}
        confirmWord={focusedGroup?.code || focusedGroup?.name || "ELIMINAR"}
        confirmButtonLabel="Eliminar grupo"
        loadingLabel="Eliminando..."
        onCancel={() => setDeleteDialogOpen(false)}
        onConfirm={handleDeleteGroup}
      />
    </div>
  );
}
