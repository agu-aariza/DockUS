import { useEffect, useState } from 'react';
import { 
  RiUser3Fill, RiUserAddFill, RiSearchLine, RiDeleteBin7Line, 
  RiShieldUserFill, RiShieldCheckFill, RiLockPasswordFill, RiMailFill
} from 'react-icons/ri';
import { DangerConfirmModal } from '../shared/components/DangerConfirmModal';
import { PageHeader } from '../shared/components/ui/PageHeader';
import { useToast } from '../shared/toast/ToastContext';
import type { SessionRecord, UserRole, UserStatus } from '../shared/types';
import { useUserManagement } from './hooks/useUserManagement';
import { Button } from '../shared/components/ui/Button';
import { Tabs } from '../shared/components/ui/Tabs';

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
    if (!uc.message.trim()) return;
    pushToast({
      title: 'Usuarios',
      description: uc.message,
      tone: uc.message.includes('[4') || uc.message.toLowerCase().includes('error') ? 'error' : 'info',
    });
    uc.setMessage('');
  }, [pushToast, uc.message, uc.setMessage]);

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <PageHeader 
        title="Directorio de Usuarios"
        subtitle="Gestión avanzada de identidades, roles y permisos de seguridad para el ecosistema DockUS."
        icon={<RiUser3Fill />}
        badge="Administración"
      />

      <Tabs 
        tabs={[
          { id: 'consulta', label: 'Directorio', icon: RiSearchLine },
          { id: 'alta', label: 'Nuevo Usuario', icon: RiUserAddFill },
        ]}
        activeTab={activeTab}
        onTabChange={(id) => setActiveTab(id as UsersTab)}
        variant="primary"
      />

      {activeTab === 'consulta' ? (
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
          {/* Filters Column */}
          <div className="xl:col-span-1">
            <div className="flex flex-col h-full rounded-2xl border border-academic-surface-variant/60 bg-white p-6 shadow-academic overflow-hidden sticky top-32">
              <div className="flex items-center justify-between gap-3 mb-6">
                <div>
                  <p className="eyebrow !mb-1">Filtros Inteligentes</p>
                  <h3 className="font-display text-xl font-bold tracking-tight text-academic-on-surface">
                    Criterios
                  </h3>
                </div>
              </div>
              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider mb-2 block text-academic-outline">Nivel de Acceso</label>
                  <select 
                    className="w-full bg-white border border-academic-outline-variant/30 rounded-xl px-4 py-2.5 text-sm font-bold text-academic-on-surface-variant focus:outline-none focus:border-academic-secondary transition-all cursor-pointer"
                    value={uc.query.role} 
                    onChange={e => uc.setQuery(p => ({ ...p, role: e.target.value }))}
                  >
                    <option value="">Todos los roles</option>
                    {USER_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider mb-2 block text-academic-outline">Estado de Cuenta</label>
                  <select 
                    className="w-full bg-white border border-academic-outline-variant/30 rounded-xl px-4 py-2.5 text-sm font-bold text-academic-on-surface-variant focus:outline-none focus:border-academic-secondary transition-all cursor-pointer"
                    value={uc.query.status} 
                    onChange={e => uc.setQuery(p => ({ ...p, status: e.target.value }))}
                  >
                    <option value="">Cualquier estado</option>
                    {USER_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider mb-2 block text-academic-outline">Identidad</label>
                  <div className="relative group">
                    <RiSearchLine className="absolute left-4 top-1/2 -translate-y-1/2 text-academic-outline group-focus-within:text-brand-blue transition-colors" />
                    <input 
                      className="w-full bg-white border border-academic-outline-variant/30 rounded-xl pl-11 pr-4 py-2.5 text-sm font-bold text-academic-on-surface-variant placeholder:text-academic-outline focus:outline-none focus:border-academic-secondary transition-all"
                      placeholder="Nombre o email..." 
                      value={uc.query.search} 
                      onChange={e => uc.setQuery(p => ({ ...p, search: e.target.value }))} 
                    />
                  </div>
                </div>
                <Button 
                  className="w-full py-3 rounded-xl"
                  onClick={() => void uc.handleList()} 
                  disabled={!uc.canList}
                  variant="primary"
                >
                  Sincronizar Directorio
                </Button>
              </div>
            </div>
          </div>

          {/* Table Column */}
          <div className="xl:col-span-3">
            <div className="bg-white border border-academic-surface-variant/60 rounded-2xl shadow-academic overflow-hidden">
              <div className="p-6 border-b border-academic-surface-variant/40 flex items-center justify-between bg-academic-surface-container-lowest/40">
                <h3 className="ui-label">Registros Encontrados</h3>
              </div>
              
              {uc.listResponse ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="text-[10px] font-black text-academic-outline uppercase tracking-[0.2em] border-b border-academic-surface-variant/40 bg-academic-surface-container-lowest/20">
                        <th className="px-6 py-4">Perfil de Operador</th>
                        <th className="px-6 py-4">Seguridad / Rol</th>
                        <th className="px-6 py-4 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-academic-surface-variant/40">
                      {uc.listResponse.data.map((user) => (
                        <tr key={user.id} className="group hover:bg-academic-surface transition-all duration-300">
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-4">
                              <div className="h-10 w-10 rounded-full bg-academic-primary/10 flex items-center justify-center text-academic-primary font-bold text-xs border border-academic-primary/20 shrink-0">
                                {user.firstName[0]}{user.lastName[0]}
                              </div>
                              <div className="min-w-0">
                                <div className="text-sm font-bold text-academic-on-surface group-hover:text-academic-primary transition-colors truncate">
                                  {user.firstName} {user.lastName}
                                </div>
                                <div className="text-xs font-medium text-academic-outline flex items-center gap-1.5 mt-0.5 truncate">
                                  <RiMailFill className="text-[10px]" />
                                  {user.email}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-black text-white bg-academic-on-surface uppercase tracking-wider">
                                <RiShieldUserFill />
                                {user.role}
                              </span>
                              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border ${
                                user.status === 'ACTIVE' 
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                                  : 'bg-academic-surface-container text-academic-outline border-academic-surface-variant/40'
                              }`}>
                                <div className={`h-1.5 w-1.5 rounded-full ${user.status === 'ACTIVE' ? 'bg-emerald-500 animate-pulse' : 'bg-academic-outline'}`} />
                                {user.status}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-5 text-right">
                            <button 
                              className="p-2 text-academic-outline hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                              title="Revocar acceso"
                              onClick={() => { uc.setDeleteId(user.id); uc.setConfirmOpen(true); }} 
                              disabled={!uc.canAdmin}
                            >
                              <RiDeleteBin7Line className="text-lg" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-20 text-center">
                  <div className="h-16 w-16 bg-academic-surface rounded-3xl flex items-center justify-center mx-auto mb-4 border border-academic-surface-variant/40">
                    <RiSearchLine className="text-2xl text-academic-outline/60" />
                  </div>
                  <p className="text-academic-outline text-sm font-medium italic">Configura los filtros para cargar el personal del sistema.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="max-w-3xl">
          <div className="card card-top-accent-primary">
            <div className="p-8 border-b border-academic-surface-variant/40 flex items-center justify-between bg-academic-surface-container-lowest/40">
              <div>
                <h3 className="font-display text-xl font-bold tracking-tight text-academic-on-surface flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-academic-primary text-white flex items-center justify-center shadow-academic">
                    <RiUserAddFill />
                  </div>
                  Alta de Nuevo Operador
                </h3>
                <p className="text-academic-outline text-xs font-medium mt-1">Crea una nueva identidad con acceso controlado a la plataforma.</p>
              </div>
            </div>
            
            <form className="p-8 space-y-6" onSubmit={uc.handleCreate}>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <label className="text-[10px] font-black text-academic-outline uppercase tracking-wider mb-2 block">Información de Perfil</label>
                  <div className="space-y-4">
                    <input 
                      required 
                      className="input-field" 
                      placeholder="Nombre completo"
                      value={uc.createForm.firstName} 
                      onChange={e => uc.setCreateForm(p => ({ ...p, firstName: e.target.value }))} 
                    />
                    <input 
                      required 
                      className="input-field" 
                      placeholder="Apellidos"
                      value={uc.createForm.lastName} 
                      onChange={e => uc.setCreateForm(p => ({ ...p, lastName: e.target.value }))} 
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black text-academic-outline uppercase tracking-wider mb-2 block">Seguridad y Credenciales</label>
                  <div className="space-y-4">
                    <div className="relative">
                      <RiMailFill className="absolute left-4 top-1/2 -translate-y-1/2 text-academic-outline" />
                      <input 
                        required 
                        className="input-field pl-11" 
                        type="email" 
                        placeholder="email@dockus.pro"
                        value={uc.createForm.email} 
                        onChange={e => uc.setCreateForm(p => ({ ...p, email: e.target.value }))} 
                      />
                    </div>
                    <div className="relative">
                      <RiLockPasswordFill className="absolute left-4 top-1/2 -translate-y-1/2 text-academic-outline" />
                      <input 
                        required 
                        className="input-field pl-11" 
                        type="password" 
                        placeholder="Establecer contraseña"
                        value={uc.createForm.password} 
                        onChange={e => uc.setCreateForm(p => ({ ...p, password: e.target.value }))} 
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-academic-outline uppercase tracking-wider mb-3 block">Nivel de Autorización</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {USER_ROLES.map(role => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => uc.setCreateForm(p => ({ ...p, role }))}
                      className={`flex flex-col items-center gap-3 p-5 rounded-2xl border-2 transition-all ${
                        uc.createForm.role === role
                          ? 'border-academic-primary bg-academic-primary/5 text-academic-primary shadow-academic'
                          : 'border-academic-surface-variant bg-white text-academic-outline hover:border-academic-outline'
                      }`}
                    >
                      <RiShieldCheckFill className={`text-xl ${uc.createForm.role === role ? 'text-academic-primary' : 'text-academic-surface-variant'}`} />
                      <span className="text-[10px] font-black uppercase tracking-widest">{role}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-4 pt-6 border-t border-academic-surface-variant/40">
                <Button 
                  type="submit" 
                  className="px-8 py-3 rounded-xl"
                  disabled={!uc.canAdmin || !uc.createForm.password}
                  variant="primary"
                >
                  Finalizar Alta de Usuario
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <DangerConfirmModal
        open={uc.confirmOpen}
        title="Revocación de Acceso"
        description={`¿Confirmas la eliminación permanente de la cuenta ${uc.deleteId}? Esta acción es irreversible y el operador será expulsado inmediatamente.`}
        confirmWord="DELETE"
        onCancel={() => uc.setConfirmOpen(false)}
        onConfirm={() => uc.executeDelete()}
      />
    </div>
  );
}
