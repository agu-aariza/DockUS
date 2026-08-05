/**
 * @fileoverview Componente UI base del sistema de diseño EduCodeAI (SearchInput).
 *
 * @module SearchInput
 */

import React, { type InputHTMLAttributes } from 'react';
import { RiSearchLine, RiCloseLine } from 'react-icons/ri';

interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: string;
  onChange: (_value: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Buscar...',
  className = '',
  ...props
}: SearchInputProps) {
  return (
    <div className={`relative ${className}`}>
      <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-slate-300 bg-app-surface py-2 pl-9 pr-8 text-sm text-app-text placeholder:text-app-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 dark:border-slate-600"
        {...props}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex min-h-6 min-w-6 items-center justify-center rounded p-0.5 text-app-text-muted hover:bg-app-bg-subtle hover:text-app-text-secondary focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
          aria-label="Limpiar búsqueda"
        >
          <RiCloseLine className="text-base" />
        </button>
      )}
    </div>
  );
}
