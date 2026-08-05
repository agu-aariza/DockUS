import { describe, it, expect, vi, beforeEach } from "vitest";
import { waitFor } from "@testing-library/react";

vi.mock("../../shared/api/services", () => ({
  assignmentsApi: { listMine: vi.fn() },
  deliveriesApi: { list: vi.fn() },
}));
vi.mock("../../shared/api/builderApi", () => ({
  builderApi: { listLatestRunsByDeliveries: vi.fn() },
}));

import { assignmentsApi, deliveriesApi } from "../../shared/api/services";
import { builderApi } from "../../shared/api/builderApi";
import { renderHookWithProviders } from "../../test/renderWithProviders";
import { useStudentWorkspaceData } from "./useStudentWorkspaceData";

function renderHook(hook: () => ReturnType<typeof useStudentWorkspaceData>) {
  return renderHookWithProviders(hook, { withWorkspace: false });
}

describe("useStudentWorkspaceData", () => {
  beforeEach(() => {
    vi.mocked(assignmentsApi.listMine).mockResolvedValue([]);
  });

  it("fetches the latest run per delivery with a single batch call, not one request per delivery", async () => {
    const deliveries = Array.from({ length: 12 }, (_, i) => ({
      id: `delivery-${i}`,
    })) as any;
    vi.mocked(deliveriesApi.list).mockResolvedValue({
      data: deliveries,
      meta: {} as any,
    });
    vi.mocked(builderApi.listLatestRunsByDeliveries).mockResolvedValue(
      Object.fromEntries(deliveries.map((d: any) => [d.id, null])),
    );

    const { result } = renderHook(() => useStudentWorkspaceData());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(builderApi.listLatestRunsByDeliveries).toHaveBeenCalledTimes(1);
    expect(builderApi.listLatestRunsByDeliveries).toHaveBeenCalledWith(
      deliveries.map((d: any) => d.id),
    );
    expect(Object.keys(result.current.latestRunByDeliveryId)).toHaveLength(12);
  });

  it("degrades to an empty map (not a crash) if the batch call fails", async () => {
    vi.mocked(deliveriesApi.list).mockResolvedValue({
      data: [{ id: "delivery-1" } as any],
      meta: {} as any,
    });
    vi.mocked(builderApi.listLatestRunsByDeliveries).mockRejectedValue(
      new Error("network error"),
    );

    const { result } = renderHook(() => useStudentWorkspaceData());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.latestRunByDeliveryId).toEqual({});
    expect(result.current.error).toBeNull();
  });
});
/**
 * Pruebas de agregación de datos del espacio de trabajo del alumno.
 */
