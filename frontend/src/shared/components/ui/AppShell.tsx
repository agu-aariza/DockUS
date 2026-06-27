import React, { useState } from 'react';
import { RiMenuLine, RiCloseLine } from 'react-icons/ri';
import { Sidebar } from '../Sidebar';

interface AppShellProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (_tab: string) => void;
  userRole?: string;
  userEmail?: string;
  onLogout: () => void;
  activeStudentTab?: string;
  onStudentTabChange?: (_tab: string) => void;
  topBar?: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  children,
  activeTab,
  onTabChange,
  userRole,
  userEmail,
  onLogout,
  activeStudentTab,
  onStudentTabChange,
  topBar,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-app-bg font-sans">
      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm xl:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar drawer */}
      <div
        className={`fixed inset-y-0 left-0 z-50 transform transition-transform duration-200 ease-in-out xl:relative xl:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar
          activeTab={activeTab}
          onTabChange={(tab) => {
            onTabChange(tab);
            setMobileMenuOpen(false);
          }}
          userRole={userRole}
          userEmail={userEmail}
          onLogout={onLogout}
          activeStudentTab={activeStudentTab}
          onStudentTabChange={onStudentTabChange}
        />
        <button
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white xl:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-label="Cerrar menú"
        >
          <RiCloseLine className="text-2xl" />
        </button>
      </div>

      <main className="relative min-w-0 flex-1 flex flex-col h-screen overflow-hidden">
        {/* Mobile header */}
        <div className="flex items-center justify-between border-b border-app-border bg-white px-4 py-3 xl:hidden shrink-0">
          <div className="flex items-center gap-3">
            <button
              className="p-2 -ml-2 text-slate-500 hover:text-slate-900 rounded-md hover:bg-slate-100"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Abrir menú"
            >
              <RiMenuLine className="text-2xl" />
            </button>
            <div className="flex items-center gap-2">
              <img src="/logos/Logo01.png" alt="" className="h-7 w-7 rounded-md border border-app-border" />
              <span className="font-semibold tracking-tight text-slate-900">DockUS</span>
            </div>
          </div>
          {userEmail && (
            <div className="text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md truncate max-w-[140px]">
              {userEmail}
            </div>
          )}
        </div>

        {topBar}

        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
};
