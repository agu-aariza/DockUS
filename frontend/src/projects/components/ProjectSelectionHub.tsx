/**
 * @fileoverview Selector de proyecto del dominio de proyectos (ProjectSelectionHub).
 *
 * @module ProjectSelectionHub
 */

import React from 'react';
import { RiStackFill, RiUser3Fill, RiArrowRightLine, RiPlayLine, RiTeamFill } from 'react-icons/ri';
import { StatusBadge, type StatusTone } from '../../shared/components/ui/StatusBadge';
import type { UserEntity } from "../../features/auth/types";

export interface ProjectHubOption {
  id: string;
  title: string;
  description: string;
  studentCount: number;
  activeRuns: number;
  status: 'READY' | 'PROVISIONING' | 'ERROR' | 'HALTED';
  teachers?: UserEntity[];
}

interface ProjectSelectionHubProps {
  projects: ProjectHubOption[];
  onSelect: (_id: string, _label: string) => void;
  title?: string;
  subtitle?: string;
}

const STATUS_CONFIG: Record<
  ProjectHubOption['status'],
  { text: string; iconWrap: string; tone: StatusTone }
> = {
  READY: {
    text: 'Listo',
    iconWrap: 'bg-success-50 text-success-600',
    tone: 'success',
  },
  PROVISIONING: {
    text: 'Provisionando',
    iconWrap: 'bg-primary-subtle text-primary',
    tone: 'info',
  },
  ERROR: {
    text: 'Error',
    iconWrap: 'bg-rose-50 text-rose-600',
    tone: 'danger',
  },
  HALTED: {
    text: 'Detenido',
    iconWrap: 'bg-slate-100 text-slate-600',
    tone: 'idle',
  },
};

export function ProjectSelectionHub({ 
  projects, 
  onSelect, 
  title = "Selecciona un Proyecto para Empezar",
  subtitle = "Elige un entorno operativo para gestionar ejecuciones y entregas en tiempo real."
}: ProjectSelectionHubProps) {
  if (projects.length === 0) {
    return (
      <div className="py-12">
        <div className="text-center mb-12">
          <h2 className="font-display text-4xl leading-tight text-slate-900 sm:text-5xl">
            {title}
          </h2>
          <p className="mt-4 text-lg text-slate-500 max-w-2xl mx-auto">
            {subtitle}
          </p>
        </div>
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/30 px-8 py-16 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white border border-slate-200/60 text-slate-400 shadow-sm">
            <RiTeamFill className="text-2xl" />
          </div>
          <h3 className="text-lg font-bold tracking-tight text-slate-900">
            No hay proyectos disponibles
          </h3>
          <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">
            Crea o activa un proyecto para empezar a gestionar entregas y revisión académica.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="py-12">
      <div className="text-center mb-12">
        <h2 className="font-display text-4xl leading-tight text-slate-900 sm:text-5xl">
          {title}
        </h2>
        <p className="mt-4 text-lg text-slate-500 max-w-2xl mx-auto">
          {subtitle}
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => {
          const status = STATUS_CONFIG[project.status] || STATUS_CONFIG.READY;
          
          return (
            <button
              key={project.id}
              onClick={() => onSelect(project.id, project.title)}
              className="group relative flex flex-col text-left bg-white border border-slate-200/80 rounded-2xl p-8 transition-all duration-300 hover:border-primary/40 hover:-translate-y-1 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-primary/10 shadow-sm"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-6">
                <div className={`p-4 rounded-xl ${status.iconWrap} group-hover:bg-primary/10 group-hover:text-primary transition-all duration-300 shadow-sm`}>
                  <RiStackFill className="text-3xl" />
                </div>
                <StatusBadge tone={status.tone}>{status.text}</StatusBadge>
              </div>

              {/* Content */}
              <h3 className="text-2xl font-bold text-slate-900 mb-2 group-hover:text-primary transition-colors">
                {project.title}
              </h3>
              <p className="text-sm text-slate-500 line-clamp-2 mb-8 leading-relaxed">
                {project.description}
              </p>

              {/* Stats Footer */}
              <div className="mt-auto pt-6 border-t border-slate-100 flex items-center justify-between w-full">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <RiUser3Fill className="text-base" />
                    <span className="text-xs font-bold">{project.studentCount}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <RiPlayLine className="text-base" />
                    <span className="text-xs font-bold">{project.activeRuns}</span>
                  </div>
                  {project.teachers && project.teachers.length > 0 && (
                    <div className="flex -space-x-2 ml-2">
                      {project.teachers.slice(0, 3).map((teacher) => (
                        <div 
                          key={teacher.id}
                          className="h-6 w-6 rounded-full border-2 border-white bg-gradient-to-tr from-primary to-primary-hover flex items-center justify-center text-[8px] font-bold text-white uppercase shadow-sm"
                          title={`${teacher.firstName} ${teacher.lastName}`}
                        >
                          {teacher.firstName[0]}{teacher.lastName[0]}
                        </div>
                      ))}
                      {project.teachers.length > 3 && (
                        <div className="h-6 w-6 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[8px] font-bold text-slate-400 shadow-sm">
                          +{project.teachers.length - 3}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                <div className="flex items-center gap-1 text-primary font-bold text-xs uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                  Seleccionar <RiArrowRightLine className="text-base" />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
