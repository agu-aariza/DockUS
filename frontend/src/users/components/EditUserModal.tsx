/**
 * @fileoverview Modal de edición de un usuario existente (EditUserModal).
 *
 * @module EditUserModal
 */

import { type FormEvent } from 'react';
import { RiCloseLine, RiPencilLine, RiMailFill, RiLockPasswordFill } from 'react-icons/ri';
import { Button } from '../../shared/components/ui/Button';
import { useFocusTrap } from '../../shared/hooks/useFocusTrap';
import type { UserRole } from '../../shared/types';
import type { UserStatus } from '../../features/auth/types';
import { USER_ROLES, USER_STATUSES, ROLE_LABELS } from '../userConstants';

export interface EditUserFormState {
  id: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole | '';
  status: UserStatus | '';
}

interface EditUserModalProps {
  open: boolean;
  form: EditUserFormState;
  onFormChange: (updater: (previous: EditUserFormState) => EditUserFormState) => void;
  isSaving: boolean;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export function EditUserModal({
  open,
  form,
  onFormChange,
  isSaving,
  onCancel,
  onSubmit,
}: EditUserModalProps): JSX.Element | null {
  const dialogRef = useFocusTrap<HTMLDivElement>(open);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
      <div
        className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm transition-opacity motion-modal-backdrop"
        onClick={() => { if (!isSaving) onCancel(); }}
      />

      <div
        ref={dialogRef}
        className="relative z-10 w-full max-w-lg rounded-lg border border-app-border bg-app-surface shadow-md motion-modal-panel"
      >
        <div className="flex items-start gap-4 border-b border-app-border-subtle px-5 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-subtle border border-primary/20">
            <RiPencilLine className="text-xl text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-app-text">Editar usuario</h3>
            <p className="mt-1 text-sm text-app-text-secondary leading-relaxed">
              {form.firstName} {form.lastName}
            </p>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-md p-1 text-app-text-muted transition hover:bg-app-bg-subtle hover:text-app-text focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:outline-none"
            onClick={onCancel}
            disabled={isSaving}
            aria-label="Cerrar"
          >
            <RiCloseLine className="text-xl" />
          </button>
        </div>

        <form onSubmit={onSubmit}>
          <div className="space-y-4 px-5 py-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="edit-user-first-name" className="label-text">Nombre</label>
                <input
                  id="edit-user-first-name"
                  required
                  className="input-field"
                  value={form.firstName}
                  onChange={(e) => onFormChange((p) => ({ ...p, firstName: e.target.value }))}
                />
              </div>
              <div>
                <label htmlFor="edit-user-last-name" className="label-text">Apellidos</label>
                <input
                  id="edit-user-last-name"
                  required
                  className="input-field"
                  value={form.lastName}
                  onChange={(e) => onFormChange((p) => ({ ...p, lastName: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <label htmlFor="edit-user-email" className="label-text">Correo electrónico</label>
              <div className="relative">
                <RiMailFill className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted" />
                <input
                  id="edit-user-email"
                  required
                  type="email"
                  className="input-field pl-10"
                  value={form.email}
                  onChange={(e) => onFormChange((p) => ({ ...p, email: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <label htmlFor="edit-user-password" className="label-text">Nueva contraseña</label>
              <div className="relative">
                <RiLockPasswordFill className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted" />
                <input
                  id="edit-user-password"
                  type="password"
                  className="input-field pl-10"
                  placeholder="Déjalo en blanco para no cambiarla"
                  value={form.password}
                  onChange={(e) => onFormChange((p) => ({ ...p, password: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="edit-user-role" className="label-text">Rol</label>
                <select
                  id="edit-user-role"
                  className="input-field"
                  value={form.role}
                  onChange={(e) => onFormChange((p) => ({ ...p, role: e.target.value as UserRole }))}
                >
                  {USER_ROLES.map((role) => (
                    <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="edit-user-status" className="label-text">Estado</label>
                <select
                  id="edit-user-status"
                  className="input-field"
                  value={form.status}
                  onChange={(e) => onFormChange((p) => ({ ...p, status: e.target.value as UserStatus }))}
                >
                  {USER_STATUSES.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-app-border-subtle px-5 py-3 bg-app-bg-subtle/50 rounded-b-lg">
            <Button type="button" variant="secondary" onClick={onCancel} disabled={isSaving}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={isSaving}>
              {isSaving ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
