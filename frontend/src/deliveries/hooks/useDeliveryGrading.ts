import {
  type Dispatch,
  type FormEvent,
  type SetStateAction,
  useEffect,
  useState,
} from "react";
import { deliveriesApi } from "../api/deliveriesApi";
import type { DeliveryEntity } from "../../features/deliveries/types";
import { getErrorMessage } from "../../shared/utils/errors";
import {
  extractLegacyAiEvidence,
  mergeManualAndLegacyNotes,
} from "../teacherReviewNavigation";
import type { GradingForm, NoticeState } from "./deliveryManagement.types";

type GradingPayload = Parameters<typeof deliveriesApi.updateGrading>[1];
type GradingResponse = Awaited<ReturnType<typeof deliveriesApi.updateGrading>>;

interface UseDeliveryGradingInput {
  canWrite: boolean;
  selectedDelivery: DeliveryEntity | null;
  selectedDeliveryReviewNotes: ReturnType<typeof extractLegacyAiEvidence>;
  setDelivery: (id: string, label?: string) => void;
  setEditorNotice: Dispatch<SetStateAction<NoticeState | null>>;
  updateGrading: (id: string, payload: GradingPayload) => Promise<GradingResponse>;
}

export function useDeliveryGrading({
  canWrite,
  selectedDelivery,
  selectedDeliveryReviewNotes,
  setDelivery,
  setEditorNotice,
  updateGrading,
}: UseDeliveryGradingInput) {
  const [gradingForm, setGradingForm] = useState<GradingForm>({
    id: "",
    grade: "",
    graderNotes: "",
  });

  useEffect(() => {
    if (!selectedDelivery) return;
    setGradingForm({
      id: selectedDelivery.id,
      grade: selectedDelivery.grade !== null ? String(selectedDelivery.grade) : "",
      graderNotes: extractLegacyAiEvidence(selectedDelivery.graderNotes).manualNotes ?? "",
    });
  }, [selectedDelivery]);

  const handleGradingUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canWrite || !gradingForm.id.trim()) return;
    try {
      const response = await updateGrading(gradingForm.id.trim(), {
        grade: gradingForm.grade.trim() ? Number(gradingForm.grade) : null,
        graderNotes: mergeManualAndLegacyNotes(
          gradingForm.graderNotes,
          selectedDeliveryReviewNotes.legacyRaw,
        ),
      });
      setEditorNotice({ text: "Calificación actualizada.", tone: "info" });
      setDelivery(response.id);
    } catch (error) {
      setEditorNotice({ text: getErrorMessage(error), tone: "warning" });
    }
  };

  return { gradingForm, setGradingForm, handleGradingUpdate };
}
