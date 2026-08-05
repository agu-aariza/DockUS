/**
 * @fileoverview Panel de gestión de usuarios y roles (UsersPanel).
 *
 * @module UsersPanel
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  RiUser3Fill,
  RiUserAddFill,
  RiSearchLine,
  RiDeleteBin7Line,
  RiPencilLine,
  RiLockPasswordFill,
  RiMailFill,
} from 'react-icons/ri';
import { DangerConfirmModal } from '../shared/components/DangerConfirmModal';
import { EmptyState } from '../shared/components/EmptyState';
import { PageHeader } from '../shared/components/ui/PageHeader';
import { useToast } from '../shared/toast/ToastContext';
import type { UserEntity } from '../features/auth/types';
import { useUserManagement } from './hooks/useUserManagement';
import { EditUserModal } from './components/EditUserModal';
import { Button, IconButton } from '../shared/components/ui/Button';
import { Tabs } from '../shared/components/ui/Tabs';
import { Card } from '../shared/components/ui/Layout';
import { SectionCard } from '../shared/components/ui/Layout';
import { StatusBadge } from '../shared/components/ui/StatusBadge';
import { SearchInput } from '../shared/components/ui/SearchInput';
import { DataTable } from '../shared/components/ui/DataTable';
import type { Column } from '../shared/components/ui/DataTable';
import {
  USER_ROLES,
  USER_STATUSES,
  ROLE_LABELS,
  STATUS_TONE,
  ROLE_TONE,
  ROLE_ICON,
  AVATAR_TONE,
} from './userConstants';

type UsersTab = 'consulta' | 'alta';

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
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${AVATAR_TONE[user.role]}`}
            >
              {user.firstName[0]}
              {user.lastName[0]}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-app-text">
                {user.firstName} {user.lastName}
              </div>
              <div className="flex items-center gap-1 truncate text-xs text-app-text-muted">
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
          <div className="flex items-center justify-end gap-1">
            <IconButton
              label="Editar usuario"
              onClick={(event) => {
                event.stopPropagation();
                uc.openEditUser(user);
              }}
              disabled={!uc.canAdmin}
              className="text-slate-400 hover:text-primary hover:bg-primary-subtle"
            >
              <RiPencilLine className="text-base" />
            </IconButton>
            <IconButton
              label="Revocar acceso"
              onClick={(event) => {
                event.stopPropagation();
                uc.setDeleteId(user.id);
                uc.setConfirmOpen(true);
              }}
              disabled={!uc.canAdmin}
              className="text-slate-400 hover:text-danger-700 hover:bg-danger-50"
            >
              <RiDeleteBin7Line className="text-base" />
            </IconButton>
          </div>
        ),
      },
    ],
    [uc]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Directorio de Usuarios"
        subtitle="Gestión de identidades, roles y permisos de seguridad para el ecosistema EduCodeAI."
        icon={<RiUser3Fill />}
        badge={
          uc.listResponse
            ? `${uc.listResponse.meta.total} ${uc.listResponse.meta.total === 1 ? 'registro' : 'registros'}`
            : undefined
        }
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
                  <label htmlFor="role-filter" className="ui-label mb-1.5 block">
                    Rol
                  </label>
                  <select
                    id="role-filter"
                    className="input-field"
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
                  <label htmlFor="status-filter" className="ui-label mb-1.5 block">
                    Estado
                  </label>
                  <select
                    id="status-filter"
                    className="input-field"
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
                  <label htmlFor="search-filter" className="ui-label mb-1.5 block">
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
              <>
                <div className="mb-3 flex items-center justify-between">
                  <span className="eyebrow">Registros encontrados</span>
                  <span className="data-meta">
                    {uc.listResponse.data.length} de {uc.listResponse.meta.total}
                  </span>
                </div>
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
                      icon={<RiSearchLine className="text-2xl text-app-text-muted" />}
                      title="Sin resultados"
                      description="No se encontraron usuarios con los criterios seleccionados."
                    />
                  }
                />
              </>
            ) : (
              <EmptyState
                icon={<RiSearchLine className="text-2xl text-app-text-muted" />}
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
                  <div className="ui-label">Información de Perfil</div>
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
                  <div className="ui-label">Seguridad y Credenciales</div>
                  <div>
                    <label htmlFor="create-email" className="label-text">Correo electrónico</label>
                    <div className="relative">
                      <RiMailFill className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted" />
                      <input
                        id="create-email"
                        required
                        className="input-field pl-10"
                        type="email"
                        placeholder="email@educodeai.pro"
                        value={uc.createForm.email}
                        onChange={(e) => uc.setCreateForm((p) => ({ ...p, email: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="create-password" className="label-text">Contraseña</label>
                    <div className="relative">
                      <RiLockPasswordFill className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted" />
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
                <div className="ui-label mb-3 block">Nivel de Autorización</div>
                <div
                  className="grid grid-cols-1 gap-3 sm:grid-cols-3"
                  role="radiogroup"
                  aria-label="Rol del usuario"
                >
                  {USER_ROLES.map((role) => {
                    const RoleIcon = ROLE_ICON[role];
                    const isActive = uc.createForm.role === role;
                    return (
                      <button
                        key={role}
                        type="button"
                        role="radio"
                        aria-checked={isActive}
                        aria-label={ROLE_LABELS[role]}
                        onClick={() => uc.setCreateForm((p) => ({ ...p, role }))}
                        className={`flex flex-col items-center gap-2 rounded-lg border px-4 py-4 text-center transition-colors ${
                          isActive
                            ? 'border-primary bg-primary-subtle text-primary'
                            : 'border-app-border bg-app-surface text-app-text-secondary hover:border-slate-300 hover:bg-app-bg-subtle'
                        }`}
                      >
                        <RoleIcon className={`text-lg ${isActive ? 'text-primary' : 'text-app-text-muted'}`} />
                        <span className="text-xs font-semibold uppercase tracking-wide">{role}</span>
                      </button>
                    );
                  })}
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

      <EditUserModal
        open={uc.editModalOpen}
        form={uc.updateForm}
        onFormChange={uc.setUpdateForm}
        isSaving={uc.isUpdating}
        onCancel={() => uc.setEditModalOpen(false)}
        onSubmit={uc.handleUpdate}
      />
    </div>
  );
}
