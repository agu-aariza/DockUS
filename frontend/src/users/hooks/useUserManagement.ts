import { type FormEvent, useState } from 'react';
import { usersApi } from '../../shared/api/services';
import type {
  PaginatedResponse,
  SessionRecord,
  UserEntity,
  UserRole,
  UserStatus,
} from '../../shared/types';
import { useManagementPermissions } from '../../shared/session/useManagementPermissions';
import { getErrorMessage } from '../../shared/utils/errors';

export function useUserManagement(session: SessionRecord | null) {
  const [query, setQuery] = useState({ page: '1', limit: '20', role: '', status: '', search: '' });
  const [listResponse, setListResponse] = useState<PaginatedResponse<UserEntity> | null>(null);
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

  const handleList = async () => {
    if (!canList) return;
    try {
      const response = await usersApi.list({
        page: Number(query.page) || 1,
        limit: Number(query.limit) || 20,
        role: (query.role || undefined) as UserRole | undefined,
        status: (query.status || undefined) as UserStatus | undefined,
        search: query.search || undefined,
      });
      setListResponse(response);
      setResult(response);
    } catch (e) { setMessage(getErrorMessage(e)); }
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canAdmin) return;
    try {
      const response = await usersApi.create(createForm);
      setResult(response);
      setMessage('Usuario creado.');
      await handleList();
    } catch (e) { setMessage(getErrorMessage(e)); }
  };

  const handleUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canAdmin || !updateForm.id.trim()) return;
    try {
      const response = await usersApi.update(updateForm.id.trim(), {
        email: updateForm.email || undefined,
        password: updateForm.password || undefined,
        firstName: updateForm.firstName || undefined,
        lastName: updateForm.lastName || undefined,
        role: updateForm.role || undefined,
        status: updateForm.status || undefined,
      });
      setResult(response);
      setMessage('Usuario actualizado.');
      await handleList();
    } catch (e) { setMessage(getErrorMessage(e)); }
  };

  const executeDelete = async () => {
    if (!canAdmin || !deleteId.trim()) return;
    try {
      await usersApi.remove(deleteId.trim());
      setMessage('Usuario eliminado.');
      await handleList();
    } catch (e) { setMessage(getErrorMessage(e)); throw e; }
  };

  return {
    query, setQuery,
    listResponse,
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
