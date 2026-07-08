import React from 'react';

export type Column<T> = {
  header: React.ReactNode;
  accessor: keyof T | ((_row: T) => React.ReactNode);
  align?: 'left' | 'center' | 'right';
  width?: string;
  className?: string;
  render?: (_row: T) => React.ReactNode;
};

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
}

const alignClass = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

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
}: DataTableProps<T>) {
  const renderCell = (row: T, column: Column<T>) => {
    if (column.render) {
      return column.render(row);
    }
    if (typeof column.accessor === 'function') {
      return column.accessor(row);
    }
    return String(row[column.accessor] ?? '');
  };

  return (
    <div className={['overflow-x-auto rounded-lg border border-app-border bg-white', className].join(' ')} aria-busy={loading || undefined}>
      <table className="w-full text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead className="bg-slate-50 border-b border-app-border">
          <tr>
            {columns.map((column, index) => (
              <th
                key={index}
                scope="col"
                className={[
                  'px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500',
                  alignClass[column.align ?? 'left'],
                  column.className ?? '',
                ].join(' ')}
                style={column.width ? { width: column.width } : undefined}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {loading ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-slate-400">
                <span role="status">Cargando...</span>
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8">
                {emptyState || (
                  <div className="text-center text-sm text-slate-500">
                    No hay datos disponibles.
                  </div>
                )}
              </td>
            </tr>
          ) : (
            data.map((row) => {
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
                  aria-label={isInteractive ? rowAriaLabel?.(row) ?? 'Abrir registro seleccionado' : undefined}
                  className={[
                    'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-inset',
                    isInteractive ? 'cursor-pointer hover:bg-slate-50' : 'hover:bg-slate-50',
                    rowClassName?.(row) ?? '',
                  ].join(' ')}
                >
                  {columns.map((column, index) => (
                    <td
                      key={index}
                      className={[
                        'px-4 py-3 text-slate-700 whitespace-nowrap',
                        alignClass[column.align ?? 'left'],
                        column.className ?? '',
                      ].join(' ')}
                    >
                      {renderCell(row, column)}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
