import React from 'react';
import { RiArrowRightSLine, RiStackFill, RiUser3Fill, RiPulseFill } from 'react-icons/ri';
import { useWorkspace } from '../../workspace/WorkspaceContext';

export function BreadcrumbSwitcher() {
  const { selection } = useWorkspace();

  if (!selection.projectId) return null;

  return (
    <nav className="flex items-center gap-2 text-sm text-slate-500 mb-6 bg-slate-50/50 self-start px-4 py-2 rounded-2xl border border-slate-100">
      <div className="flex items-center gap-1.5 hover:text-brand-blue transition-colors cursor-default">
        <RiStackFill className="text-brand-blue" />
        <span className="font-semibold">{selection.projectTitle || 'Proyecto'}</span>
      </div>

      {selection.assignmentId && (
        <>
          <RiArrowRightSLine className="text-slate-300" />
          <div className="flex items-center gap-1.5 hover:text-emerald-600 transition-colors cursor-default">
            <RiUser3Fill className="text-emerald-500" />
            <span className="font-semibold">{selection.assignmentLabel || 'Alumno'}</span>
          </div>
        </>
      )}

      {selection.deliveryId && (
        <>
          <RiArrowRightSLine className="text-slate-300" />
          <div className="flex items-center gap-1.5 hover:text-amber-600 transition-colors cursor-default">
            <RiPulseFill className="text-amber-500" />
            <span className="font-semibold">{selection.deliveryLabel || 'Entrega'}</span>
          </div>
        </>
      )}
    </nav>
  );
}
