import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PaginatedResponse } from '../types';
import { getErrorMessage } from '../utils/errors';

type NoticeTone = 'info' | 'warning' | 'error';

export interface CrudNotice {
  text: string;
  tone: NoticeTone;
}

export interface CrudApi<T, CreateT = unknown, UpdateT = unknown> {
  list: (query: Record<string, unknown>) => Promise<PaginatedResponse<T>>;
  create?: (payload: CreateT) => Promise<T>;
  update?: (id: string, payload: UpdateT) => Promise<T>;
  remove?: (id: string) => Promise<void>;
  restore?: (id: string) => Promise<T>;
}

export interface UseCrudResourceOptions<T, CreateT = unknown, UpdateT = unknown> {
  api: CrudApi<T, CreateT, UpdateT>;
  initialQuery?: Record<string, unknown>;
  canRead?: boolean;
  autoLoad?: boolean;
  preserveSelection?: boolean;
  autoSelectFirst?: boolean;
  getItemId?: (item: T) => string;
  onListError?: (error: unknown) => void;
  onMutateError?: (error: unknown) => void;
}

export interface UseCrudResourceReturn<T, CreateT = unknown, UpdateT = unknown> {
  listResponse: PaginatedResponse<T> | null;
  items: T[];
  loading: boolean;
  error: string | null;
  notice: CrudNotice | null;
  clearNotice: () => void;

  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  selectedItem: T | null;

  query: Record<string, unknown>;
  setQuery: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;

  refresh: (
    successMessage?: string,
    queryOverride?: Record<string, unknown>,
  ) => Promise<PaginatedResponse<T> | null>;
  setListResponse: (response: PaginatedResponse<T> | null) => void;

  create: (payload: CreateT) => Promise<T | undefined>;
  creating: boolean;
  update: (id: string, payload: UpdateT) => Promise<T | undefined>;
  updating: boolean;
  remove: (id: string) => Promise<void>;
  deleting: boolean;
  restore: (id: string) => Promise<T | undefined>;
  restoring: boolean;
}

const defaultGetItemId = <T extends { id: string }>(item: T): string => item.id;

export function useCrudResource<T extends { id: string }, CreateT = unknown, UpdateT = unknown>(
  options: UseCrudResourceOptions<T, CreateT, UpdateT>,
): UseCrudResourceReturn<T, CreateT, UpdateT> {
  const {
    api,
    initialQuery = {},
    canRead = true,
    autoLoad = false,
    preserveSelection = false,
    autoSelectFirst = false,
    getItemId = defaultGetItemId,
    onListError,
    onMutateError,
  } = options;

  const [query, setQuery] = useState<Record<string, unknown>>(initialQuery);
  const [listResponse, setListResponse] = useState<PaginatedResponse<T> | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<CrudNotice | null>(null);
  const [selectedId, setSelectedIdState] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const items = useMemo(() => listResponse?.data ?? [], [listResponse]);

  const selectedItem = useMemo(() => {
    if (!selectedId) return null;
    return items.find((item) => getItemId(item) === selectedId) ?? null;
  }, [items, selectedId, getItemId]);

  const setSelectedId = useCallback((id: string | null) => {
    setSelectedIdState(id);
  }, []);

  const clearNotice = useCallback(() => setNotice(null), []);

  const refresh = useCallback(
    async (
      successMessage?: string,
      queryOverride?: Record<string, unknown>,
    ): Promise<PaginatedResponse<T> | null> => {
      if (!canRead) return null;
      const effectiveQuery = queryOverride ?? query;
      setLoading(true);
      setNotice(null);
      try {
        const response = await api.list(effectiveQuery);
        setListResponse(response);

        if (preserveSelection) {
          setSelectedIdState((current) => {
            if (current && response.data.some((item) => getItemId(item) === current)) {
              return current;
            }
            if (autoSelectFirst && response.data[0]) {
              return getItemId(response.data[0]);
            }
            return null;
          });
        } else if (autoSelectFirst && response.data[0]) {
          setSelectedIdState(getItemId(response.data[0]));
        }

        if (successMessage) {
          setNotice({ text: successMessage, tone: 'info' });
        }
        return response;
      } catch (error) {
        const message = getErrorMessage(error);
        setNotice({ text: message, tone: 'warning' });
        onListError?.(error);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [api, query, canRead, preserveSelection, autoSelectFirst, getItemId, onListError],
  );

  const setListResponseCallback = useCallback(
    (response: PaginatedResponse<T> | null) => {
      setListResponse(response);
    },
    [],
  );

  useEffect(() => {
    if (autoLoad && canRead) {
      void refresh();
    }
  }, [autoLoad, canRead, refresh]);

  const create = useCallback(
    async (payload: CreateT): Promise<T | undefined> => {
      if (!api.create) return undefined;
      setCreating(true);
      try {
        const response = await api.create(payload);
        setNotice({ text: 'Creado correctamente.', tone: 'info' });
        return response;
      } catch (error) {
        const message = getErrorMessage(error);
        setNotice({ text: message, tone: 'error' });
        onMutateError?.(error);
        return undefined;
      } finally {
        setCreating(false);
      }
    },
    [api, onMutateError],
  );

  const update = useCallback(
    async (id: string, payload: UpdateT): Promise<T | undefined> => {
      if (!api.update) return undefined;
      setUpdating(true);
      try {
        const response = await api.update(id, payload);
        setNotice({ text: 'Actualizado correctamente.', tone: 'info' });
        return response;
      } catch (error) {
        const message = getErrorMessage(error);
        setNotice({ text: message, tone: 'error' });
        onMutateError?.(error);
        return undefined;
      } finally {
        setUpdating(false);
      }
    },
    [api, onMutateError],
  );

  const remove = useCallback(
    async (id: string): Promise<void> => {
      if (!api.remove) return;
      setDeleting(true);
      try {
        await api.remove(id);
        setNotice({ text: 'Eliminado correctamente.', tone: 'info' });
      } catch (error) {
        const message = getErrorMessage(error);
        setNotice({ text: message, tone: 'error' });
        onMutateError?.(error);
        throw error;
      } finally {
        setDeleting(false);
      }
    },
    [api, onMutateError],
  );

  const restore = useCallback(
    async (id: string): Promise<T | undefined> => {
      if (!api.restore) return undefined;
      setRestoring(true);
      try {
        const response = await api.restore(id);
        setNotice({ text: 'Restaurado correctamente.', tone: 'info' });
        return response;
      } catch (error) {
        const message = getErrorMessage(error);
        setNotice({ text: message, tone: 'error' });
        onMutateError?.(error);
        return undefined;
      } finally {
        setRestoring(false);
      }
    },
    [api, onMutateError],
  );

  return {
    listResponse,
    items,
    loading,
    error: notice?.tone === 'error' || notice?.tone === 'warning' ? notice.text : null,
    notice,
    clearNotice,
    selectedId,
    setSelectedId,
    selectedItem,
    query,
    setQuery,
    refresh,
    setListResponse: setListResponseCallback,
    create,
    creating,
    update,
    updating,
    remove,
    deleting,
    restore,
    restoring,
  };
}
