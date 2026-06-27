import React, { type ReactNode } from 'react';
import { RiAlertLine } from 'react-icons/ri';
import { Button } from './Button';

interface DangerAction {
  label: string;
  description: string;
  buttonLabel: string;
  onClick: () => void;
  loading?: boolean;
}

interface DangerZoneProps {
  title?: string;
  description?: string;
  actions: DangerAction[];
  className?: string;
}

export function DangerZone({
  title = 'Zona de peligro',
  description = 'Estas acciones son destructivas y no se pueden deshacer. Procede con precaución.',
  actions,
  className = '',
}: DangerZoneProps) {
  return (
    <section className={`rounded-lg border border-red-200 bg-white ${className}`}>
      <div className="border-b border-red-100 px-4 py-3">
        <div className="flex items-center gap-2 text-red-700">
          <RiAlertLine className="text-lg" />
          <h3 className="text-sm font-semibold">{title}</h3>
        </div>
        <p className="mt-1 text-xs text-slate-500">{description}</p>
      </div>
      <div className="divide-y divide-red-100">
        {actions.map((action, index) => (
          <div key={index} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h4 className="text-sm font-medium text-slate-900">{action.label}</h4>
              <p className="text-xs text-slate-500">{action.description}</p>
            </div>
            <Button
              variant="danger"
              size="sm"
              onClick={action.onClick}
              disabled={action.loading}
              className="shrink-0"
            >
              {action.loading ? 'Procesando...' : action.buttonLabel}
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}

interface DangerZoneItemProps {
  title: string;
  description: string;
  children: ReactNode;
}

export function DangerZoneItem({ title, description, children }: DangerZoneItemProps) {
  return (
    <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h4 className="text-sm font-medium text-slate-900">{title}</h4>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
