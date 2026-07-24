/**
 * @fileoverview Componente UI base del sistema de diseño DockUS (DataTable).
 *
 * @module DataTable
 */

import React, { useMemo, useRef, useState } from 'react';
import { RiArrowDownSLine, RiArrowUpSLine, RiExpandUpDownLine } from 'react-icons/ri';
import { Skeleton } from '../Skeleton';

export type Column<T> = {
  header: React.ReactNode;
  accessor: keyof T | ((_row: T) => React.ReactNode);
  align?: 'left' | 'center' | 'right';
  width?: string;
  className?: string;
  render?: (_row: T) => React.ReactNode;
  /** Datos que se comparan en vertical (notas, recuentos): mono, tabular, a la derecha. */
  numeric?: boolean;
  /** Habilita el orden por esta columna. Requiere `sortValue`. */
  sortable?: boolean;
  /** Valor comparable de la fila para esta columna. */
  sortValue?: (_row: T) => string | number | null | undefined;
};

type SortDirection = 'asc' | 'desc';

interface SortState {
  index: number;
  direction: SortDirection;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (_row: T) => string;
  emptyState?: React.ReactNode;
  loading?: boolean;
  onRowClick?: (_row: T) => void;
  rowAriaLabel?: (_row: T) => string;
  rowClassName?: (_row: T) => string;
  className?: string;
  caption?: string;
  /** `compact` para listas largas. */
  density?: 'comfortable' | 'compact';
  /** Fija la cabecera al hacer scroll vertical dentro de la tabla. */
  stickyHeader?: boolean;
  /** Alto máximo del cuerpo; sin él, `stickyHeader` no tiene contra qué fijarse. */
  maxHeight?: string;
}

const ALIGN_CLASS: Record<'left' | 'center' | 'right', string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

const DENSITY_CELL: Record<'comfortable' | 'compact', string> = {
  comfortable: 'px-4 py-3',
  compact: 'px-3 py-2',
};

/** `null`/`undefined` siempre al final, en cualquier dirección. */
function compareValues(
  left: string | number | null | undefined,
  right: string | number | null | undefined,
): number {
  const leftEmpty = left === null || left === undefined || left === '';
  const rightEmpty = right === null || right === undefined || right === '';
  if (leftEmpty && rightEmpty) return 0;
  if (leftEmpty) return 1;
  if (rightEmpty) return -1;

  if (typeof left === 'number' && typeof right === 'number') {
    return left - right;
  }

  return String(left).localeCompare(String(right), 'es', { numeric: true });
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  emptyState,
  loading,
  onRowClick,
  rowAriaLabel,
  rowClassName,
  className = '',
  caption,
  density = 'comfortable',
  stickyHeader = false,
  maxHeight,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<SortState | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const cellPadding = DENSITY_CELL[density];

  const sortedData = useMemo(() => {
    if (!sort) return data;

    const column = columns[sort.index];
    const sortValue = column?.sortValue;
    if (!sortValue) return data;

    const factor = sort.direction === 'asc' ? 1 : -1;
    // Copia: no mutamos el array que nos pasa el consumidor.
    return [...data].sort(
      (left, right) => compareValues(sortValue(left), sortValue(right)) * factor,
    );
  }, [columns, data, sort]);

  /** Ciclo: sin orden → asc → desc → sin orden. */
  const toggleSort = (index: number) => {
    setSort((current) => {
      if (!current || current.index !== index) {
        return { index, direction: 'asc' };
      }
      if (current.direction === 'asc') {
        return { index, direction: 'desc' };
      }
      return null;
    });
  };

  const ariaSortFor = (index: number): 'ascending' | 'descending' | 'none' => {
    if (!sort || sort.index !== index) return 'none';
    return sort.direction === 'asc' ? 'ascending' : 'descending';
  };

  const bodyRows = loading ? [] : sortedData;

  return (
    <div
      className={['rounded-lg border border-app-border bg-white', className].join(' ')}
      aria-busy={loading || undefined}
    >
      <div
        ref={scrollRef}
        className="custom-scrollbar overflow-x-auto"
        style={maxHeight ? { maxHeight, overflowY: 'auto' } : undefined}
        onScroll={
          stickyHeader
            ? (event) => setScrolled(event.currentTarget.scrollTop > 0)
            : undefined
        }
      >
        <table className="w-full text-sm">
          {caption ? <caption className="sr-only">{caption}</caption> : null}

          <thead
            className={[
              'border-b border-app-border bg-slate-50',
              stickyHeader ? 'sticky top-0 z-10' : '',
              // La elevación aparece solo cuando hay contenido pasando por debajo.
              stickyHeader && scrolled ? 'shadow-sm' : '',
            ].join(' ')}
          >
            <tr>
              {columns.map((column, index) => {
                const align = column.align ?? (column.numeric ? 'right' : 'left');
                const canSort = Boolean(column.sortable && column.sortValue);
                const active = sort?.index === index;

                return (
                  <th
                    key={index}
                    scope="col"
                    aria-sort={canSort ? ariaSortFor(index) : undefined}
                    className={[
                      cellPadding,
                      'text-xs font-semibold uppercase tracking-wider text-slate-500',
                      ALIGN_CLASS[align],
                      column.className ?? '',
                    ].join(' ')}
                    style={column.width ? { width: column.width } : undefined}
                  >
                    {canSort ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(index)}
                        className={[
                          'group inline-flex items-center gap-1.5 rounded transition-colors hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 motion-reduce:transition-none',
                          align === 'right' ? 'flex-row-reverse' : '',
                          active ? 'text-slate-900' : '',
                        ].join(' ')}
                      >
                        {column.header}
                        {active ? (
                          sort?.direction === 'asc' ? (
                            <RiArrowUpSLine className="text-primary" aria-hidden="true" />
                          ) : (
                            <RiArrowDownSLine className="text-primary" aria-hidden="true" />
                          )
                        ) : (
                          <RiExpandUpDownLine
                            className="text-slate-300 transition-colors group-hover:text-slate-500 motion-reduce:transition-none"
                            aria-hidden="true"
                          />
                        )}
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {loading ? (
              Array.from({ length: 4 }).map((_, rowIndex) => (
                <tr key={`skeleton-${rowIndex}`}>
                  {columns.map((column, index) => (
                    <td key={index} className={cellPadding}>
                      <Skeleton type="text" className="h-4 w-full" />
                    </td>
                  ))}
                </tr>
              ))
            ) : bodyRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8">
                  {emptyState ?? (
                    <div className="text-center text-sm text-slate-500">
                      No hay datos disponibles.
                    </div>
                  )}
                </td>
              </tr>
            ) : (
              bodyRows.map((row) => {
                const isInteractive = Boolean(onRowClick);

                return (
                  <tr
                    key={keyExtractor(row)}
                    onClick={() => onRowClick?.(row)}
                    onKeyDown={(event) => {
                      if (!onRowClick) return;
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onRowClick(row);
                      }
                    }}
                    tabIndex={isInteractive ? 0 : undefined}
                    role={isInteractive ? 'button' : undefined}
                    aria-label={
                      isInteractive
                        ? rowAriaLabel?.(row) ?? 'Abrir registro seleccionado'
                        : undefined
                    }
                    className={[
                      'transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40 motion-reduce:transition-none',
                      isInteractive ? 'cursor-pointer' : '',
                      rowClassName?.(row) ?? '',
                    ].join(' ')}
                  >
                    {columns.map((column, index) => {
                      const align = column.align ?? (column.numeric ? 'right' : 'left');

                      return (
                        <td
                          key={index}
                          className={[
                            cellPadding,
                            'whitespace-nowrap text-slate-700',
                            ALIGN_CLASS[align],
                            // Cifras tabulares: los dígitos caen en columna y se comparan de un vistazo.
                            column.numeric ? 'font-mono tabular-nums' : '',
                            column.className ?? '',
                          ].join(' ')}
                        >
                          {column.render
                            ? column.render(row)
                            : typeof column.accessor === 'function'
                              ? column.accessor(row)
                              : String(row[column.accessor] ?? '')}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
