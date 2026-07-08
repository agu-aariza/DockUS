import React from 'react';
import {
  RiLayoutGridLine,
  RiStackLine,
  RiPulseLine,
  RiDatabase2Line,
  RiGroupLine,
  RiLogoutBoxRLine,
  RiBookOpenLine,
  RiFolderOpenLine,
  RiInboxArchiveLine,
  RiUploadCloud2Line,
  RiFileTextLine,
} from 'react-icons/ri';
import { useWorkspace } from '../workspace/WorkspaceContext';

interface SidebarProps {
  activeTab: string;
  onTabChange: (_tab: string) => void;
  userRole?: string;
  userEmail?: string;
  onLogout: () => void;
  activeStudentTab?: string;
  onStudentTabChange?: (_tab: string) => void;
  studentHasUnread?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab, onTabChange, userRole, userEmail, onLogout,
  activeStudentTab, onStudentTabChange, studentHasUnread,
}) => {
  const isStudent = userRole === 'STUDENT';
  const { selection, isMinimized, setIsMinimized } = useWorkspace();
  const isWorkspaceActive = Boolean(selection.projectId || selection.assignmentId || selection.deliveryId);

  const teacherMainNavigation = [
    { id: 'summary', label: 'Panel de Control', icon: RiLayoutGridLine },
    { id: 'groups', label: 'Grupos', icon: RiGroupLine },
    { id: 'projects', label: 'Proyectos', icon: RiFolderOpenLine },
    { id: 'deliveries', label: 'Entregas', icon: RiStackLine },
    { id: 'runtime', label: 'Runtime', icon: RiPulseLine },
  ];

  const adminNavigation = [
    { id: 'storage', label: 'Almacenamiento', icon: RiDatabase2Line },
    { id: 'users', label: 'Usuarios', icon: RiGroupLine },
  ];

  const studentTabNavigation = [
    { id: 'summary', label: 'Resumen', icon: RiBookOpenLine },
    { id: 'proyectos', label: 'Mis proyectos', icon: RiFolderOpenLine },
    { id: 'entregas', label: 'Mis entregas', icon: RiInboxArchiveLine },
    { id: 'subir', label: 'Subir versión', icon: RiUploadCloud2Line },
    { id: 'informes', label: 'Mis informes', icon: RiFileTextLine },
  ];

  const NavItem = ({ item }: { item: { id: string, label: string, icon: React.ComponentType<{ className?: string }> } }) => {
    const Icon = item.icon;
    const isActive = activeTab === item.id;
    return (
      <button
        onClick={() => onTabChange(item.id)}
        aria-current={isActive ? "page" : undefined}
        className={`group flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
          isActive
            ? "bg-slate-800 text-white"
            : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
        }`}
      >
        <span className={`flex items-center justify-center ${isActive ? 'text-primary' : 'text-slate-500 group-hover:text-slate-300'}`}>
          <Icon className="text-lg" />
        </span>
        {item.label}
        {isActive && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />}
      </button>
    );
  };

  const StudentTabItem = ({ item }: { item: { id: string, label: string, icon: React.ComponentType<{ className?: string }> } }) => {
    const Icon = item.icon;
    const isActive = activeStudentTab === item.id;
    const showBadge = item.id === 'informes' && studentHasUnread;
    return (
      <button
        onClick={() => onStudentTabChange?.(item.id)}
        aria-current={isActive ? "page" : undefined}
        className={`group flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
          isActive
            ? "bg-slate-800 text-white"
            : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
        }`}
      >
        <span className={`flex items-center justify-center ${isActive ? 'text-primary' : 'text-slate-500 group-hover:text-slate-300'}`}>
          <Icon className="text-lg" />
        </span>
        <span className="flex-1 text-left">{item.label}</span>
        {showBadge && <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" aria-hidden="true" />}
      </button>
    );
  };

  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-slate-800 bg-slate-950 xl:flex">
      <div className="border-b border-slate-800 px-4 py-4">
        <div className="flex items-center gap-3">
          <img src="/logos/Logo01.png" alt="DockUS" className="h-9 w-9 rounded-md border border-slate-700" />
          <div>
            <h1 className="text-base font-semibold tracking-tight text-white">DockUS</h1>
            <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
              {isStudent ? 'Espacio alumno' : 'Gestión académica'}
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-6">
        {isStudent ? (
          <nav className="space-y-0.5" aria-label="Navegación de alumno">
            {studentTabNavigation.map(item => <StudentTabItem key={item.id} item={item} />)}
          </nav>
        ) : (
          <>
            <nav className="space-y-0.5" aria-label="Navegación principal">
              {teacherMainNavigation.map(item => <NavItem key={item.id} item={item} />)}
            </nav>

            <div>
              <div className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                Administración
              </div>
              <nav className="space-y-0.5" aria-label="Navegación de administración">
                {adminNavigation.map(item => <NavItem key={item.id} item={item} />)}
              </nav>
            </div>
          </>
        )}
      </div>

      <div className="mt-auto border-t border-slate-800 px-3 py-3 space-y-3">
        {isWorkspaceActive && isMinimized && (
          <button
            onClick={() => setIsMinimized(false)}
            className="flex w-full items-center gap-3 rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-left transition-colors hover:border-slate-700"
            title="Expandir espacio de trabajo"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <RiStackLine className="text-base" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Espacio activo
              </div>
              <div className="truncate text-xs font-medium text-slate-200">
                {selection.projectTitle || "Workspace"}
              </div>
            </div>
          </button>
        )}

        <div className="rounded-md border border-slate-800 bg-slate-900 px-3 py-2.5">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Sesión
          </div>
          <div className="mt-1 truncate text-sm font-medium text-slate-200">{userEmail}</div>
          <div className="text-[10px] text-slate-500">
            {userRole}
          </div>
        </div>

        <button
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-400 transition-colors hover:bg-slate-900 hover:text-slate-200"
          onClick={onLogout}
        >
          <RiLogoutBoxRLine className="text-lg" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
};
