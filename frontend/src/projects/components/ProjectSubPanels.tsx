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


type GroupFormState = {
  name: string;
  code: string;
  description: string;
};

interface ProjectAssignmentManagerProps {
  project: ProjectEntity;
  students: UserEntity[];
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
  const pendingCount = students.length - activeAssignmentsCount;
  const coveragePercent = students.length > 0 ? Math.round((activeAssignmentsCount / students.length) * 100) : 0;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

      {/* 1. Metrics Header */}
      <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Alumnos", value: students.length, helper: "En la plataforma", icon: <RiUser3Fill />, variant: "dark" as const },
          { label: "Matriculados", value: activeAssignmentsCount, helper: `${coveragePercent}% completado`, icon: <RiCheckFill />, variant: "success" as const },
          { label: "Sin Proyecto", value: pendingCount, helper: "Esperando asignación", icon: <RiSparkling2Line />, variant: "warning" as const },
          { label: "Grupos", value: groups.length, helper: "Disponibles para asignar", icon: <RiTeamFill />, variant: "info" as const },
        ].map((metric, idx) => (
          <div key={idx} className="group/metric animate-in fade-in slide-in-from-top-4 duration-500" style={{ animationDelay: `${idx * 100}ms` }}>
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
          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm overflow-hidden relative">
            <div className="absolute -right-4 -top-4 opacity-[0.05] text-8xl text-primary/30 pointer-events-none">
              <RiSearchLine />
            </div>

            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4">Filtrado y Búsqueda</h4>
            <div className="space-y-4">
              <div className="relative group">
                <RiSearchLine className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" />
                <input
                  className="w-full h-12 pl-11 pr-4 rounded-2xl bg-slate-50 border-transparent focus:bg-white focus:border-primary/20 focus:ring-4 focus:ring-primary/5 transition-all text-sm font-medium"
                  placeholder="Buscar grupo o código..."
                  value={searchTerm}
                  onChange={(e) => onSearchChange(e.target.value)}
                />
              </div>

              <div className="flex gap-2">
                <button
                  className="w-full flex items-center justify-center gap-2 h-11 rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/10 text-xs font-bold uppercase tracking-widest"
                  onClick={onRefreshAssignments}
                >
                  <RiRefreshLine className={assignmentBusy ? "animate-spin" : ""} />
                  Sincronizar
                </button>
              </div>
            </div>
          </div>


        </aside>

        {/* Main Grid: Group Cards */}
        <section className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
                Classroom Hub
                <span className="text-xs font-medium bg-primary-subtle text-primary px-3 py-1 rounded-full border border-primary/10 uppercase tracking-widest">
                  {filteredGroups.length} Grupos
                </span>
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Gestiona la matriculación por grupos académicos
              </p>
            </div>

            <div className="flex items-center gap-3">
               <button
                  className="group/btn relative h-12 px-8 flex items-center justify-center gap-3 rounded-2xl bg-slate-950 text-white text-[11px] font-black uppercase tracking-[0.1em] hover:bg-slate-900 transition-all shadow-[0_10px_30px_-5px_rgba(15,23,42,0.2)] hover:shadow-[0_15px_35px_-5px_rgba(15,23,42,0.3)] hover:-translate-y-0.5 disabled:opacity-50 overflow-hidden"
                  onClick={() => onAssignGroups(groups.map(g => g.id))}
                  disabled={groups.length === 0 || !!assignmentBusy}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent opacity-0 group-hover/btn:opacity-100 transition-opacity" />
                  <RiTeamFill className="text-lg group-hover/btn:rotate-12 transition-transform" />
                  Matricular todos los grupos
                </button>
            </div>
          </div>

          {filteredGroups.length === 0 ? (
            <EmptyState
              title="No hay grupos"
              description={searchTerm ? "No se encontraron grupos que coincidan con tu búsqueda." : "No hay grupos registrados en el sistema."}
              icon={<RiGroupLine className="text-5xl text-slate-200" />}
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {filteredGroups.map((group) => {
                const isFocused = focusedGroupId === group.id;
                
                // Determinamos si el grupo tiene alumnos ya asignados al proyecto
                const groupAssignments = assignments.filter(a => 
                  !a.revokedAt && 
                  (a.courseGroupId === group.id || a.sourceGroupIds?.includes(group.id))
                );
                const isGroupAssigned = groupAssignments.length > 0;
                
                return (
                  <article
                    key={group.id}
                    onClick={() => onFocusedGroupChange(group.id)}
                    className={`group relative flex flex-col p-6 rounded-[2rem] border transition-all duration-500 cursor-pointer overflow-hidden ${
                      isGroupAssigned
                        ? 'bg-white border-emerald-100 shadow-emerald-500/5'
                        : isFocused
                          ? 'bg-white border-primary ring-4 ring-primary/5 shadow-xl'
                          : 'bg-white border-slate-100 hover:border-slate-300 hover:shadow-xl'
                    }`}
                  >
                    {/* Card Header with Status Toggle */}
                    <div className="flex items-start justify-between mb-5">
                      <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.25rem] text-2xl transition-all duration-500 shadow-sm ${
                        isGroupAssigned
                          ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                          : isFocused
                            ? 'bg-primary text-white shadow-lg shadow-primary/20'
                            : 'bg-slate-50 text-slate-400 group-hover:bg-primary/10 group-hover:text-primary group-hover:scale-110 group-hover:rotate-3'
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
                        className={`h-7 w-12 rounded-full transition-all relative flex items-center shadow-inner ${
                          isGroupAssigned ? 'bg-emerald-500' : 'bg-slate-200 hover:bg-slate-300'
                        }`}
                      >
                        <div className={`absolute left-1 h-5 w-5 rounded-full bg-white transition-all shadow-md flex items-center justify-center ${
                          isGroupAssigned ? 'translate-x-5' : 'translate-x-0'
                        }`}>
                          {isGroupAssigned && <RiCheckFill className="text-[10px] text-emerald-600 font-bold" />}
                        </div>
                      </button>
                    </div>

                    {/* Group Info */}
                    <div className="min-w-0">
                      <span className={`text-[9px] font-black uppercase tracking-widest ${
                        isGroupAssigned ? 'text-emerald-500' : 'text-slate-400'
                      }`}>
                        {group.code || "SC"}
                      </span>
                      <h4 className="text-lg font-bold text-slate-900 truncate mt-0.5">
                        {group.name}
                      </h4>
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            // Navegamos a la pestaña general de grupos
                            window.location.href = `/groups?focusedGroupId=${group.id}`;
                          }}
                          className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-100 text-[10px] font-bold text-slate-600 uppercase tracking-widest hover:bg-white hover:border-primary/20 hover:text-primary transition-all shadow-sm flex items-center gap-2 group/btn"
                        >
                          <RiUser3Fill className="text-slate-400 group-hover/btn:text-primary" />
                          Ver alumnos
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-500 line-clamp-1 mt-3">
                        {group.description || "Sin descripción"}
                      </p>
                    </div>

                    {/* Footer con Indicador de Estado */}
                    <div className="mt-5 flex items-center justify-between pt-4 border-t border-slate-50">
                      <span className={`text-[9px] font-black uppercase tracking-widest ${
                        isGroupAssigned ? 'text-emerald-500' : 'text-slate-400'
                      }`}>
                        {isGroupAssigned ? 'Grupo Asignado' : 'Sin Matricular'}
                      </span>

                      <div className="flex items-center gap-2">
                         {isGroupAssigned ? (
                           <div className="h-6 w-6 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-sm border border-emerald-100 animate-in zoom-in-50">
                              <RiCheckFill className="text-xs" />
                           </div>
                         ) : (
                           <div className="h-6 w-6 rounded-full bg-slate-50 text-slate-300 flex items-center justify-center border border-slate-100">
                              <RiGroupLine className="text-[10px]" />
                           </div>
                         )}
                      </div>
                    </div>
                    
                    {/* Overlay de Carga */}
                    {assignmentBusy && (assignmentBusy === `assign:groups` || assignmentBusy.startsWith('revoke:')) && (
                      <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] flex items-center justify-center z-10 animate-in fade-in">
                        <RiRefreshLine className="text-2xl text-primary animate-spin" />
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}


