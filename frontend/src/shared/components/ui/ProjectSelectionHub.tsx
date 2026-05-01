import React from 'react';
import { RiStackFill, RiUser3Fill, RiArrowRightLine, RiPlayLine, RiTeamFill } from 'react-icons/ri';
import type { UserEntity } from '../../types';

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
  onSelect: (id: string, label: string) => void;
  title?: string;
  subtitle?: string;
}

const STATUS_CONFIG = {
  READY: {
    color: 'bg-emerald-500',
    text: 'Listo',
    iconWrap: 'bg-emerald-50 text-emerald-600',
    chip: 'bg-emerald-100 text-emerald-700',
  },
  PROVISIONING: {
    color: 'bg-blue-500',
    text: 'Provisionando',
    iconWrap: 'bg-blue-50 text-blue-600',
    chip: 'bg-blue-100 text-blue-700',
  },
  ERROR: {
    color: 'bg-rose-500',
    text: 'Error',
    iconWrap: 'bg-rose-50 text-rose-600',
    chip: 'bg-rose-100 text-rose-700',
  },
  HALTED: {
    color: 'bg-slate-400',
    text: 'Detenido',
    iconWrap: 'bg-slate-100 text-slate-600',
    chip: 'bg-slate-200 text-slate-700',
  },
} as const;

export function ProjectSelectionHub({ 
  projects, 
  onSelect, 
  title = "Selecciona un Proyecto para Empezar",
  subtitle = "Elige un entorno operativo para gestionar ejecuciones y entregas en tiempo real."
}: ProjectSelectionHubProps) {
  if (projects.length === 0) {
    return (
      <div className="py-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">
            {title}
          </h2>
          <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
            {subtitle}
          </p>
        </div>
        <div className="rounded-[2.5rem] border-2 border-dashed border-slate-200 bg-slate-50/70 px-8 py-16 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-200/60 text-slate-500">
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
    <div className="py-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="text-center mb-12">
        <h2 className="text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">
          {title}
        </h2>
        <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
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
              className="group relative flex flex-col text-left bg-white border border-slate-200 rounded-[2.5rem] p-8 transition-all hover:border-brand-blue/30 hover:shadow-[0_20px_50px_-12px_rgba(46,115,154,0.15)] hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-brand-blue/40"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-6">
                <div className={`p-4 rounded-2xl ${status.iconWrap} group-hover:bg-brand-blue/10 group-hover:text-brand-blue transition-colors`}>
                  <RiStackFill className="text-3xl" />
                </div>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${status.chip}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${status.color}`} />
                  {status.text}
                </span>
              </div>

              {/* Content */}
              <h3 className="text-2xl font-bold text-slate-950 mb-2 group-hover:text-brand-blue transition-colors">
                {project.title}
              </h3>
              <p className="text-sm text-slate-500 line-clamp-2 mb-8 leading-relaxed">
                {project.description}
              </p>

              {/* Stats Footer */}
              <div className="mt-auto pt-6 border-t border-slate-100 flex items-center justify-between">
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
                          className="h-6 w-6 rounded-full border-2 border-white bg-brand-blue/10 flex items-center justify-center text-[8px] font-bold text-brand-blue uppercase"
                          title={`${teacher.firstName} ${teacher.lastName}`}
                        >
                          {teacher.firstName[0]}{teacher.lastName[0]}
                        </div>
                      ))}
                      {project.teachers.length > 3 && (
                        <div className="h-6 w-6 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[8px] font-bold text-slate-400">
                          +{project.teachers.length - 3}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                <div className="flex items-center gap-1 text-brand-blue font-bold text-xs uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
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
