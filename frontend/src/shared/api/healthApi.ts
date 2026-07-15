import axios from "axios";
import { http } from "./http";
import type { ReadinessReport } from "../../features/health/types";

export const healthApi = {
  /**
   * Readiness de la infraestructura.
   *
   * El backend responde 503 cuando alguna dependencia está caída, así que axios lanza:
   * ese cuerpo es precisamente el informe que queremos pintar. Solo propagamos el error
   * cuando ni siquiera hay informe (API inalcanzable).
   */
  async readiness(signal?: AbortSignal): Promise<ReadinessReport> {
    try {
      const { data } = await http.get<ReadinessReport>("/health/readiness", { signal });
      return data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.data) {
        const report = error.response.data as Partial<ReadinessReport>;
        if (report.status && report.checks) {
          return report as ReadinessReport;
        }
      }
      throw error;
    }
  },
};
