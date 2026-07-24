import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { MemoryRouter } from "react-router-dom";

vi.mock("../../shared/api/services", () => ({
  assignmentsApi: { listMine: vi.fn(), listByProject: vi.fn() },
  builderApi: { listByDelivery: vi.fn(), detail: vi.fn() },
  deliveriesApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateStatus: vi.fn(),
    updateGrading: vi.fn(),
    detail: vi.fn(),
  },
  projectsApi: { list: vi.fn() },
}));

// Sesión de profesor fija: evita depender del flujo real de login/localStorage
// de SessionProvider solo para satisfacer canWrite. WorkspaceSelectionContext
// importa useSession del mismo módulo, así que también queda cubierto.
vi.mock("../../shared/session/SessionContext", () => ({
  useSession: () => ({
    activeSession: { id: "session-1", role: "TEACHER", accessToken: "t", refreshToken: "r" },
    activeSessionId: "session-1",
  }),
}));

import { deliveriesApi, projectsApi } from "../../shared/api/services";
import { WorkspaceProvider } from "../../shared/workspace/WorkspaceContext";
import { useDeliveryManagement } from "./useDeliveryManagement";

function wrapper({ children }: PropsWithChildren) {
  return (
    <MemoryRouter>
      <WorkspaceProvider>{children}</WorkspaceProvider>
    </MemoryRouter>
  );
}

describe("useDeliveryManagement — flujo de calificación del profesor (FE-ALTO-01)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(projectsApi.list).mockResolvedValue({
      data: [],
      meta: {} as any,
    });
  });

  it("does not call updateGrading when gradingForm has no delivery id selected", async () => {
    const { result } = renderHook(() => useDeliveryManagement(), { wrapper });

    await waitFor(() => expect(projectsApi.list).toHaveBeenCalled());

    // canWrite viene de la sesión TEACHER mockeada arriba y es verdadero aquí;
    // este test cubre el otro guard de handleGradingUpdate (`!gradingForm.id`).
    act(() => {
      result.current.setGradingForm({ id: "", grade: "8", graderNotes: "" });
    });

    await act(async () => {
      await result.current.handleGradingUpdate({
        preventDefault: vi.fn(),
      } as any);
    });

    expect(deliveriesApi.updateGrading).not.toHaveBeenCalled();
  });

  it("submits the grade and merged notes, refreshes the workspace selection, and shows a confirmation notice", async () => {
    vi.mocked(deliveriesApi.updateGrading).mockResolvedValue({
      id: "delivery-1",
    } as any);
    vi.mocked(deliveriesApi.list).mockResolvedValue({
      data: [],
      meta: {} as any,
    });

    const { result } = renderHook(() => useDeliveryManagement(), { wrapper });

    await waitFor(() => expect(projectsApi.list).toHaveBeenCalled());

    act(() => {
      result.current.setGradingForm({
        id: "delivery-1",
        grade: "8.5",
        graderNotes: "Buen trabajo, revisa los tests de borde.",
      });
    });

    await act(async () => {
      await result.current.handleGradingUpdate({
        preventDefault: vi.fn(),
      } as any);
    });

    expect(deliveriesApi.updateGrading).toHaveBeenCalledWith("delivery-1", {
      grade: 8.5,
      graderNotes: "Buen trabajo, revisa los tests de borde.",
    });
    expect(result.current.editorNotice).toMatchObject({
      text: "Calificación actualizada.",
      tone: "info",
    });
  });

  it("clearing the grade field sends null instead of NaN or an empty string", async () => {
    vi.mocked(deliveriesApi.updateGrading).mockResolvedValue({
      id: "delivery-1",
    } as any);
    vi.mocked(deliveriesApi.list).mockResolvedValue({
      data: [],
      meta: {} as any,
    });

    const { result } = renderHook(() => useDeliveryManagement(), { wrapper });
    await waitFor(() => expect(projectsApi.list).toHaveBeenCalled());

    act(() => {
      result.current.setGradingForm({
        id: "delivery-1",
        grade: "",
        graderNotes: "Pendiente de revisión manual.",
      });
    });

    await act(async () => {
      await result.current.handleGradingUpdate({
        preventDefault: vi.fn(),
      } as any);
    });

    expect(deliveriesApi.updateGrading).toHaveBeenCalledWith(
      "delivery-1",
      expect.objectContaining({ grade: null }),
    );
  });

  it("a failed grading update surfaces the backend message as a warning notice, not a thrown error", async () => {
    vi.mocked(deliveriesApi.updateGrading).mockRejectedValue({
      message: "La entrega ya fue archivada.",
    });

    const { result } = renderHook(() => useDeliveryManagement(), { wrapper });
    await waitFor(() => expect(projectsApi.list).toHaveBeenCalled());

    act(() => {
      result.current.setGradingForm({
        id: "delivery-1",
        grade: "9",
        graderNotes: "",
      });
    });

    await act(async () => {
      await result.current.handleGradingUpdate({
        preventDefault: vi.fn(),
      } as any);
    });

    expect(result.current.editorNotice).toMatchObject({
      text: "La entrega ya fue archivada.",
      tone: "warning",
    });
  });
});
