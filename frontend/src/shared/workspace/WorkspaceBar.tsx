import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  RiStackFill,
  RiLayoutGridFill,
  RiPulseFill,
  RiCloseCircleFill,
  RiArrowRightSLine,
  RiSearch2Line,
  RiCheckLine,
  RiLoader4Line,
  RiSubtractLine,
  RiCloseLine
} from "react-icons/ri";
import { useWorkspace } from "./WorkspaceContext";
import { projectsApi, assignmentsApi, deliveriesApi, builderApi } from "../api/services";
import type { ProjectEntity, ProjectAssignmentEntity } from "../../features/projects/types";
import type { DeliveryEntity } from "../../features/deliveries/types";
import type { BuildRunEntity } from "../../features/builder/types";

type PickerType = 'project' | 'assignment' | 'delivery' | 'run' | null;
type PickerOption = ProjectEntity | ProjectAssignmentEntity | DeliveryEntity | BuildRunEntity;

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'text-emerald-400',
  SUCCESS: 'text-emerald-400',
  EVALUATED: 'text-emerald-400',
  DRAFT: 'text-amber-400',
  IN_PROGRESS: 'text-amber-400',
  IN_REVIEW: 'text-amber-400',
  PENDING: 'text-amber-400',
  ARCHIVED: 'text-rose-400',
  FAILED: 'text-rose-400',
};

function statusColor(status: string): string {
  return STATUS_COLORS[status.toUpperCase()] ?? 'text-slate-400';
}

export function WorkspaceBar(): JSX.Element | null {
  const { selection, clearWorkspace, setProject, setAssignment, setDelivery, setRun, isMinimized, setIsMinimized } = useWorkspace();
  const navigate = useNavigate();

  const handleMinimizeToggle = () => {
    setIsMinimized(!isMinimized);
  };

  const [openPicker, setOpenPicker] = useState<PickerType>(null);
  const [projects, setProjects] = useState<ProjectEntity[]>([]);
  const [assignments, setAssignments] = useState<ProjectAssignmentEntity[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryEntity[]>([]);
  const [runs, setRuns] = useState<BuildRunEntity[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const pickerRef = useRef<HTMLDivElement>(null);

  // Close picker on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setOpenPicker(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close picker on ESC
  useEffect(() => {
    if (!openPicker) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenPicker(null); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [openPicker]);

  // Reset search when picker changes
  useEffect(() => {
    setSearch("");
  }, [openPicker]);

  // Fetch Data
  useEffect(() => {
    if (!openPicker) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        if (openPicker === 'project') {
          const res = await projectsApi.list({ page: 1, limit: 50 });
          setProjects(res.data);
        } else if (openPicker === 'assignment' && selection.projectId) {
          const res = await assignmentsApi.listByProject(selection.projectId);
          setAssignments(res);
        } else if (openPicker === 'delivery' && selection.projectId) {
          const res = await deliveriesApi.list({
            projectId: selection.projectId,
            assignmentId: selection.assignmentId || undefined
          });
          setDeliveries(res.data);
        } else if (openPicker === 'run' && selection.deliveryId) {
          const res = await builderApi.listByDelivery({ deliveryId: selection.deliveryId });
          setRuns(res.data);
        }
      } catch (err) {
        console.error("Error fetching island data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [openPicker, selection.projectId, selection.assignmentId]);

  const filteredOptions = useMemo((): PickerOption[] => {
    const q = search.toLowerCase().trim();
    if (openPicker === 'project') {
      return projects.filter(p => p.title.toLowerCase().includes(q));
    }
    if (openPicker === 'assignment') {
      return assignments.filter(a =>
        a.studentEmail.toLowerCase().includes(q) ||
        a.studentName.toLowerCase().includes(q)
      );
    }
    if (openPicker === 'delivery') {
      return deliveries.filter(d =>
        new Date(d.createdAt).toLocaleString().toLowerCase().includes(q) ||
        d.status.toLowerCase().includes(q) ||
        (d.studentName?.toLowerCase().includes(q) ?? false)
      );
    }
    if (openPicker === 'run') {
      return runs.filter(r =>
        r.id.toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q)
      );
    }
    return [];
  }, [openPicker, projects, assignments, deliveries, runs, search]);

  if (!selection.projectId && !selection.assignmentId && !selection.deliveryId) {
    return null;
  }

  const togglePicker = (type: PickerType) => {
    setOpenPicker(prev => prev === type ? null : type);
  };

  if (isMinimized) {
    return null;
  }

  return (
    <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[100] max-w-[95%] sm:max-w-none" ref={pickerRef}>
      <div className="flex items-center gap-1 bg-slate-900/90 backdrop-blur border border-white/10 p-1.5 rounded-full">

        {/* Project Context */}
        {selection.projectId && (
          <div className="relative flex items-center">
            <button
              type="button"
              aria-label="Cambiar proyecto del espacio de trabajo"
              aria-expanded={openPicker === 'project'}
              aria-controls="workspace-picker-listbox"
              onClick={() => togglePicker('project')}
              className={`flex items-center gap-2.5 px-4 py-2 rounded-full transition-colors duration-150 motion-reduce:transition-none text-xs font-bold group ${
                openPicker === 'project' ? 'bg-white/20 text-white' : 'hover:bg-white/10 text-white'
              }`}
            >
              <RiStackFill className="text-accent text-base transition-colors duration-150 motion-reduce:transition-none" />
              <span className="truncate max-w-[100px] sm:max-w-[150px] uppercase tracking-wider">{selection.projectTitle || "Proyecto"}</span>
            </button>
            <button
              type="button"
              onClick={() => clearWorkspace()}
              className="pr-2 text-slate-500 hover:text-rose-400 transition-colors"
              title="Limpiar contexto"
              aria-label="Limpiar contexto del espacio de trabajo"
            >
              <RiCloseCircleFill className="text-lg" />
            </button>
          </div>
        )}

        {/* Assignment Context */}
        {selection.assignmentId && (
          <div className="relative flex items-center">
            <RiArrowRightSLine className="text-slate-700 text-lg mx-0.5" />
            <button
              type="button"
              aria-label="Cambiar alumno asignado del espacio de trabajo"
              aria-expanded={openPicker === 'assignment'}
              aria-controls="workspace-picker-listbox"
              onClick={() => togglePicker('assignment')}
              className={`flex items-center gap-2.5 px-4 py-2 rounded-full transition-colors duration-150 motion-reduce:transition-none text-xs font-bold group ${
                openPicker === 'assignment' ? 'bg-white/20 text-white' : 'hover:bg-white/10 text-white'
              }`}
            >
              <RiLayoutGridFill className="text-amber-400 text-base transition-colors duration-150 motion-reduce:transition-none" />
              <span className="truncate max-w-[100px] sm:max-w-[150px] uppercase tracking-wider">{selection.assignmentLabel || "Alumno"}</span>
            </button>
            <button
              type="button"
              onClick={() => { if (selection.projectId) setProject(selection.projectId, selection.projectTitle ?? undefined) }}
              className="pr-2 text-slate-500 hover:text-rose-400 transition-colors"
              title="Cerrar alumno"
              aria-label="Quitar alumno del contexto"
            >
              <RiCloseCircleFill className="text-lg" />
            </button>
          </div>
        )}

        {/* Delivery Context */}
        {selection.deliveryId && (
          <div className="relative flex items-center">
            <RiArrowRightSLine className="text-slate-700 text-lg mx-0.5" />
            <button
              type="button"
              aria-label="Cambiar entrega del espacio de trabajo"
              aria-expanded={openPicker === 'delivery'}
              aria-controls="workspace-picker-listbox"
              onClick={() => togglePicker('delivery')}
              className={`flex items-center gap-2.5 px-4 py-2 rounded-full transition-colors duration-150 motion-reduce:transition-none text-xs font-bold group ${
                openPicker === 'delivery' ? 'bg-white/20 text-white' : 'hover:bg-white/10 text-white'
              }`}
            >
              <RiPulseFill className="text-primary text-base transition-colors duration-150 motion-reduce:transition-none" />
              <span className="truncate max-w-[100px] sm:max-w-[150px] uppercase tracking-wider">{selection.deliveryLabel || "Entrega"}</span>
            </button>
            <button
              type="button"
              onClick={() => { if (selection.assignmentId) setAssignment(selection.assignmentId, selection.assignmentLabel ?? undefined) }}
              className="pr-2 text-slate-500 hover:text-rose-400 transition-colors"
              title="Cerrar entrega"
              aria-label="Quitar entrega del contexto"
            >
              <RiCloseCircleFill className="text-lg" />
            </button>
          </div>
        )}

        {/* Run Context */}
        {selection.lastRunId && (
          <div className="relative flex items-center">
            <RiArrowRightSLine className="text-slate-700 text-lg mx-0.5" />
            <button
              type="button"
              aria-label="Cambiar ejecución del espacio de trabajo"
              aria-expanded={openPicker === 'run'}
              aria-controls="workspace-picker-listbox"
              onClick={() => togglePicker('run')}
              className={`flex items-center gap-2.5 px-4 py-2 rounded-full transition-colors duration-150 motion-reduce:transition-none text-xs font-bold group ${
                openPicker === 'run' ? 'bg-white/20 text-white' : 'hover:bg-white/10 text-white'
              }`}
            >
              <RiLoader4Line className={`text-sky-400 text-base transition-colors duration-150 motion-reduce:transition-none ${selection.lastRunId ? '' : 'animate-spin motion-reduce:animate-none'}`} />
              <span className="truncate max-w-[100px] sm:max-w-[150px] uppercase tracking-wider">Run #{selection.lastRunId.slice(-4)}</span>
            </button>
            <button
              type="button"
              onClick={() => { if (selection.deliveryId) setDelivery(selection.deliveryId, selection.deliveryLabel ?? undefined) }}
              className="pr-2 text-slate-500 hover:text-rose-400 transition-colors"
              title="Cerrar ejecución"
              aria-label="Quitar ejecución del contexto"
            >
              <RiCloseCircleFill className="text-lg" />
            </button>
          </div>
        )}

        {/* Global Controls */}
        <div className="h-5 w-px bg-white/15 mx-1.5 self-center" />
        
        <button
          type="button"
          aria-label="Minimizar barra de espacio de trabajo"
          onClick={handleMinimizeToggle}
          className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          title="Minimizar barra"
        >
          <RiSubtractLine className="text-base" />
        </button>

        <button
          type="button"
          aria-label="Limpiar todo el contexto del espacio de trabajo"
          onClick={() => clearWorkspace()}
          className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer mr-1"
          title="Limpiar todo el contexto"
        >
          <RiCloseLine className="text-base" />
        </button>
      </div>

      {/* Popover List */}
      {openPicker && (
        <div className="absolute top-full left-0 right-0 mt-3 max-h-[350px] flex flex-col overflow-hidden rounded-lg border border-white/10 bg-slate-900/95">
          {/* Search */}
          <div className="p-3 border-b border-white/5 bg-white/5">
            <div className="relative">
              <RiSearch2Line className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                autoFocus
                aria-label="Buscar opciones del espacio de trabajo"
                aria-controls="workspace-picker-listbox"
                className="w-full rounded-md border-none bg-slate-800/50 py-2 pl-9 pr-4 text-xs font-bold text-white placeholder:text-slate-500 focus:ring-1 focus:ring-amber-400"
                placeholder={`Buscar ${openPicker === 'project' ? 'proyecto' : openPicker === 'assignment' ? 'alumno' : 'entrega'}...`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {loading && <RiLoader4Line className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-400 animate-spin" />}
            </div>
          </div>

          {/* List */}
          <div id="workspace-picker-listbox" role="listbox" aria-label="Opciones del contexto de trabajo" className="flex-1 overflow-y-auto no-scrollbar p-2">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt: PickerOption) => {
                const id = opt.id;
                let label = "";
                let sub = "";
                let subStatus = "";
                let active = false;
                let icon = <RiStackFill />;

                if (openPicker === 'project') {
                  const p = opt as ProjectEntity;
                  label = p.title;
                  subStatus = p.status;
                  active = selection.projectId === id;
                  icon = <RiStackFill className="text-accent" />;
                } else if (openPicker === 'assignment') {
                  const a = opt as ProjectAssignmentEntity;
                  label = a.studentName;
                  sub = a.studentEmail;
                  active = selection.assignmentId === id;
                  icon = <RiLayoutGridFill className="text-amber-400" />;
                } else if (openPicker === 'delivery') {
                  const d = opt as DeliveryEntity;
                  label = d.studentName
                    ? `v${d.version || 1} · ${d.studentName}`
                    : `Entrega v${d.version || 1}`;
                  sub = new Date(d.createdAt).toLocaleDateString();
                  subStatus = d.status;
                  active = selection.deliveryId === id;
                  icon = <RiPulseFill className="text-primary" />;
                } else if (openPicker === 'run') {
                  const r = opt as BuildRunEntity;
                  label = `Ejecución #${id.slice(-6)}`;
                  subStatus = r.status;
                  active = selection.lastRunId === id;
                  icon = <RiLoader4Line className="text-sky-400" />;
                }

                return (
                  <button
                    key={id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => {
                      if (openPicker === 'project') setProject(id, label);
                      else if (openPicker === 'assignment') setAssignment(id, label);
                      else if (openPicker === 'delivery') {
                        setDelivery(id, label);
                      }
                      else if (openPicker === 'run') setRun(id);
                      setOpenPicker(null);
                    }}
                    className={`group flex w-full items-center justify-between gap-3 rounded-2xl p-3 text-left transition-colors duration-150 motion-reduce:transition-none hover:bg-white/10 ${
                      active ? 'bg-white/5 border border-white/5' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3 truncate">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/5 text-lg">
                        {icon}
                      </div>
                      <div className="truncate">
                        <div className={`text-[11px] font-bold uppercase tracking-wider ${active ? 'text-amber-400' : 'text-white'}`}>
                          {label}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {sub && (
                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                              {sub}
                            </span>
                          )}
                          {subStatus && (
                            <span className={`text-[9px] font-bold uppercase tracking-wider ${statusColor(subStatus)}`}>
                              {sub ? `· ${subStatus}` : subStatus}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {active && <RiCheckLine className="text-amber-400" />}
                  </button>
                );
              })
            ) : !loading && (
              <div className="py-8 text-center">
                <RiSearch2Line className="mx-auto mb-2 text-2xl text-slate-700" />
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Sin resultados</div>
              </div>
            )}
          </div>

          {/* Global Actions */}
          <div className="p-2 bg-white/5 border-t border-white/5">
             <button
               type="button"
               onClick={() => {
                 navigate(
                   openPicker === 'project' ? '/projects' :
                   openPicker === 'assignment' || openPicker === 'delivery' ? '/deliveries' :
                   '/runtime'
                 );
                 setOpenPicker(null);
               }}
               className="w-full py-2 rounded-xl text-[9px] font-bold uppercase tracking-wider text-slate-400 hover:text-white hover:bg-white/5 transition-colors duration-150 motion-reduce:transition-none text-center"
             >
               Ver listado completo
             </button>
          </div>
        </div>
      )}
    </div>
  );
}
