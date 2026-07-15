import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RiUser3Fill,
  RiUserAddFill,
  RiSearchLine,
  RiDeleteBin7Line,
  RiShieldCheckFill,
  RiLockPasswordFill,
  RiMailFill,
} from 'react-icons/ri';
import { DangerConfirmModal } from '../shared/components/DangerConfirmModal';
import { EmptyState } from '../shared/components/EmptyState';
import { PageHeader } from '../shared/components/ui/PageHeader';
import { useToast } from '../shared/toast/ToastContext';
import type { UserEntity, UserStatus } from '../features/auth/types';
import type { UserRole } from '../shared/types';
import { useUserManagement } from './hooks/useUserManagement';
import { Button, IconButton } from '../shared/components/ui/Button';
import { Tabs } from '../shared/components/ui/Tabs';
import { Card } from '../shared/components/ui/Layout';
import { SectionCard } from '../shared/components/ui/Layout';
import { StatusBadge, type StatusTone } from '../shared/components/ui/StatusBadge';
import { SearchInput } from '../shared/components/ui/SearchInput';
import { DataTable } from '../shared/components/ui/DataTable';
import type { Column } from '../shared/components/ui/DataTable';

type UsersTab = 'consulta' | 'alta';

const USER_ROLES: UserRole[] = ['ADMIN', 'TEACHER', 'STUDENT'];
const USER_STATUSES: UserStatus[] = ['ACTIVE', 'INACTIVE', 'SUSPENDED'];

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Administrador',
  TEACHER: 'Docente',
  STUDENT: 'Estudiante',
};

const STATUS_TONE: Record<UserStatus, StatusTone> = {
  ACTIVE: 'active',
  INACTIVE: 'idle',
  SUSPENDED: 'warning',
  PENDING_VERIFICATION: 'pending',
};

const ROLE_TONE: Record<UserRole, StatusTone> = {
  ADMIN: 'danger',
  TEACHER: 'info',
  STUDENT: 'success',
};

export function UsersPanel(): JSX.Element {
  const navigate = useNavigate();
  const uc = useUserManagement();
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

  const columns = useMemo<Column<UserEntity>[]>(
    () => [
      {
        header: 'Usuario',
        accessor: 'firstName',
        sortable: true,
        sortValue: (user) => `${user.lastName} ${user.firstName}`,
        render: (user) => (
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-xs font-semibold text-primary">
              {user.firstName[0]}
              {user.lastName[0]}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-slate-900">
                {user.firstName} {user.lastName}
              </div>
              <div className="flex items-center gap-1 truncate text-xs text-slate-500">
                <RiMailFill className="shrink-0 text-[10px]" />
                {user.email}
              </div>
            </div>
          </div>
        ),
      },
      {
        header: 'Rol / Estado',
        accessor: 'role',
        sortable: true,
        sortValue: (user) => `${user.role} ${user.status}`,
        render: (user) => (
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={ROLE_TONE[user.role]}>{user.role}</StatusBadge>
            <StatusBadge tone={STATUS_TONE[user.status]}>{user.status}</StatusBadge>
          </div>
        ),
      },
      {
        header: 'Acciones',
        accessor: (user) => user.id,
        align: 'right',
        render: (user) => (
          <IconButton
            label="Revocar acceso"
            onClick={() => {
              uc.setDeleteId(user.id);
              uc.setConfirmOpen(true);
            }}
            disabled={!uc.canAdmin}
            className="text-slate-400 hover:text-red-700 hover:bg-red-50"
          >
            <RiDeleteBin7Line className="text-base" />
          </IconButton>
        ),
      },
    ],
    [uc]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Directorio de Usuarios"
        subtitle="Gestión de identidades, roles y permisos de seguridad para el ecosistema DockUS."
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
      />

      {activeTab === 'consulta' ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-4">
          {/* Filters Column */}
          <div className="xl:col-span-1">
            <Card title="Filtros" className="sticky top-24">
              <div className="space-y-5">
                <div>
                  <label htmlFor="role-filter" className="mb-1.5 block text-xs font-medium text-slate-500">
                    Rol
                  </label>
                  <select
                    id="role-filter"
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                    value={uc.query.role}
                    onChange={(e) => uc.setQuery((p) => ({ ...p, role: e.target.value }))}
                  >
                    <option value="">Todos los roles</option>
                    {USER_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="status-filter" className="mb-1.5 block text-xs font-medium text-slate-500">
                    Estado
                  </label>
                  <select
                    id="status-filter"
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                    value={uc.query.status}
                    onChange={(e) => uc.setQuery((p) => ({ ...p, status: e.target.value }))}
                  >
                    <option value="">Cualquier estado</option>
                    {USER_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="search-filter" className="mb-1.5 block text-xs font-medium text-slate-500">
                    Buscar
                  </label>
                  <SearchInput
                    id="search-filter"
                    value={uc.query.search}
                    onChange={(value) => uc.setQuery((p) => ({ ...p, search: value }))}
                    placeholder="Nombre o email..."
                  />
                </div>
                <Button className="w-full" onClick={() => void uc.handleList()} disabled={!uc.canList}>
                  Sincronizar Directorio
                </Button>
              </div>
            </Card>
          </div>

          {/* Table Column */}
          <div className="xl:col-span-3">
            {uc.listResponse ? (
              <DataTable
                caption="Registros encontrados"
                columns={columns}
                data={uc.listResponse.data}
                loading={uc.loading}
                stickyHeader
                maxHeight="32rem"
                keyExtractor={(user) => user.id}
                // Solo los alumnos tienen expediente: un profesor no tiene entregas.
                onRowClick={(user) =>
                  user.role === 'STUDENT'
                    ? navigate(`/students/${user.id}`)
                    : undefined
                }
                rowAriaLabel={(user) =>
                  user.role === 'STUDENT'
                    ? `Abrir expediente de ${user.lastName}, ${user.firstName}`
                    : `${user.lastName}, ${user.firstName}`
                }
                emptyState={
                  <EmptyState
                    icon={<RiSearchLine className="text-2xl text-slate-400" />}
                    title="Sin resultados"
                    description="No se encontraron usuarios con los criterios seleccionados."
                  />
                }
              />
            ) : (
              <EmptyState
                icon={<RiSearchLine className="text-2xl text-slate-400" />}
                title="Directorio no cargado"
                description="Configura los filtros y sincroniza para ver el personal del sistema."
              />
            )}
          </div>
        </div>
      ) : (
        <div className="max-w-3xl">
          <SectionCard
            title="Alta de Nuevo Operador"
            description="Crea una nueva identidad con acceso controlado a la plataforma."
          >
            <form className="space-y-6" onSubmit={uc.handleCreate}>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div className="space-y-4">
                  <div className="text-xs font-medium text-slate-600">Información de Perfil</div>
                  <div>
                    <label htmlFor="create-first-name" className="label-text">Nombre</label>
                    <input
                      id="create-first-name"
                      required
                      className="input-field"
                      placeholder="Nombre"
                      value={uc.createForm.firstName}
                      onChange={(e) => uc.setCreateForm((p) => ({ ...p, firstName: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label htmlFor="create-last-name" className="label-text">Apellidos</label>
                    <input
                      id="create-last-name"
                      required
                      className="input-field"
                      placeholder="Apellidos"
                      value={uc.createForm.lastName}
                      onChange={(e) => uc.setCreateForm((p) => ({ ...p, lastName: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="text-xs font-medium text-slate-600">Seguridad y Credenciales</div>
                  <div>
                    <label htmlFor="create-email" className="label-text">Correo electrónico</label>
                    <div className="relative">
                      <RiMailFill className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        id="create-email"
                        required
                        className="input-field pl-10"
                        type="email"
                        placeholder="email@dockus.pro"
                        value={uc.createForm.email}
                        onChange={(e) => uc.setCreateForm((p) => ({ ...p, email: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="create-password" className="label-text">Contraseña</label>
                    <div className="relative">
                      <RiLockPasswordFill className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        id="create-password"
                        required
                        className="input-field pl-10"
                        type="password"
                        placeholder="Establecer contraseña"
                        value={uc.createForm.password}
                        onChange={(e) => uc.setCreateForm((p) => ({ ...p, password: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <div className="mb-3 block text-xs font-medium text-slate-600">Nivel de Autorización</div>
                <div
                  className="grid grid-cols-1 gap-3 sm:grid-cols-3"
                  role="radiogroup"
                  aria-label="Rol del usuario"
                >
                  {USER_ROLES.map((role) => (
                    <button
                      key={role}
                      type="button"
                      role="radio"
                      aria-checked={uc.createForm.role === role}
                      aria-label={ROLE_LABELS[role]}
                      onClick={() => uc.setCreateForm((p) => ({ ...p, role }))}
                      className={`flex flex-col items-center gap-2 rounded-lg border px-4 py-4 text-center transition-colors ${
                        uc.createForm.role === role
                          ? 'border-primary bg-primary-subtle text-primary'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <RiShieldCheckFill
                        className={`text-lg ${uc.createForm.role === role ? 'text-primary' : 'text-slate-400'}`}
                      />
                      <span className="text-xs font-semibold uppercase tracking-wide">{role}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-app-border pt-4">
                <Button
                  type="submit"
                  disabled={!uc.canAdmin || !uc.createForm.password}
                >
                  Finalizar Alta de Usuario
                </Button>
              </div>
            </form>
          </SectionCard>
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
