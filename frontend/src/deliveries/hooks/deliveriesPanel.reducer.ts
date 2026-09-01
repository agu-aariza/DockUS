export interface PreviewFile {
  path: string;
  content: string;
}

export interface DeliveriesPanelState {
  isPreviewModalOpen: boolean;
  previewFiles: PreviewFile[];
  isLoadingPreview: boolean;
}

export const initialDeliveriesPanelState: DeliveriesPanelState = {
  isPreviewModalOpen: false,
  previewFiles: [],
  isLoadingPreview: false,
};

export type DeliveriesPanelAction =
  | { type: "open-preview" }
  | { type: "close-preview" }
  | { type: "preview-loaded"; files: PreviewFile[] }
  | { type: "preview-failed" };

export function deliveriesPanelReducer(
  state: DeliveriesPanelState,
  action: DeliveriesPanelAction,
): DeliveriesPanelState {
  switch (action.type) {
    case "open-preview":
      return { ...state, isPreviewModalOpen: true, isLoadingPreview: true };
    case "close-preview":
      return { ...state, isPreviewModalOpen: false };
    case "preview-loaded":
      return {
        ...state,
        previewFiles: action.files,
        isLoadingPreview: false,
      };
    case "preview-failed":
      return { ...state, isPreviewModalOpen: false, isLoadingPreview: false };
    default:
      return state;
  }
}
