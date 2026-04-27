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
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
        activeTab === item.id
          ? "bg-slate-900 text-white shadow-md"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      }`}
    >
      <item.icon
        className={`text-lg ${
          activeTab === item.id ? "text-slate-100" : "text-slate-400"
        }`}
      />
      {item.label}
    </button>
  );

  return (
    <aside className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col border-r border-slate-200 bg-white xl:flex">
      <div className="border-b border-slate-200 px-6 py-6">
        <div className="mb-2 flex items-center gap-3">
          <img src="/logos/Logo01.png" alt="DockUS" className="h-11 w-11 rounded-2xl border border-slate-200" />
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-slate-950">DockUS</h1>
            <span className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
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
              <div className="px-3 mb-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                Administración
              </div>
              <nav className="space-y-1.5">
                {adminNavigation.map(item => <NavItem key={item.id} item={item} />)}
              </nav>
            </div>
          </>
        )}
      </div>

      <div className="mt-auto border-t border-slate-200 px-6 py-5">
        <div className="mb-4 rounded-2xl bg-slate-50 px-4 py-4">
          <div className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
            Operador activo
          </div>
          <div className="mt-2 truncate text-sm font-medium text-slate-950">{userEmail}</div>
          <div className="mt-1 text-xs text-slate-500">Nivel de acceso: {userRole}</div>
        </div>
        
        <button 
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-rose-50 hover:text-rose-700"
          onClick={onLogout}
        >
          <RiLogoutBoxLine className="text-lg" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
};
