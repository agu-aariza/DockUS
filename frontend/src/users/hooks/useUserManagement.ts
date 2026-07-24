/**
 * @fileoverview Panel de gestión de usuarios y roles (useUserManagement).
 *
 * @module useUserManagement
 */

import { type FormEvent, useState } from 'react';
import { usersApi } from '../../shared/api/services';
import type { UserRole } from "../../shared/types";
import type { UserEntity, UserStatus } from "../../features/auth/types";
import { useSession } from '../../shared/session/SessionContext';
import { useManagementPermissions } from '../../shared/session/useManagementPermissions';
import { getErrorMessage } from '../../shared/utils/errors';
import { useCrudResource } from '../../shared/hooks/useCrudResource';

export function useUserManagement() {
  const { activeSession: session } = useSession();
  const [query, setQuery] = useState({ page: '1', limit: '20', role: '', status: '', search: '' });
  const [detailId, setDetailId] = useState('');
  const [createForm, setCreateForm] = useState({ email: '', password: '', firstName: '', lastName: '', role: 'STUDENT' as UserRole, status: 'ACTIVE' as UserStatus });
  const [updateForm, setUpdateForm] = useState<{
    id: string;
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role: UserRole | "";
    status: UserStatus | "";
  }>({ id: '', email: '', password: '', firstName: '', lastName: '', role: '', status: '' });
  const [statusForm, setStatusForm] = useState({ id: '', status: 'ACTIVE' as UserStatus });
  
  const [restoreId, setRestoreId] = useState('');
  const [deleteId, setDeleteId] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  
  const [result, setResult] = useState<unknown>(null);
  const [message, setMessage] = useState('');

  const { canAdmin, hasAnyRole } = useManagementPermissions(session);
  const canList = hasAnyRole(['ADMIN', 'TEACHER']);

  type CreateUserPayload = Parameters<typeof usersApi.create>[0];
  type UpdateUserPayload = Parameters<typeof usersApi.update>[1];

  const crud = useCrudResource<UserEntity, CreateUserPayload, UpdateUserPayload>({
    api: {
      list: usersApi.list,
      create: usersApi.create,
      update: usersApi.update,
      remove: usersApi.remove,
    },
    canRead: canList,
    initialQuery: {
      page: Number(query.page) || 1,
      limit: Number(query.limit) || 20,
      role: query.role || undefined,
      status: query.status || undefined,
      search: query.search || undefined,
    },
  });

  const handleList = async () => {
    if (!canList) return;
    crud.setQuery({
      page: Number(query.page) || 1,
      limit: Number(query.limit) || 20,
      role: query.role || undefined,
      status: query.status || undefined,
      search: query.search || undefined,
    });
    await crud.refresh();
    setResult(crud.listResponse);
    if (crud.notice?.tone === 'warning') {
      setMessage(crud.notice.text);
    }
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canAdmin) return;
    const response = await crud.create(createForm);
    if (response) {
      setResult(response);
      setMessage('Usuario creado.');
      await crud.refresh();
    } else if (crud.notice) {
      setMessage(crud.notice.text);
    }
  };

  const handleUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canAdmin || !updateForm.id.trim()) return;
    const response = await crud.update(updateForm.id.trim(), {
      email: updateForm.email || undefined,
      password: updateForm.password || undefined,
      firstName: updateForm.firstName || undefined,
      lastName: updateForm.lastName || undefined,
      role: updateForm.role || undefined,
      status: updateForm.status || undefined,
    });
    if (response) {
      setResult(response);
      setMessage('Usuario actualizado.');
      await crud.refresh();
    } else if (crud.notice) {
      setMessage(crud.notice.text);
    }
  };

  const executeDelete = async () => {
    if (!canAdmin || !deleteId.trim()) return;
    try {
      await crud.remove(deleteId.trim());
      setMessage('Usuario eliminado.');
      await crud.refresh();
    } catch (e) {
      setMessage(getErrorMessage(e));
      throw e;
    }
  };

  return {
    query, setQuery,
    listResponse: crud.listResponse,
    loading: crud.loading,
    detailId, setDetailId,
    createForm, setCreateForm,
    updateForm, setUpdateForm,
    statusForm, setStatusForm,
    restoreId, setRestoreId,
    deleteId, setDeleteId,
    confirmOpen, setConfirmOpen,
    result, message, setMessage,
    canList, canAdmin,
    handleList, handleCreate, handleUpdate, executeDelete
  };
}
