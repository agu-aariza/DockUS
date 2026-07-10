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

  const userInitial = userEmail ? userEmail.charAt(0).toUpperCase() : 'U';

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
        className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
          isActive
            ? "bg-white/10 text-white shadow-sm ring-1 ring-white/5"
            : "text-slate-400 hover:bg-white/5 hover:text-slate-200 hover:translate-x-1"
        }`}
      >
        {/* Active side indicator */}
        {isActive && (
          <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-md bg-primary" aria-hidden="true" />
        )}
        <span className={`flex items-center justify-center transition-colors duration-200 ${isActive ? 'text-primary' : 'text-slate-500 group-hover:text-slate-300'}`}>
          <Icon className="text-lg" />
        </span>
        <span className="transition-transform duration-200">{item.label}</span>
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
        className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
          isActive
            ? "bg-white/10 text-white shadow-sm ring-1 ring-white/5"
            : "text-slate-400 hover:bg-white/5 hover:text-slate-200 hover:translate-x-1"
        }`}
      >
        {/* Active side indicator */}
        {isActive && (
          <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-md bg-primary" aria-hidden="true" />
        )}
        <span className={`flex items-center justify-center transition-colors duration-200 ${isActive ? 'text-primary' : 'text-slate-500 group-hover:text-slate-300'}`}>
          <Icon className="text-lg" />
        </span>
        <span className="flex-1 text-left transition-transform duration-200">{item.label}</span>
        {showBadge && <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" aria-hidden="true" />}
      </button>
    );
  };

  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-slate-800 bg-slate-950 xl:flex">
      {/* Brand Header */}
      <div className="border-b border-slate-800 px-5 py-5">
        <div className="flex items-center gap-3">
          <img
            src="/logos/Logo01.png"
            alt="EduCode AI"
            className="h-10 w-10 rounded-full shadow-md shadow-black/30 border border-slate-800"
          />
          <div>
            <h1 className="text-base font-bold tracking-wider text-white">EduCode AI</h1>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              {isStudent ? 'Espacio alumno' : 'Gestión académica'}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto p-3 space-y-6">
        {isStudent ? (
          <nav className="space-y-1" aria-label="Navegación de alumno">
            {studentTabNavigation.map(item => <StudentTabItem key={item.id} item={item} />)}
          </nav>
        ) : (
          <>
            <nav className="space-y-1" aria-label="Navegación principal">
              {teacherMainNavigation.map(item => <NavItem key={item.id} item={item} />)}
            </nav>

            <div className="space-y-1">
              <div className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
                Administración
              </div>
              <nav className="space-y-1" aria-label="Navegación de administración">
                {adminNavigation.map(item => <NavItem key={item.id} item={item} />)}
              </nav>
            </div>
          </>
        )}
      </div>

      {/* Footer Section */}
      <div className="mt-auto border-t border-slate-800 p-3 space-y-3">
        {isWorkspaceActive && isMinimized && (
          <button
            onClick={() => setIsMinimized(false)}
            className="flex w-full items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-left transition-colors hover:border-slate-700"
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

        {/* User Session Profile Widget */}
        <div className="flex items-center gap-3 rounded-xl border border-slate-800/80 bg-slate-900/50 p-3 shadow-inner">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-primary to-blue-400 text-sm font-bold text-white shadow">
            {userInitial}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-semibold text-slate-200" title={userEmail}>
              {userEmail}
            </div>
            <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
              {userRole}
            </div>
          </div>
        </div>

        {/* Logout button */}
        <button
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 transition-all duration-200 hover:bg-red-500/10 hover:text-red-400 group"
          onClick={onLogout}
        >
          <RiLogoutBoxRLine className="text-lg text-slate-500 group-hover:text-red-400 transition-colors duration-200" />
          <span>Cerrar sesión</span>
        </button>
      </div>
    </aside>
  );
};
