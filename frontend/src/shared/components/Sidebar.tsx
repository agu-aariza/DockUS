import React from 'react';
import {
  RiLayoutGridFill, RiStackFill, RiPulseFill, RiDatabase2Fill, RiGroupFill, RiLogoutBoxLine, RiBookOpenLine, RiFolderOpenFill
} from 'react-icons/ri';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  userRole?: string;
  userEmail?: string;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab, onTabChange, userRole, userEmail, onLogout
}) => {
  const isStudent = userRole === 'STUDENT';

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

  const studentNavigation = [
    { id: 'mi-espacio', label: 'Mi espacio', icon: RiBookOpenLine },
  ];

  const NavItem = ({ item }: { item: { id: string, label: string, icon: any } }) => (
    <button
      onClick={() => onTabChange(item.id)}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-all ${activeTab === item.id
          ? "bg-brand-gold text-white shadow-lg shadow-brand-gold/20"
          : "text-white/70 hover:bg-white/5 hover:text-white"
        }`}
    >
      <item.icon
        className={`text-lg ${activeTab === item.id ? "text-white" : "text-white/40"
          }`}
      />
      {item.label}
    </button>
  );

  return (
    <aside className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col border-r border-brand-maroon-dark bg-brand-maroon xl:flex shadow-2xl">
      <div className="border-b border-white/10 px-6 py-6">
        <div className="mb-2 flex items-center gap-3">
          <img src="/logos/Logo01.png" alt="DockUS" className="h-11 w-11 rounded-2xl border border-white/10" />
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white">DockUS</h1>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-gold">
              Centro de control
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {isStudent ? (
          <nav className="space-y-1.5">
            {studentNavigation.map(item => <NavItem key={item.id} item={item} />)}
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
