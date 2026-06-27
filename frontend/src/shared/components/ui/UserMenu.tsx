import React, { useState, useRef, useEffect } from 'react';
import { RiLogoutBoxRLine, RiUserLine, RiArrowDownSLine } from 'react-icons/ri';

interface UserMenuProps {
  email: string;
  role?: string;
  onLogout: () => void;
  className?: string;
}

export function UserMenu({ email, role, onLogout, className = '' }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-500">
          <RiUserLine className="text-sm" />
        </div>
        <span className="hidden max-w-[140px] truncate sm:inline">{email}</span>
        <RiArrowDownSLine className={`text-base transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-1 w-56 rounded-md border border-app-border bg-white shadow-lg"
          role="menu"
        >
          <div className="border-b border-app-border px-3 py-2">
            <p className="truncate text-sm font-medium text-slate-900">{email}</p>
            {role && <p className="text-xs text-slate-500">{role}</p>}
          </div>
          <button
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50"
            role="menuitem"
          >
            <RiLogoutBoxRLine className="text-base" />
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}
