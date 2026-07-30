/**
 * @fileoverview Panel de gestión de usuarios y roles (useUserManagement).
 *
 * @module useUserManagement
 */

import { type FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '../../shared/api/services';
import type { UserRole } from "../../shared/types";
import type { UserStatus } from "../../features/auth/types";
import { useSession } from '../../shared/session/SessionContext';
import { useManagementPermissions } from '../../shared/session/useManagementPermissions';
import { getErrorMessage } from '../../shared/utils/errors';
import { queryKeys } from '../../shared/query/queryKeys';

type UsersListQuery = Parameters<typeof usersApi.list>[0];

export function useUserManagement() {
  const { activeSession: session } = useSession();
  const queryClient = useQueryClient();
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

  // Query pasiva: solo muestra de forma reactiva lo que ya está "enviado"
  // (submittedQuery). Nada se carga hasta el primer clic explícito en
  // "Listar" (ver handleList).
  const [submittedQuery, setSubmittedQuery] = useState<UsersListQuery | null>(null);
  const usersQuery = useQuery({
    queryKey: queryKeys.users.list(submittedQuery ?? {}),
    queryFn: () => usersApi.list(submittedQuery!),
    enabled: canList && submittedQuery !== null,
  });

  // Igual que en Storage: fetchQuery con key calculada in-line (no
  // enabled:false + refetch() del observer, que operaría contra la key
  // anterior por la misma razón). staleTime:0 fuerza red en cada envío.
  const handleList = async () => {
    if (!canList) return;
    const nextQuery: UsersListQuery = {
      page: Number(query.page) || 1,
      limit: Number(query.limit) || 20,
      role: (query.role || undefined) as UserRole | undefined,
      status: (query.status || undefined) as UserStatus | undefined,
      search: query.search || undefined,
    };
    setSubmittedQuery(nextQuery);
    try {
      const response = await queryClient.fetchQuery({
        queryKey: queryKeys.users.list(nextQuery),
        queryFn: () => usersApi.list(nextQuery),
        staleTime: 0,
      });
      setResult(response);
    } catch (e) {
      setMessage(getErrorMessage(e));
    }
  };

  const invalidateUsers = () => queryClient.invalidateQueries({ queryKey: queryKeys.users.all });

  const createMutation = useMutation({
    mutationFn: (payload: CreateUserPayload) => usersApi.create(payload),
    onSuccess: invalidateUsers,
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateUserPayload }) =>
      usersApi.update(id, payload),
    onSuccess: invalidateUsers,
  });
  const removeMutation = useMutation({
    mutationFn: (id: string) => usersApi.remove(id),
    onSuccess: invalidateUsers,
  });

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canAdmin) return;
    try {
      const response = await createMutation.mutateAsync(createForm);
      setResult(response);
      setMessage('Usuario creado.');
      await handleList();
    } catch (e) {
      setMessage(getErrorMessage(e));
    }
  };

  const handleUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canAdmin || !updateForm.id.trim()) return;
    try {
      const response = await updateMutation.mutateAsync({
        id: updateForm.id.trim(),
        payload: {
          email: updateForm.email || undefined,
          password: updateForm.password || undefined,
          firstName: updateForm.firstName || undefined,
          lastName: updateForm.lastName || undefined,
          role: updateForm.role || undefined,
          status: updateForm.status || undefined,
        },
      });
      setResult(response);
      setMessage('Usuario actualizado.');
      await handleList();
    } catch (e) {
      setMessage(getErrorMessage(e));
    }
  };

  const executeDelete = async () => {
    if (!canAdmin || !deleteId.trim()) return;
    try {
      await removeMutation.mutateAsync(deleteId.trim());
      setMessage('Usuario eliminado.');
      await handleList();
    } catch (e) {
      setMessage(getErrorMessage(e));
      throw e;
    }
  };

  return {
    query, setQuery,
    listResponse: usersQuery.data ?? null,
    loading: usersQuery.isFetching,
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
