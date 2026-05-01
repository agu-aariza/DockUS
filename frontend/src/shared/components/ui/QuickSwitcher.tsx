import React, { useState, useMemo } from 'react';
import { RiSearchLine, RiCloseLine, RiCheckLine } from 'react-icons/ri';

export interface QuickSwitcherOption {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  badge?: string;
}

interface QuickSwitcherProps {
  options: QuickSwitcherOption[];
  value: string | null;
  onSelect: (id: string, label: string) => void;
  placeholder?: string;
  title: string;
  emptyMessage?: string;
}

export function QuickSwitcher({
  options,
  value,
  onSelect,
  placeholder = "Buscar...",
  title,
  emptyMessage = "No se encontraron resultados"
}: QuickSwitcherProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return options;
    return options.filter(o => 
      o.label.toLowerCase().includes(q) || 
      o.description?.toLowerCase().includes(q)
    );
  }, [options, search]);

  return (
    <div className="flex flex-col h-[400px]">
      <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3">
          {title}
        </h4>
        <div className="relative">
          <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            autoFocus
            className="w-full h-10 pl-9 pr-4 rounded-xl border-slate-200 bg-white text-sm focus:ring-2 focus:ring-brand-blue focus:border-brand-blue transition-all"
            placeholder={placeholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClick={(e) => e.stopPropagation()}
          />
          {search && (
            <button 
              onClick={(e) => { e.stopPropagation(); setSearch(""); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <RiCloseLine />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <p className="text-sm font-medium text-slate-400 italic">{emptyMessage}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-1">
            {filtered.map((opt) => {
              const isSelected = opt.id === value;
              return (
                <button
                  key={opt.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(opt.id, opt.label);
                  }}
                  className={`group flex items-center justify-between gap-3 p-3 rounded-2xl transition-all ${
                    isSelected 
                      ? 'bg-brand-blue text-white shadow-lg shadow-brand-blue/20' 
                      : 'hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {opt.icon && (
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-white'
                      }`}>
                        {opt.icon}
                      </div>
                    )}
                    <div className="text-left truncate">
                      <div className={`text-sm font-bold tracking-tight truncate ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                        {opt.label}
                      </div>
                      {opt.description && (
                        <div className={`text-[10px] font-medium truncate ${isSelected ? 'text-brand-blue-light' : 'text-slate-500'}`}>
                          {opt.description}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {isSelected ? (
                    <RiCheckLine className="text-xl animate-in zoom-in-50" />
                  ) : opt.badge && (
                    <span className="shrink-0 px-2 py-0.5 rounded-full bg-slate-100 text-[10px] font-bold text-slate-500">
                      {opt.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
