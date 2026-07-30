/**
 * @fileoverview Componente compartido de la interfaz DockUS (CommandPalette).
 *
 * @module CommandPalette
 */

import { useState, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  RiSearch2Line,
  RiStackFill,
  RiPulseFill,
  RiCommandFill,
  RiArrowRightLine,
  RiGlobalLine,
  RiLayoutGridFill
} from 'react-icons/ri';
import { useNavigate } from 'react-router';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useWorkspaceSelection } from '../workspace/WorkspaceContext';
import { projectsApi, assignmentsApi } from '../api/services';
import { queryKeys } from '../query/queryKeys';
import type { ProjectAssignmentEntity } from '../../features/projects/types';

interface CommandItem {
  id: string;
  category: 'Proyectos' | 'Alumnos' | 'Acciones';
  label: string;
  description?: string;
  icon: ReactNode;
  action: () => void;
}

export function CommandPalette(): JSX.Element | null {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { selection, setProject, setAssignment } = useWorkspaceSelection();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useFocusTrap<HTMLDivElement>(isOpen, inputRef);
  const dialogTitleId = 'command-palette-title';
  const listboxId = 'command-palette-listbox';

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    const handleOpenEvent = () => setIsOpen(true);

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('open-command-palette', handleOpenEvent);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('open-command-palette', handleOpenEvent);
    };
  }, []);

  const queryClient = useQueryClient();

  // Pre-carga en cuanto el componente monta (queda montado toda la sesión,
  // solo oculto tras `isOpen`), así el listado ya está listo la primera vez
  // que el usuario abre la paleta. El resultado aplanado+enriquecido vive
  // bajo su propia key, pero cada sub-fetch pasa por queryClient.fetchQuery
  // con la key que comparten WorkspaceBar (proyectos) y
  // Deliveries/Proyectos/WorkspaceBar (asignaciones por proyecto), así que
  // reutiliza esa caché en vez de pedirla de nuevo.
  const assignmentsQuery = useQuery({
    queryKey: queryKeys.commandPalette.assignments(),
    queryFn: async (): Promise<ProjectAssignmentEntity[]> => {
      const projectsRes = await queryClient.fetchQuery({
        queryKey: queryKeys.projects.picker(),
        queryFn: () => projectsApi.list({ page: 1, limit: 50 }),
      });
      const perProject = await Promise.all(
        projectsRes.data.map((p) =>
          queryClient
            .fetchQuery({
              queryKey: queryKeys.assignments.byProject(p.id),
              queryFn: () => assignmentsApi.listByProject(p.id),
            })
            .then((asgs) => asgs.map((a) => ({ ...a, projectId: p.id, projectTitle: p.title }))),
        ),
      );
      return perProject.flat();
    },
  });
  const assignments = assignmentsQuery.data ?? [];

  useEffect(() => {
    if (assignmentsQuery.isError) {
      console.error("Error loading assignments for command palette:", assignmentsQuery.error);
    }
  }, [assignmentsQuery.isError, assignmentsQuery.error]);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      setSearch("");
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const projectTitle = selection.projectTitle;

  const commands: CommandItem[] = useMemo(() => {
    const list: CommandItem[] = [
      {
        id: 'nav-projects',
        category: 'Acciones',
        label: 'Ir a Proyectos',
        description: 'Ver lista general de proyectos',
        icon: <RiGlobalLine />,
        action: () => navigate('/projects'),
      },
      {
        id: 'nav-runtime',
        category: 'Acciones',
        label: 'Abrir Runtime Control',
        description: 'Gestionar ejecuciones activas',
        icon: <RiPulseFill />,
        action: () => navigate('/runtime'),
      },
    ];

    if (projectTitle) {
      list.push({
        id: 'p1',
        category: 'Proyectos',
        label: `Proyecto: ${projectTitle}`,
        description: 'Ver detalles del proyecto activo',
        icon: <RiStackFill className="text-primary" />,
        action: () => navigate('/projects'),
      });
    }

    // Deduplicar alumnos por email para evitar duplicados en la lista de búsqueda
    const uniqueStudents: Record<string, ProjectAssignmentEntity> = {};
    for (const a of assignments) {
      const email = a.studentEmail;
      if (!email) continue;
      
      const existing = uniqueStudents[email];
      if (!existing) {
        uniqueStudents[email] = a;
      } else {
        // Si el alumno está en varios proyectos, preferir el que coincide con el proyecto activo
        if (a.projectId === selection.projectId) {
          uniqueStudents[email] = a;
        }
      }
    }

    for (const a of Object.values(uniqueStudents)) {
      const isCurrentProject = a.projectId === selection.projectId;
      list.push({
        id: `asg-${a.id}`,
        category: 'Alumnos',
        label: a.studentName || 'Alumno sin nombre',
        description: isCurrentProject 
          ? `Email: ${a.studentEmail} (Proyecto actual)`
          : `Email: ${a.studentEmail} (Proyecto: ${a.projectTitle})`,
        icon: <RiLayoutGridFill className="text-warning-400" />,
        action: () => {
          if (a.projectId) setProject(a.projectId, a.projectTitle || undefined);
          setAssignment(a.id, a.studentName);
          navigate('/deliveries');
        },
      });
    }

    return list;
  }, [navigate, projectTitle, assignments, setProject, setAssignment]);

  const filteredCommands = useMemo(() => {
    const query = search.toLowerCase().trim();
    if (!query) return commands;
    return commands.filter(cmd => 
      cmd.label.toLowerCase().includes(query) || 
      cmd.description?.toLowerCase().includes(query) ||
      cmd.category.toLowerCase().includes(query)
    );
  }, [commands, search]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  const closePalette = () => setIsOpen(false);

  const runCommand = (command: CommandItem) => {
    command.action();
    closePalette();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closePalette();
      return;
    }
    if (filteredCommands.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % filteredCommands.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredCommands[selectedIndex]) {
        runCommand(filteredCommands[selectedIndex]);
      }
    }
  };

  if (!isOpen) return null;

  const selectedCommand = filteredCommands[selectedIndex];

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh] px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={dialogTitleId}
    >
      <div 
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" 
        onClick={closePalette}
        aria-hidden="true"
      />
      
      <div className="relative w-full max-w-2xl overflow-hidden rounded-lg border border-app-border bg-white shadow-sm">
        <h2 id={dialogTitleId} className="sr-only">Paleta de comandos</h2>
        <div className="flex items-center gap-4 border-b border-slate-100 p-6">
          <RiSearch2Line className="text-2xl text-slate-400" aria-hidden="true" />
          <input
            ref={inputRef}
            className="flex-1 border-none bg-transparent text-xl font-bold tracking-tight text-slate-900 placeholder:text-slate-300 focus:ring-0"
            placeholder="¿Qué quieres hacer hoy? (Buscar proyectos, alumnos...)"
            aria-label="Buscar comandos"
            aria-controls={listboxId}
            aria-activedescendant={selectedCommand ? 'command-palette-option-' + selectedCommand.id : undefined}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-400" aria-hidden="true">
            <RiCommandFill /> K
          </div>
        </div>

        <div id={listboxId} role="listbox" aria-label="Comandos disponibles" className="max-h-[50vh] overflow-y-auto no-scrollbar p-3">
          {filteredCommands.length > 0 ? (
            <div className="space-y-4">
              {['Acciones', 'Proyectos', 'Alumnos'].map((cat) => {
                const catCommands = filteredCommands.filter(c => c.category === cat);
                if (catCommands.length === 0) return null;

                return (
                  <div key={cat} className="space-y-1">
                    <div className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      {cat}
                    </div>
                    {catCommands.map((cmd) => {
                      const globalIndex = filteredCommands.indexOf(cmd);
                      const isSelected = globalIndex === selectedIndex;

                      return (
                        <button
                          id={'command-palette-option-' + cmd.id}
                          key={cmd.id}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => runCommand(cmd)}
                          onMouseEnter={() => setSelectedIndex(globalIndex)}
                          className={[
                            'group flex w-full items-center justify-between gap-4 rounded-2xl p-4 text-left transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                            isSelected ? 'bg-primary text-white' : 'hover:bg-slate-50',
                          ].join(' ')}
                        >
                          <div className="flex items-center gap-4 truncate">
                            <div className={[
                              'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl transition-colors',
                              isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-primary/5 group-hover:text-primary',
                            ].join(' ')} aria-hidden="true">
                              {cmd.icon}
                            </div>
                            <div className="truncate">
                              <div className={['text-sm font-bold tracking-tight', isSelected ? 'text-white' : 'text-slate-900'].join(' ')}>
                                {cmd.label}
                              </div>
                              {cmd.description && (
                                <div className={['text-[11px] font-medium', isSelected ? 'text-primary-muted' : 'text-slate-500'].join(' ')}>
                                  {cmd.description}
                                </div>
                              )}
                            </div>
                          </div>
                          {isSelected && (
                            <RiArrowRightLine className="text-xl" aria-hidden="true" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center" role="status">
              <RiSearch2Line className="mb-4 text-4xl text-slate-100" aria-hidden="true" />
              <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">No hay resultados para &quot;{search}&quot;</p>
            </div>
          )}
        </div>

        <div className="border-t border-slate-50 bg-slate-50/50 p-4">
          <div className="flex items-center justify-center gap-6 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <div className="flex items-center gap-1.5">
              <span className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-slate-500 shadow-sm">↵</span> Seleccionar
            </div>
            <div className="flex items-center gap-1.5">
              <span className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-slate-500 shadow-sm">↑↓</span> Navegar
            </div>
            <div className="flex items-center gap-1.5">
              <span className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-slate-500 shadow-sm">ESC</span> Cerrar
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
