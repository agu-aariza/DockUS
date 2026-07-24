/**
 * @fileoverview Componente UI base del sistema de diseño DockUS (VisualPicker).
 *
 * @module VisualPicker
 */

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { RiSearch2Line, RiCheckLine, RiCloseLine } from 'react-icons/ri';

export interface VisualPickerOption {
  id: string;
  label: string;
  description?: string;
  icon?: ReactNode;
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
  /** Fija el id del botón disparador para poder asociar un <label htmlFor>. */
  id?: string;
  /**
   * Búsqueda server-side (debounced 300ms). Si se define, `options` se usa
   * tal cual llega —ya filtrada por el backend— en vez de aplicar el filtro
   * local por substring, que solo veía la página ya cargada (FE-MED-01).
   */
  onSearchChange?: (_query: string) => void;
}

const BADGE_TONES = {
  success: 'bg-success-50 text-success-700 border-success-100',
  warning: 'bg-warning-50 text-warning-700 border-warning-100',
  info: 'bg-primary-50 text-primary-700 border-primary-100',
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
  id: idProp,
  onSearchChange,
}: VisualPickerProps): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const generatedId = useId();
  const id = idProp ?? generatedId;
  const buttonId = idProp ?? id + '-button';
  const listboxId = id + '-listbox';
  const searchId = id + '-search';

  useEffect(() => {
    if (!onSearchChange) return;
    const handle = window.setTimeout(() => onSearchChange(search), 300);
    return () => window.clearTimeout(handle);
  }, [search, onSearchChange]);

  const filteredOptions = useMemo(() => {
    if (onSearchChange) return options;
    const query = search.toLowerCase().trim();
    if (!query) return options;
    return options.filter(opt =>
      opt.label.toLowerCase().includes(query) ||
      opt.description?.toLowerCase().includes(query)
    );
  }, [options, search, onSearchChange]);

  const selectedOption = options.find(opt => opt.id === value);
  const activeOption = filteredOptions[activeIndex];

  useEffect(() => {
    setActiveIndex(0);
  }, [search, isOpen]);

  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      searchInputRef.current?.focus();
    }
  }, [isOpen]);

  const closePicker = () => {
    setIsOpen(false);
    setSearch("");
  };

  const selectOption = (option: VisualPickerOption) => {
    onSelect(option.id, option.label);
    closePicker();
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closePicker();
      return;
    }
    if (filteredOptions.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((previous) => (previous + 1) % filteredOptions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((previous) => (previous - 1 + filteredOptions.length) % filteredOptions.length);
    } else if (event.key === 'Enter' && activeOption) {
      event.preventDefault();
      selectOption(activeOption);
    }
  };

  return (
    <div className={['relative w-full', className].join(' ')}>
      <button
        id={buttonId}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listboxId : undefined}
        onClick={() => setIsOpen(!isOpen)}
        className={[
          'group flex w-full items-center justify-between gap-3 rounded-lg border bg-white px-4 py-3 text-left transition-colors duration-150 motion-reduce:transition-none hover:border-primary/30',
          isOpen ? 'border-primary ring-2 ring-primary/10' : 'border-app-border',
        ].join(' ')}
      >
        <div className="flex items-center gap-3 truncate">
          {selectedOption?.icon && (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-400 group-hover:text-primary transition-colors" aria-hidden="true">
              {selectedOption.icon}
            </div>
          )}
          <div className="truncate">
            <div className={['text-sm font-bold tracking-tight', selectedOption ? 'text-slate-900' : 'text-slate-400'].join(' ')}>
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
            <div className="h-5 w-5 rounded-full bg-primary/10 text-primary flex items-center justify-center" aria-hidden="true">
              <RiCheckLine className="text-xs" />
            </div>
          )}
          <div className={['transition-transform duration-150 motion-reduce:transition-none', isOpen ? 'rotate-180' : ''].join(' ')} aria-hidden="true">
            <RiSearch2Line className="text-slate-400" />
          </div>
        </div>
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-[110]" 
            onClick={closePicker}
            aria-hidden="true"
          />
          <div className="absolute top-full left-0 right-0 z-[120] mt-3 max-h-[400px] flex flex-col overflow-hidden rounded-lg border border-app-border bg-white shadow-sm">
            <div className="sticky top-0 z-10 border-b border-slate-100 bg-white/50 p-4">
              <div className="relative">
                <RiSearch2Line className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input
                  ref={searchInputRef}
                  id={searchId}
                  aria-label={searchPlaceholder}
                  aria-controls={listboxId}
                  aria-activedescendant={activeOption ? id + '-option-' + activeOption.id : undefined}
                  className="w-full rounded-md border-none bg-slate-100 py-2.5 pl-10 pr-10 text-sm font-medium focus:ring-2 focus:ring-primary"
                  placeholder={searchPlaceholder}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex min-h-6 min-w-6 items-center justify-center rounded text-slate-400 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    aria-label="Limpiar búsqueda"
                  >
                    <RiCloseLine aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>

            <div id={listboxId} role="listbox" aria-labelledby={buttonId} className="flex-1 overflow-y-auto no-scrollbar p-2">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((opt, index) => (
                  <button
                    id={id + '-option-' + opt.id}
                    key={opt.id}
                    type="button"
                    role="option"
                    aria-selected={value === opt.id}
                    onClick={() => selectOption(opt)}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={[
                      'group flex w-full items-center justify-between gap-4 rounded-lg p-4 text-left transition-colors duration-150 motion-reduce:transition-none hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                      value === opt.id || index === activeIndex ? 'bg-slate-50' : '',
                    ].join(' ')}
                  >
                    <div className="flex items-center gap-4 truncate">
                      <div className={[
                        'flex h-12 w-12 shrink-0 items-center justify-center rounded-lg transition-colors duration-150 motion-reduce:transition-none',
                        value === opt.id ? 'bg-primary text-white' : 'bg-slate-50 text-slate-400 group-hover:bg-primary/5 group-hover:text-primary',
                      ].join(' ')} aria-hidden="true">
                        {opt.icon || <RiCheckLine />}
                      </div>
                      <div className="truncate">
                        <div className={['text-sm font-bold tracking-tight', value === opt.id ? 'text-primary' : 'text-slate-900'].join(' ')}>
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
                      <span className={['shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider', BADGE_TONES[opt.badgeTone || 'default']].join(' ')}>
                        {opt.badge}
                      </span>
                    )}
                  </button>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-center" role="status">
                  <RiSearch2Line className="mb-3 text-3xl text-slate-200" aria-hidden="true" />
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{emptyMessage}</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
