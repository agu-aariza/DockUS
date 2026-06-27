import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  RiSearch2Line, 
  RiStackFill, 
  RiPulseFill, 
  RiCommandFill,
  RiArrowRightLine,
  RiGlobalLine
} from 'react-icons/ri';
import { useNavigate } from 'react-router-dom';
import { useWorkspace } from '../workspace/WorkspaceContext';

interface CommandItem {
  id: string;
  category: 'Proyectos' | 'Alumnos' | 'Acciones';
  label: string;
  description?: string;
  icon: React.ReactNode;
  action: () => void;
}

export function CommandPalette(): JSX.Element | null {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { selection } = useWorkspace();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  // Toggle palette with Cmd+K or Ctrl+K
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

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      setSearch("");
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Demo Commands - In a real app, these would come from an API or a shared hook
  const commands: CommandItem[] = useMemo(() => [
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
    // Mock Projects for demo (ideally populated from context/state)
    {
      id: 'p1',
      category: 'Proyectos',
      label: selection.projectTitle || 'Seleccionar Proyecto Actual',
      description: 'Ver detalles del proyecto activo',
      icon: <RiStackFill className="text-primary" />,
      action: () => navigate('/projects'),
    },
  ], [navigate, selection]);

  const filteredCommands = useMemo(() => {
    const query = search.toLowerCase().trim();
    if (!query) return commands;
    return commands.filter(cmd => 
      cmd.label.toLowerCase().includes(query) || 
      cmd.description?.toLowerCase().includes(query) ||
      cmd.category.toLowerCase().includes(query)
    );
  }, [commands, search]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % filteredCommands.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredCommands[selectedIndex]) {
        filteredCommands[selectedIndex].action();
        setIsOpen(false);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh] px-4">
      <div 
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" 
        onClick={() => setIsOpen(false)} 
      />
      
      <div className="relative w-full max-w-2xl overflow-hidden rounded-lg border border-app-border bg-white shadow-sm">
        {/* Search Bar */}
        <div className="flex items-center gap-4 border-b border-slate-100 p-6">
          <RiSearch2Line className="text-2xl text-slate-400" />
          <input
            ref={inputRef}
            className="flex-1 border-none bg-transparent text-xl font-bold tracking-tight text-slate-900 placeholder:text-slate-300 focus:ring-0"
            placeholder="¿Qué quieres hacer hoy? (Buscar proyectos, alumnos...)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-400">
            <RiCommandFill /> K
          </div>
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto no-scrollbar p-3">
          {filteredCommands.length > 0 ? (
            <div className="space-y-4">
              {['Acciones', 'Proyectos', 'Alumnos'].map((cat) => {
                const catCommands = filteredCommands.filter(c => c.category === cat);
                if (catCommands.length === 0) return null;

                return (
                  <div key={cat} className="space-y-1">
                    <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                      {cat}
                    </div>
                    {catCommands.map((cmd) => {
                      const globalIndex = filteredCommands.indexOf(cmd);
                      const isSelected = globalIndex === selectedIndex;

                      return (
                        <button
                          key={cmd.id}
                          onClick={() => {
                            cmd.action();
                            setIsOpen(false);
                          }}
                          onMouseEnter={() => setSelectedIndex(globalIndex)}
                          className={`group flex w-full items-center justify-between gap-4 rounded-2xl p-4 text-left transition-all ${
                            isSelected ? 'bg-primary text-white' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-4 truncate">
                            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl transition-colors ${
                              isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-primary/5 group-hover:text-primary'
                            }`}>
                              {cmd.icon}
                            </div>
                            <div className="truncate">
                              <div className={`text-sm font-bold tracking-tight ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                                {cmd.label}
                              </div>
                              {cmd.description && (
                                <div className={`text-[11px] font-medium ${isSelected ? 'text-primary-muted' : 'text-slate-500'}`}>
                                  {cmd.description}
                                </div>
                              )}
                            </div>
                          </div>
                          {isSelected && (
                            <RiArrowRightLine className="text-xl" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <RiSearch2Line className="mb-4 text-4xl text-slate-100" />
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No hay resultados para "{search}"</p>
            </div>
          )}
        </div>

        {/* Footer */}
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
