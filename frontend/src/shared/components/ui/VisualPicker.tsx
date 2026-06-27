import { useState, useMemo } from 'react';
import { RiSearch2Line, RiCheckLine, RiCloseLine } from 'react-icons/ri';

export interface VisualPickerOption {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  badge?: string;
  badgeTone?: 'success' | 'warning' | 'info' | 'default';
  metadata?: Record<string, string | number>;
}

interface VisualPickerProps {
  options: VisualPickerOption[];
  value: string | null;
  onSelect: (_id: string, _label: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
}

const BADGE_TONES = {
  success: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  warning: 'bg-amber-50 text-amber-700 border-amber-100',
  info: 'bg-blue-50 text-blue-700 border-blue-100',
  default: 'bg-slate-50 text-slate-700 border-slate-100',
};

export function VisualPicker({
  options,
  value,
  onSelect,
  placeholder = "Selecciona una opción...",
  searchPlaceholder = "Buscar...",
  emptyMessage = "No se encontraron resultados",
  className = "",
}: VisualPickerProps): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filteredOptions = useMemo(() => {
    const query = search.toLowerCase().trim();
    if (!query) return options;
    return options.filter(opt => 
      opt.label.toLowerCase().includes(query) || 
      opt.description?.toLowerCase().includes(query)
    );
  }, [options, search]);

  const selectedOption = options.find(opt => opt.id === value);

  return (
    <div className={`relative w-full ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex w-full items-center justify-between gap-3 rounded-lg border bg-white px-4 py-3 text-left transition-all hover:border-primary/30 ${
          isOpen ? 'border-primary ring-2 ring-primary/10' : 'border-app-border'
        }`}
      >
        <div className="flex items-center gap-3 truncate">
          {selectedOption?.icon && (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-400 group-hover:text-primary transition-colors">
              {selectedOption.icon}
            </div>
          )}
          <div className="truncate">
            <div className={`text-sm font-bold tracking-tight ${selectedOption ? 'text-slate-900' : 'text-slate-400'}`}>
              {selectedOption?.label || placeholder}
            </div>
            {selectedOption?.description && (
              <div className="text-[10px] font-medium text-slate-500 truncate uppercase tracking-wider">
                {selectedOption.description}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
           {selectedOption && (
             <div className="h-5 w-5 rounded-full bg-primary/10 text-primary flex items-center justify-center">
               <RiCheckLine className="text-xs" />
             </div>
           )}
           <div className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
             <RiSearch2Line className="text-slate-400" />
           </div>
        </div>
      </button>

      {/* Popover */}
      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-[110]" 
            onClick={() => setIsOpen(false)} 
          />
          <div className="absolute top-full left-0 right-0 z-[120] mt-3 max-h-[400px] flex flex-col overflow-hidden rounded-lg border border-app-border bg-white shadow-sm">
            
            {/* Search Input */}
            <div className="sticky top-0 z-10 border-b border-slate-100 bg-white/50 p-4">
              <div className="relative">
                <RiSearch2Line className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  autoFocus
                  className="w-full rounded-md border-none bg-slate-100 py-2.5 pl-10 pr-10 text-sm font-medium focus:ring-2 focus:ring-primary"
                  placeholder={searchPlaceholder}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <RiCloseLine />
                  </button>
                )}
              </div>
            </div>

            {/* Options List */}
            <div className="flex-1 overflow-y-auto no-scrollbar p-2">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => {
                      onSelect(opt.id, opt.label);
                      setIsOpen(false);
                      setSearch("");
                    }}
                    className={`group flex w-full items-center justify-between gap-4 rounded-lg p-4 text-left transition-all hover:bg-slate-50 ${
                      value === opt.id ? 'bg-slate-50' : ''
                    }`}
                  >
                    <div className="flex items-center gap-4 truncate">
                      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg transition-all ${
                        value === opt.id ? 'bg-primary text-white' : 'bg-slate-50 text-slate-400 group-hover:bg-primary/5 group-hover:text-primary'
                      }`}>
                        {opt.icon || <RiCheckLine />}
                      </div>
                      <div className="truncate">
                        <div className={`text-sm font-bold tracking-tight ${value === opt.id ? 'text-primary' : 'text-slate-900'}`}>
                          {opt.label}
                        </div>
                        {opt.description && (
                          <div className="text-[11px] font-medium text-slate-500 group-hover:text-slate-600">
                            {opt.description}
                          </div>
                        )}
                      </div>
                    </div>
                    {opt.badge && (
                      <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${BADGE_TONES[opt.badgeTone || 'default']}`}>
                        {opt.badge}
                      </span>
                    )}
                  </button>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <RiSearch2Line className="mb-3 text-3xl text-slate-200" />
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{emptyMessage}</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
