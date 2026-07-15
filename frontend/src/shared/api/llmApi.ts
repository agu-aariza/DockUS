import { http } from "./http";
import type {
  LlmConfigsResponse,
  LlmProviderId,
  LlmProviderTestResult,
  SaveLlmConfigsPayload,
} from "../../features/llm/types";

export const llmApi = {
  async getConfigs(): Promise<LlmConfigsResponse> {
    const { data } = await http.get<LlmConfigsResponse>("/builder/llm-configs");
    return data;
  },

  async saveConfigs(payload: SaveLlmConfigsPayload): Promise<void> {
    await http.post("/builder/llm-configs", payload);
  },

  /** Lanza una llamada real al proveedor con las credenciales ya guardadas. */
  async testProvider(providerId: LlmProviderId): Promise<LlmProviderTestResult> {
    const { data } = await http.post<LlmProviderTestResult>(
      `/builder/llm-configs/${providerId}/test`,
    );
    return data;
  },
};
