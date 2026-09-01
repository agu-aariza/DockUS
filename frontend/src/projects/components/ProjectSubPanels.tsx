/**
 * @fileoverview Vista y gestión de proyectos académicos (ProjectSubPanels).
 *
 * @module ProjectSubPanels
 */

import { useState, useMemo } from "react";
import {
  RiArrowRightSLine,
  RiBarChart2Line,
  RiCalendarScheduleLine,
  RiTeamLine,
  RiRefreshLine,
  RiSearchLine,
  RiUserAddLine,
  RiTeamFill,
  RiUser3Fill,
  RiFileLine,
  RiCloseLine,
  RiMore2Fill,
  RiCheckFill,
  RiSparkling2Line,
  RiPieChart2Line,
  RiSettings4Line,
  RiTestTubeLine,
  RiDeleteBin6Line,
  RiGroupLine,
  RiDraftLine,
  RiFileCodeLine,
  RiUserFollowFill,
  RiInformationFill,
  RiFoldersLine,
  RiLayoutGridFill,
  RiLoader4Line,
  RiFolderAddLine,
  RiFileDownloadLine,
  RiEyeLine,
  RiTimeLine,
  RiStackFill,
  RiFolderChartLine,
  RiFolderUploadLine,
  RiAddLine,
  RiDeleteBinLine,
} from "react-icons/ri";
import { MetricCard } from "../../shared/components/MetricCard";
import { EmptyState } from "../../shared/components/EmptyState";
import { SearchInput } from "../../shared/components/ui/SearchInput";
import { Button } from "../../shared/components/ui/Button";
import { StatusBadge } from "../../shared/components/ui/StatusBadge";
import type { CourseGroupEntity, GroupEnrollmentEntity } from "../../features/groups/types";
import type { ProjectEntity, ProjectAssignmentEntity } from "../../features/projects/types";
import type { UserEntity } from "../../features/auth/types";

type GroupFormState = {
  name: string;
  code: string;
  description: string;
};

interface ProjectAssignmentManagerProps {
  project: ProjectEntity;
  students: UserEntity[];
  /** Total real en la plataforma (meta.total); students puede venir truncado a 100. */
  totalStudentsCount?: number;
  groups: CourseGroupEntity[];
  assignments: ProjectAssignmentEntity[];
  selectedStudentIds: string[];
  assignmentBusy: string | null;
  searchTerm: string;
  loadingGroups: boolean;
  focusedGroupId: string;
  onFocusedGroupChange: (groupId: string) => void;
  onSearchChange: (value: string) => void;
  onImportCsvFile: (file: File | null) => void;
  onSelectionChange: (studentIds: string[]) => void;
  onAssignSelected: () => void;
  onRefreshAssignments: () => void;
  onRefreshGroups: () => void;
  onRevokeAssignment: (assignmentId: string, studentId: string) => void;
  onAssignGroups: (groupIds: string[]) => void;
}



export function ProjectAssignmentManager({
  project,
  students,
  totalStudentsCount,
  groups,
  assignments,
  selectedStudentIds,
  assignmentBusy,
  searchTerm,
  loadingGroups,
  focusedGroupId,
  onFocusedGroupChange,
  onSearchChange,
  onImportCsvFile,
  onSelectionChange,
  onAssignSelected,
  onRefreshAssignments,
  onRefreshGroups,
  onRevokeAssignment,
  onAssignGroups,
}: ProjectAssignmentManagerProps) {


  const filteredGroups = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return groups;
    return groups.filter(g => 
      g.name.toLowerCase().includes(query) || 
      (g.code && g.code.toLowerCase().includes(query))
    );
  }, [groups, searchTerm]);

  const assignedStudentIds = useMemo(() => new Set(assignments.map((a) => a.studentId)), [assignments]);
  
  // Helper para saber si un grupo está "completamente asignado"
  // Nota: Esto es aproximado si no tenemos los IDs de los alumnos por grupo aquí.
  // Pero visualmente usaremos los badges de 'Asignado' de los alumnos que ya tenemos.
  const activeAssignmentsCount = assignments.filter(a => !a.revokedAt).length;
  // meta.total real, no students.length: ese array se queda truncado a la
  // página de 100 alumnos que carga useProjectManagement — con
  // más de 100 en la plataforma, la métrica y el % de cobertura mentían.
  const totalStudents = totalStudentsCount ?? students.length;
  const pendingCount = totalStudents - activeAssignmentsCount;
  const coveragePercent = totalStudents > 0 ? Math.round((activeAssignmentsCount / totalStudents) * 100) : 0;

  return (
    <div className="space-y-8">

      {/* 1. Metrics Header */}
      <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Alumnos", value: totalStudents, helper: "En la plataforma", icon: <RiUser3Fill />, variant: "dark" as const },
          { label: "Matriculados", value: activeAssignmentsCount, helper: `${coveragePercent}% completado`, icon: <RiCheckFill />, variant: "success" as const },
          { label: "Sin Proyecto", value: pendingCount, helper: "Esperando asignación", icon: <RiSparkling2Line />, variant: "warning" as const },
          { label: "Grupos", value: groups.length, helper: "Disponibles para asignar", icon: <RiTeamFill />, variant: "info" as const },
        ].map((metric, idx) => (
          <div key={idx} className="group/metric">
            <MetricCard
              label={metric.label}
              value={metric.value}
              helper={metric.helper}
              icon={metric.icon}
              variant={metric.variant}
            />
          </div>
        ))}
      </section>

      {/* 2. Main Workspace Layout */}
      <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)] items-start">
        {/* Sidebar: Groups & Search */}
        <aside className="flex flex-col gap-6 sticky top-8">

          {/* Quick Actions Card */}
          <div className="relative overflow-hidden rounded-lg border border-app-border bg-app-surface p-5">
            <div className="absolute -right-4 -top-4 opacity-[0.05] text-8xl text-primary/30 pointer-events-none">
              <RiSearchLine />
            </div>

            <h4 className="ui-label mb-4">Filtrado y Búsqueda</h4>
            <div className="space-y-4">
              <SearchInput
                placeholder="Buscar grupo o código..."
                value={searchTerm}
                onChange={onSearchChange}
                aria-label="Buscar grupo o código"
              />

              <Button
                variant="secondary"
                className="w-full justify-center"
                onClick={onRefreshAssignments}
              >
                <RiRefreshLine className={assignmentBusy ? "animate-spin motion-reduce:animate-none" : ""} />
                Sincronizar
              </Button>
            </div>
          </div>


        </aside>

        {/* Main Grid: Group Cards */}
        <section className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="section-heading flex items-center gap-3">
                Classroom Hub
                <StatusBadge tone="info">{filteredGroups.length} grupos</StatusBadge>
              </h3>
              <p className="mt-1 text-sm text-app-text-secondary">
                Gestiona la matriculación por grupos académicos
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="primary"
                onClick={() => onAssignGroups(groups.map(g => g.id))}
                disabled={groups.length === 0 || !!assignmentBusy}
              >
                <RiTeamFill className="text-base" />
                Matricular todos los grupos
              </Button>
            </div>
          </div>

          {filteredGroups.length === 0 ? (
            <EmptyState
              title="No hay grupos"
              description={searchTerm ? "No se encontraron grupos que coincidan con tu búsqueda." : "No hay grupos registrados en el sistema."}
              icon={<RiGroupLine className="text-5xl text-app-text-muted/40" />}
            />
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
              {filteredGroups.map((group) => {
                const isFocused = focusedGroupId === group.id;
                
                // Determinamos si el grupo tiene alumnos ya asignados al proyecto
                const groupAssignments = assignments.filter(a => 
                  !a.revokedAt && 
                  (a.courseGroupId === group.id || a.sourceGroupIds.includes(group.id))
                );
                const isGroupAssigned = groupAssignments.length > 0;
                
                return (
                  <div
                    key={group.id}
                    role="button"
                    tabIndex={0}
                    aria-pressed={isFocused}
                    onClick={() => onFocusedGroupChange(group.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onFocusedGroupChange(group.id);
                      }
                    }}
                    className={`group relative flex cursor-pointer flex-col overflow-hidden rounded-lg border bg-app-surface p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                      isGroupAssigned
                        ? 'border-success-200'
                        : isFocused
                          ? 'border-primary ring-1 ring-primary/10'
                          : 'card-interactive border-app-border'
                    }`}
                  >
                    {/* Card Header with Status Toggle */}
                    <div className="flex items-start justify-between mb-5">
                      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-md border text-xl transition-colors motion-reduce:transition-none ${
                        isGroupAssigned
                          ? 'border-success-200 bg-success-50 text-success-600'
                          : isFocused
                            ? 'border-primary bg-primary text-white'
                            : 'border-app-border bg-app-bg-subtle text-app-text-muted group-hover:text-primary'
                      }`}>
                        <RiGroupLine />
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isGroupAssigned) {
                            groupAssignments.forEach(a => onRevokeAssignment(a.id, a.studentId));
                          } else {
                            onAssignGroups([group.id]);
                          }
                        }}
                        disabled={!!assignmentBusy}
                        className={`relative flex h-7 w-12 items-center rounded-full transition-colors motion-reduce:transition-none ${
                          isGroupAssigned ? 'bg-success-500' : 'bg-app-border hover:bg-app-text-muted/40'
                        }`}
                      >
                        <div className={`absolute left-1 flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-sm transition-transform duration-200 motion-reduce:transition-none ${
                          isGroupAssigned ? 'translate-x-5' : 'translate-x-0'
                        }`}>
                          {isGroupAssigned && <RiCheckFill className="text-[10px] text-success-600 font-bold" />}
                        </div>
                      </button>
                    </div>

                    {/* Group Info */}
                    <div className="min-w-0">
                      <span className={`ui-label ${isGroupAssigned ? 'text-success-600' : ''}`}>
                        {group.code || "SC"}
                      </span>
                      <h4 className="mt-0.5 truncate text-sm font-semibold text-app-text">
                        {group.name}
                      </h4>
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            // Navegamos a la pestaña general de grupos
                            window.location.href = `/groups?focusedGroupId=${group.id}`;
                          }}
                          className="group/btn flex items-center gap-2 rounded-md border border-app-border bg-app-bg-subtle px-3 py-1.5 text-xs font-medium text-app-text-secondary transition-colors motion-reduce:transition-none hover:border-primary/30 hover:bg-app-surface hover:text-primary"
                        >
                          <RiUser3Fill className="text-app-text-muted group-hover/btn:text-primary" />
                          Ver alumnos
                        </button>
                      </div>
                      <p className="mt-3 line-clamp-1 text-xs text-app-text-secondary">
                        {group.description || "Sin descripción"}
                      </p>
                    </div>

                    {/* Footer con Indicador de Estado */}
                    <div className="mt-5 flex items-center justify-between border-t border-app-border pt-4">
                      <StatusBadge tone={isGroupAssigned ? 'success' : 'idle'}>
                        {isGroupAssigned ? 'Grupo asignado' : 'Sin matricular'}
                      </StatusBadge>
                    </div>
                    
                    {/* Overlay de Carga */}
                    {assignmentBusy && (assignmentBusy === `assign:groups` || assignmentBusy.startsWith('revoke:')) && (
                      <div className="absolute inset-0 z-10 flex items-center justify-center bg-app-surface/70">
                        <RiRefreshLine className="text-2xl text-primary animate-spin motion-reduce:animate-none" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
