import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

vi.mock("../../shared/api/services", () => ({
  deliveriesApi: { list: vi.fn() },
}));
vi.mock("../../shared/api/builderApi", () => ({
  builderApi: { listLatestRunsByDeliveries: vi.fn() },
}));

import { deliveriesApi } from "../../shared/api/services";
import { builderApi } from "../../shared/api/builderApi";
import { useEvaluationNotifications } from "./useEvaluationNotifications";

describe("useEvaluationNotifications", () => {
  beforeEach(() => {
    vi.mocked(builderApi.listLatestRunsByDeliveries).mockResolvedValue({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("HIGH-09: resolves latest runs for a poll's deliveries with a single batch call, not one request per delivery", async () => {
    const deliveries = Array.from({ length: 8 }, (_, i) => ({
      id: `delivery-${i}`,
      updatedAt: "2026-05-11T10:00:00.000Z",
    })) as any;
    vi.mocked(deliveriesApi.list).mockResolvedValue({
      data: deliveries,
      meta: {} as any,
    });

    renderHook(() => useEvaluationNotifications({ pollIntervalMs: 60_000 }));

    await waitFor(() =>
      expect(builderApi.listLatestRunsByDeliveries).toHaveBeenCalledTimes(1),
    );
    expect(builderApi.listLatestRunsByDeliveries).toHaveBeenCalledWith(
      deliveries.map((d: any) => d.id),
    );
  });
});
