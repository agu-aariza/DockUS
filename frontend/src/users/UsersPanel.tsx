import { useEffect, useState } from 'react';
import { DangerConfirmModal } from '../shared/components/DangerConfirmModal';
import { JsonResult } from '../shared/components/JsonResult';
import { Button } from '../shared/components/ui/Button';
import { Card, Badge } from '../shared/components/ui/Layout';
import { useToast } from '../shared/toast/ToastContext';
import type { SessionRecord, UserRole, UserStatus } from '../shared/types';
import { useUserManagement } from './hooks/useUserManagement';

interface UsersPanelProps {
  session: SessionRecord | null;
}

type UsersTab = 'consulta' | 'alta';

const USER_ROLES: UserRole[] = ['ADMIN', 'TEACHER', 'STUDENT'];
const USER_STATUSES: UserStatus[] = ['ACTIVE', 'INACTIVE', 'SUSPENDED'];
export function UsersPanel({ session }: UsersPanelProps): JSX.Element {
  const uc = useUserManagement(session);
  const [activeTab, setActiveTab] = useState<UsersTab>('consulta');
  const { pushToast } = useToast();

  useEffect(() => {
    if (!uc.message.trim()) {
      return;
    }

    pushToast({
      title: 'Usuarios',
      description: uc.message,
      tone: uc.message.includes('[4') || uc.message.toLowerCase().includes('error') ? 'error' : 'info',
    });
    uc.setMessage('');
  }, [pushToast, uc.message, uc.setMessage]);

  return (
    <div className="space-y-8 animate-fade-in">
      <header>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Directorio de usuarios</h2>
        <p className="text-slate-500 text-sm">Gestiona cuentas, roles y niveles de acceso dentro de DockUS.</p>
      </header>

      <div className="flex flex-wrap gap-1 border-b border-slate-200">
        {[
          { id: 'consulta', label: 'Consulta' },
          { id: 'alta', label: 'Alta' },
        ].map((tab) => (
          <button
            key={tab.id}
            className={`px-4 py-3 text-sm font-semibold transition ${
              activeTab === tab.id
                ? 'border-b-2 border-slate-900 text-slate-950'
                : 'text-slate-500 hover:text-slate-700'
            }`}
            onClick={() => setActiveTab(tab.id as UsersTab)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'consulta' ? (
        <div className="space-y-8">
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-8">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest mb-6">Filtros del directorio</h3>
          <div className="mb-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label className="label-text">Rol</label>
              <select className="input-field" value={uc.query.role} onChange={e => uc.setQuery(p => ({ ...p, role: e.target.value }))}>
                <option value="">Todos los roles</option>
                {USER_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="label-text">Estado de la cuenta</label>
              <select className="input-field" value={uc.query.status} onChange={e => uc.setQuery(p => ({ ...p, status: e.target.value }))}>
                <option value="">Todos los estados</option>
                {USER_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="mb-6">
            <label className="label-text">Buscar usuario</label>
            <input className="input-field" placeholder="Busca por nombre o correo..." value={uc.query.search} onChange={e => uc.setQuery(p => ({ ...p, search: e.target.value }))} />
          </div>
          <button className="btn-primary w-full" onClick={() => void uc.handleList()} disabled={!uc.canList}>
            Aplicar filtros
          </button>
        </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Usuarios cargados</h3>
        </div>
        {uc.listResponse ? (
          <>
          <div className="space-y-3 p-4 lg:hidden">
            {uc.listResponse.data.map((user) => (
              <article key={user.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-sm font-semibold text-slate-950">
                  {user.firstName} {user.lastName}
                </div>
                <div className="mt-1 text-xs text-slate-500">{user.email}</div>
                <div className="mt-3 grid gap-2 text-sm text-slate-600">
                  <div>Rol: {user.role}</div>
                  <div>Estado: {user.status}</div>
                </div>
                <button 
                  className="mt-4 text-xs font-bold text-rose-600 hover:text-rose-800 uppercase tracking-widest"
                  onClick={() => { uc.setDeleteId(user.id); uc.setConfirmOpen(true); }} 
                  disabled={!uc.canAdmin}
                >
                  Eliminar
                </button>
              </article>
            ))}
          </div>

          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  <th className="px-6 py-4">Usuario</th>
                  <th className="px-6 py-4">Rol</th>
                  <th className="px-6 py-4">Estado</th>
                  <th className="px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {uc.listResponse.data.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-sm font-bold text-slate-900">{user.firstName} {user.lastName}</div>
                      <div className="text-xs text-slate-400">{user.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[10px] font-black text-slate-500 bg-slate-100 px-2 py-0.5 rounded uppercase tracking-tighter border border-slate-200">
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                        user.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                        {user.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        className="text-xs font-bold text-rose-600 hover:text-rose-800 uppercase tracking-widest"
                        onClick={() => { uc.setDeleteId(user.id); uc.setConfirmOpen(true); }} 
                        disabled={!uc.canAdmin}
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        ) : (
          <div className="p-12 text-center text-slate-400 text-sm italic">
            Aplica filtros para cargar el directorio.
          </div>
        )}
      </div>
      </div>
      ) : null}

      {activeTab === 'alta' ? (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-8">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest mb-6">Crear usuario</h3>
          <form className="space-y-6" onSubmit={uc.handleCreate}>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label className="label-text">Correo</label>
                <input required className="input-field" type="email" value={uc.createForm.email} onChange={e => uc.setCreateForm(p => ({ ...p, email: e.target.value }))} />
              </div>
              <div>
                <label className="label-text">Rol asignado</label>
                <select className="input-field" value={uc.createForm.role} onChange={e => uc.setCreateForm(p => ({ ...p, role: e.target.value as UserRole }))}>
                  {USER_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label className="label-text">Nombre</label>
                <input required className="input-field" value={uc.createForm.firstName} onChange={e => uc.setCreateForm(p => ({ ...p, firstName: e.target.value }))} />
              </div>
              <div>
                <label className="label-text">Apellidos</label>
                <input required className="input-field" value={uc.createForm.lastName} onChange={e => uc.setCreateForm(p => ({ ...p, lastName: e.target.value }))} />
              </div>
            </div>
            <button type="submit" className="btn-secondary w-full sm:w-auto" disabled={!uc.canAdmin}>
              Crear cuenta
            </button>
          </form>
        </div>
      ) : null}

      <DangerConfirmModal
        open={uc.confirmOpen}
        title="Eliminar acceso"
        description={`¿Seguro que quieres eliminar de forma permanente la cuenta ${uc.deleteId}? El usuario perderá el acceso inmediatamente.`}
        confirmWord="DELETE"
        onCancel={() => uc.setConfirmOpen(false)}
        onConfirm={() => uc.executeDelete()}
      />
    </div>
  );
}
