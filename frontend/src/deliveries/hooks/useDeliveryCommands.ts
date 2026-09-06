import { type FormEvent, type Dispatch, type SetStateAction } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deliveriesApi } from "../api/deliveriesApi";
import type { DeliveryStatus } from "../../features/deliveries/types";
import { getErrorMessage } from "../../shared/utils/errors";
import { queryKeys } from "../../shared/query/queryKeys";
import type {
  CreateDeliveryForm,
  NoticeState,
  StatusDeliveryForm,
  UpdateDeliveryForm,
} from "./deliveryManagement.types";
import type { PreviewFile } from "./deliveriesPanel.reducer";

type CreateDeliveryPayload = Parameters<typeof deliveriesApi.create>[0];
type UpdateDeliveryPayload = Parameters<typeof deliveriesApi.update>[1];
type GradingPayload = Parameters<typeof deliveriesApi.updateGrading>[1];
type RefetchResult = { data?: unknown; error?: unknown };

interface UseDeliveryCommandsInput {
  canRead: boolean;
  canWrite: boolean;
  createForm: CreateDeliveryForm;
  updateForm: UpdateDeliveryForm;
  statusForm: StatusDeliveryForm;
  setDelivery: (id: string, label?: string) => void;
  setEditorNotice: Dispatch<SetStateAction<NoticeState | null>>;
  setWorkspaceNotice: Dispatch<SetStateAction<NoticeState | null>>;
  deliveriesQuery: { refetch: () => Promise<RefetchResult> };
}

export function useDeliveryCommands({
  canRead,
  canWrite,
  createForm,
  updateForm,
  statusForm,
  setDelivery,
  setEditorNotice,
  setWorkspaceNotice,
  deliveriesQuery,
}: UseDeliveryCommandsInput) {
  const queryClient = useQueryClient();
  const invalidateDeliveries = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.deliveries.all });

  const invalidateAfterGrading = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.deliveries.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.summary.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.builderRuns.all }),
    ]);
  };

  const createMutation = useMutation({
    mutationFn: (payload: CreateDeliveryPayload) => deliveriesApi.create(payload),
    onSuccess: invalidateDeliveries,
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateDeliveryPayload }) =>
      deliveriesApi.update(id, payload),
    onSuccess: invalidateDeliveries,
  });
  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: DeliveryStatus }) =>
      deliveriesApi.updateStatus(id, status),
    onSuccess: invalidateDeliveries,
  });
  const gradingMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: GradingPayload }) =>
      deliveriesApi.updateGrading(id, payload),
    onSuccess: invalidateAfterGrading,
  });

  const updateGrading = (id: string, payload: GradingPayload) =>
    gradingMutation.mutateAsync({ id, payload });

  const previewDelivery = (deliveryId: string): Promise<PreviewFile[]> =>
    deliveriesApi.preview(deliveryId);

  const refreshDeliveries = async () => {
    const result = await deliveriesQuery.refetch();
    if (result.data) {
      setWorkspaceNotice({ text: "Entregas actualizadas.", tone: "info" });
    } else if (result.error) {
      setWorkspaceNotice({
        text: getErrorMessage(result.error),
        tone: "warning",
      });
    }
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canRead || !createForm.assignmentId.trim()) return;
    try {
      const response = await createMutation.mutateAsync({
        ...createForm,
        notes: createForm.notes || undefined,
      });
      setEditorNotice({ text: "Entrega creada correctamente.", tone: "info" });
      setDelivery(response.id);
    } catch (error) {
      setEditorNotice({ text: getErrorMessage(error), tone: "warning" });
    }
  };

  const handleUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canWrite || !updateForm.id.trim()) return;
    try {
      await updateMutation.mutateAsync({
        id: updateForm.id.trim(),
        payload: {
          status: updateForm.status
            ? (updateForm.status as DeliveryStatus)
            : undefined,
          notes: updateForm.notes || undefined,
        },
      });
      setEditorNotice({ text: "Entrega actualizada.", tone: "info" });
    } catch (error) {
      setEditorNotice({ text: getErrorMessage(error), tone: "warning" });
    }
  };

  const handleStatusUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canWrite || !statusForm.id.trim()) return;
    try {
      await statusMutation.mutateAsync({
        id: statusForm.id.trim(),
        status: statusForm.status,
      });
      setEditorNotice({ text: "Estado actualizado.", tone: "info" });
    } catch (error) {
      setEditorNotice({ text: getErrorMessage(error), tone: "warning" });
    }
  };

  return {
    refreshDeliveries,
    handleCreate,
    handleUpdate,
    handleStatusUpdate,
    updateGrading,
    previewDelivery,
  };
}
