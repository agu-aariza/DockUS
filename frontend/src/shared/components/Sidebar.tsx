import React from 'react';
import {
  RiLayoutGridFill, RiStackFill, RiPulseFill, RiDatabase2Fill, RiGroupFill,
  RiLogoutBoxLine, RiBookOpenLine, RiFolderOpenFill, RiFileTextFill,
  RiInboxArchiveFill, RiUploadCloud2Fill,
} from 'react-icons/ri';
import { useWorkspace } from '../workspace/WorkspaceContext';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  userRole?: string;
  userEmail?: string;
  onLogout: () => void;
  activeStudentTab?: string;
  onStudentTabChange?: (tab: string) => void;
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
    { id: 'resumen', label: 'Panel de Control', icon: RiLayoutGridFill },
    { id: 'groups', label: 'Grupos', icon: RiGroupFill },
    { id: 'projects', label: 'Proyectos', icon: RiFolderOpenFill },
    { id: 'deliveries', label: 'Entregas', icon: RiStackFill },
    { id: 'runtime', label: 'Runtime', icon: RiPulseFill },
  ];

  const adminNavigation = [
    { id: 'storage', label: 'Almacenamiento', icon: RiDatabase2Fill },
    { id: 'users', label: 'Usuarios', icon: RiGroupFill },
  ];

  const studentTabNavigation = [
    { id: 'resumen', label: 'Resumen', icon: RiBookOpenLine },
    { id: 'proyectos', label: 'Mis proyectos', icon: RiFolderOpenFill },
    { id: 'entregas', label: 'Mis entregas', icon: RiInboxArchiveFill },
    { id: 'subir', label: 'Subir versión', icon: RiUploadCloud2Fill },
    { id: 'informes', label: 'Mis informes', icon: RiFileTextFill },
  ];

  const NavItem = ({ item }: { item: { id: string, label: string, icon: any } }) => (
    <button
      onClick={() => onTabChange(item.id)}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] ${activeTab === item.id
          ? "bg-gradient-to-r from-brand-gold-light to-brand-gold text-white shadow-lg shadow-brand-gold/25"
          : "text-white/70 hover:bg-white/5 hover:text-white"
        }`}
    >
      <item.icon
        className={`text-lg transition-transform duration-300 ${activeTab === item.id ? "text-white scale-110" : "text-white/40"}`}
      />
      {item.label}
    </button>
  );

  const StudentTabItem = ({ item }: { item: { id: string, label: string, icon: any } }) => {
    const isActive = activeStudentTab === item.id;
    const showBadge = item.id === 'informes' && studentHasUnread;
    return (
      <button
        onClick={() => onStudentTabChange?.(item.id)}
        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] ${
          isActive
            ? "bg-gradient-to-r from-brand-gold-light to-brand-gold text-white shadow-lg shadow-brand-gold/25"
            : "text-white/70 hover:bg-white/5 hover:text-white"
        }`}
      >
        <item.icon className={`text-lg transition-transform duration-300 ${isActive ? "text-white scale-110" : "text-white/40"}`} />
        <span className="flex-1 text-left">{item.label}</span>
        {showBadge && <span className="h-2 w-2 shrink-0 rounded-full bg-rose-400" />}
      </button>
    );
  };

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-brand-maroon-dark bg-gradient-to-b from-brand-maroon via-brand-maroon to-brand-maroon-dark xl:flex shadow-2xl">
      <div className="border-b border-white/10 px-6 py-6">
        <div className="mb-2 flex items-center gap-3">
          <img src="/logos/Logo01.png" alt="DockUS" className="h-11 w-11 rounded-2xl border border-white/10 shadow-lg" />
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white font-sans">DockUS</h1>
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-brand-gold-light">
              {isStudent ? 'Mi espacio' : 'Centro de control'}
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {isStudent ? (
          <nav className="space-y-1.5">
            {studentTabNavigation.map(item => <StudentTabItem key={item.id} item={item} />)}
          </nav>
        ) : (
          <>
            <nav className="space-y-1.5">
              {teacherMainNavigation.map(item => <NavItem key={item.id} item={item} />)}
            </nav>

            <div>
              <div className="px-3 mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-white/30">
                Administración
              </div>
              <nav className="space-y-1.5">
                {adminNavigation.map(item => <NavItem key={item.id} item={item} />)}
              </nav>
            </div>
          </>
        )}
      </div>

      <div className="mt-auto border-t border-white/10 px-6 py-5">
        {isWorkspaceActive && isMinimized && (
          <button
            onClick={() => setIsMinimized(false)}
            className="mb-4 flex w-full items-center gap-3 rounded-2xl bg-white/5 border border-white/10 hover:border-brand-gold-light/40 px-4 py-3 text-left transition hover:scale-[1.02] active:scale-[0.98] cursor-pointer group"
            title="Expandir espacio de trabajo"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-gold/10 text-brand-gold group-hover:scale-110 transition-transform">
              <RiStackFill className="text-lg animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="text-[9px] font-black uppercase tracking-[0.2em] text-brand-gold-light">
                Espacio activo
              </div>
              <div className="truncate text-xs font-bold text-white/90 mt-0.5 uppercase tracking-wide">
                {selection.projectTitle || "Workspace"}
              </div>
            </div>
          </button>
        )}

        <div className="mb-4 rounded-2xl bg-white/5 border border-white/10 px-4 py-4">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
            Operador activo
          </div>
          <div className="mt-2 truncate text-sm font-bold text-white">{userEmail}</div>
          <div className="mt-1 text-[10px] font-medium text-white/30 uppercase tracking-wider">
            Nivel: {userRole}
          </div>
        </div>

        <button
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-white/60 transition hover:bg-rose-500/10 hover:text-rose-400"
          onClick={onLogout}
        >
          <RiLogoutBoxLine className="text-lg" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
};
