/**
 * @fileoverview Panel de configuración de modelos de IA y proveedores (useLlmConfigManagement).
 *
 * @module useLlmConfigManagement
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { llmApi } from "../api/llmApi";
import { queryKeys } from "../../shared/query/queryKeys";
import { useToast } from "../../shared/toast/ToastContext";
import {
  LLM_PROVIDER_IDS,
  type LlmProviderId,
  type LlmProviderTestResult,
  type LlmRole,
  type LlmRoleMappings,
} from "../../features/llm/types";
import {
  AWS_PROVIDERS,
  type ConnectionEvent,
  DEFAULT_CONFIGS,
  EMPTY_ROLE_MAPPINGS,
  extractApiError,
  KEYLESS_PROVIDERS,
  PROVIDER_METADATA,
  type ProviderForm,
  ROLE_METADATA,
  clock,
} from "../llmConfigConstants";

const now = () => new Date().toISOString();

/**
 * Toda la lógica de `LlmConfigPanel`: carga inicial, edición del formulario
 * por proveedor, guardado, borrado de clave y prueba de conexión en vivo.
 * Mantiene el componente como composición de vista y concentra el estado
 * asíncrono en un hook reutilizable.
 */
export function useLlmConfigManagement() {
  const { pushToast } = useToast();

  const [selectedProvider, setSelectedProvider] = useState<LlmProviderId>("bedrock");
  const [configs, setConfigs] = useState<Record<LlmProviderId, ProviderForm>>(DEFAULT_CONFIGS);
  const [savedKeys, setSavedKeys] = useState<
    Record<LlmProviderId, { hasApiKey: boolean; last4: string | null }>
  >(() =>
    Object.fromEntries(
      LLM_PROVIDER_IDS.map((id) => [id, { hasApiKey: false, last4: null }]),
    ) as Record<LlmProviderId, { hasApiKey: boolean; last4: string | null }>,
  );
  /** Clave escrita en esta sesión. Vacía = conservar la guardada en el servidor. */
  const [apiKeyDrafts, setApiKeyDrafts] = useState<Partial<Record<LlmProviderId, string>>>({});
  const [roleMappings, setRoleMappings] = useState<LlmRoleMappings>(EMPTY_ROLE_MAPPINGS);
  const [encryptionEnabled, setEncryptionEnabled] = useState(true);

  const [isSaving, setIsSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [testLogs, setTestLogs] = useState("");
  const [testEvents, setTestEvents] = useState<ConnectionEvent[]>([]);

  const configsQuery = useQuery({
    queryKey: queryKeys.llmConfig.all(),
    queryFn: () => llmApi.getConfigs(),
  });
  const isLoading = configsQuery.isPending;

  // Carga inicial que se vuelve estado de formulario editable localmente: no
  // hay forma de "aplicar los datos frescos" salvo un efecto explícito, ya que
  // useQuery v5 no tiene onSuccess.
  useEffect(() => {
    const data = configsQuery.data;
    if (!data) return;

    setConfigs((prev) => {
      const merged = { ...prev };
      for (const provider of data.providers) {
        merged[provider.providerId] = {
          ...DEFAULT_CONFIGS[provider.providerId],
          awsAccessKeyId: provider.awsAccessKeyId ?? "",
          endpoint: provider.endpoint ?? "",
          region: provider.region ?? "",
          modelVersion: provider.modelVersion ?? "",
          modelId: provider.modelId,
          temperature: provider.temperature,
          maxTokens: provider.maxTokens,
          inputCostPerMillion: provider.inputCostPerMillion,
          outputCostPerMillion: provider.outputCostPerMillion,
        };
      }
      return merged;
    });

    setSavedKeys((prev) => {
      const merged = { ...prev };
      for (const provider of data.providers) {
        merged[provider.providerId] = {
          hasApiKey: provider.hasApiKey,
          last4: provider.apiKeyLast4,
        };
      }
      return merged;
    });

    setRoleMappings({ ...EMPTY_ROLE_MAPPINGS, ...data.roleMappings });
    setEncryptionEnabled(data.credentialsEncryptionEnabled);
  }, [configsQuery.data]);

  useEffect(() => {
    if (configsQuery.isError) {
      pushToast({
        title: "No se pudo cargar la configuración",
        description: "El servidor no devolvió los proveedores de IA configurados.",
        tone: "error",
      });
    }
  }, [configsQuery.isError, pushToast]);

  const activeConfig = configs[selectedProvider];
  const activeMeta = PROVIDER_METADATA[selectedProvider];
  const activeKey = savedKeys[selectedProvider];
  const needsApiKey = !KEYLESS_PROVIDERS.includes(selectedProvider);
  const isAws = AWS_PROVIDERS.includes(selectedProvider);

  const unassignedRoles = useMemo(
    () => (Object.keys(ROLE_METADATA) as LlmRole[]).filter((role) => !roleMappings[role]),
    [roleMappings],
  );

  const handleInputChange = useCallback(
    <K extends keyof ProviderForm>(field: K, value: ProviderForm[K]) => {
      setConfigs((prev) => ({
        ...prev,
        [selectedProvider]: { ...prev[selectedProvider], [field]: value },
      }));
    },
    [selectedProvider],
  );

  const handleRoleChange = (role: LlmRole, checked: boolean) => {
    setRoleMappings((prev) => ({
      ...prev,
      [role]: checked ? selectedProvider : null,
    }));
  };

  const assignAllRolesToSelected = () => {
    setRoleMappings({
      planner: selectedProvider,
      eval: selectedProvider,
      quality: selectedProvider,
      chatbot: selectedProvider,
    });
  };

  const persist = useCallback(
    async (clearKeyFor?: LlmProviderId) => {
      await llmApi.saveConfigs({
        providers: LLM_PROVIDER_IDS.map((providerId) => {
          const form = configs[providerId];
          const draft = apiKeyDrafts[providerId]?.trim();

          return {
            providerId,
            modelId: form.modelId,
            temperature: form.temperature,
            maxTokens: form.maxTokens,
            inputCostPerMillion: form.inputCostPerMillion,
            outputCostPerMillion: form.outputCostPerMillion,
            endpoint: form.endpoint ?? "",
            region: form.region ?? "",
            modelVersion: form.modelVersion ?? "",
            awsAccessKeyId: form.awsAccessKeyId ?? "",
            // La clave solo viaja si se ha escrito una nueva; si no, el backend
            // conserva la que ya tiene cifrada.
            ...(draft ? { apiKey: draft } : {}),
            ...(clearKeyFor === providerId ? { clearApiKey: true } : {}),
          };
        }),
        roleMappings,
      });
    },
    [configs, apiKeyDrafts, roleMappings],
  );

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true);

    try {
      await persist();

      // Tras guardar, la clave deja de vivir en el navegador: el servidor solo
      // nos devolverá si existe y sus últimos 4 caracteres.
      setSavedKeys((prev) => {
        const merged = { ...prev };
        for (const providerId of LLM_PROVIDER_IDS) {
          const draft = apiKeyDrafts[providerId]?.trim();
          if (draft) {
            merged[providerId] = { hasApiKey: true, last4: draft.slice(-4) };
          }
        }
        return merged;
      });
      setApiKeyDrafts({});

      pushToast({
        title: "Configuración guardada",
        description: "Modelos, tarifas y roles actualizados en el servidor.",
        tone: "success",
      });
    } catch (error) {
      pushToast({
        title: "Error al guardar",
        description: extractApiError(error),
        tone: "error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearApiKey = async () => {
    setIsSaving(true);
    try {
      await persist(selectedProvider);
      setSavedKeys((prev) => ({
        ...prev,
        [selectedProvider]: { hasApiKey: false, last4: null },
      }));
      setApiKeyDrafts((prev) => ({ ...prev, [selectedProvider]: "" }));
      pushToast({
        title: "Clave eliminada",
        description: `Se ha borrado la clave de ${activeMeta.name}.`,
        tone: "info",
      });
    } catch (error) {
      pushToast({
        title: "No se pudo borrar la clave",
        description: extractApiError(error),
        tone: "error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Prueba real: el backend llama al proveedor con las credenciales guardadas.
   * Por eso hay que guardar antes de probar; lo que se ve aquí es la respuesta
   * del proveedor, no una simulación.
   */
  const runTestConnection = async () => {
    if (testStatus === "testing") return;

    setTestStatus("testing");
    setTestEvents([
      {
        id: "request",
        time: now(),
        type: "INFO",
        message: `Enviando prompt de prueba a ${activeMeta.name}`,
        payload: {
          modelId: activeConfig.modelId,
          endpoint: activeConfig.endpoint || "por defecto del proveedor",
        },
      },
    ]);
    setTestLogs(
      `[${clock()}] INFO: Solicitando al backend una llamada real a ${activeMeta.name}...\n`,
    );

    let result: LlmProviderTestResult;
    try {
      result = await llmApi.testProvider(selectedProvider);
    } catch (error) {
      const message = extractApiError(error);
      setTestStatus("error");
      setTestLogs((prev) => prev + `[${clock()}] ERROR: ${message}\n`);
      setTestEvents((prev) => [
        ...prev,
        { id: "result", time: now(), type: "ERROR", message },
      ]);
      pushToast({ title: "Prueba fallida", description: message, tone: "error" });
      return;
    }

    setTestStatus(result.ok ? "success" : "error");
    setTestLogs(
      (prev) =>
        prev +
        `[${clock()}] ${result.ok ? "SUCCESS" : "ERROR"}: ${result.message}\n`,
    );
    setTestEvents((prev) => [
      ...prev,
      {
        id: "result",
        time: now(),
        type: result.ok ? "SUCCESS" : "ERROR",
        message: result.message,
        payload: {
          latencyMs: result.latencyMs,
          modelId: result.modelId,
          ...(result.ok
            ? {
                inputTokens: result.inputTokens,
                outputTokens: result.outputTokens,
                respuesta: result.responsePreview,
              }
            : { errorCode: result.errorCode }),
        },
      },
    ]);

    pushToast({
      title: result.ok ? "Prueba exitosa" : "Prueba fallida",
      description: result.ok
        ? `${activeMeta.name} respondió en ${result.latencyMs} ms.`
        : result.message,
      tone: result.ok ? "success" : "error",
    });
  };

  return {
    selectedProvider,
    setSelectedProvider,
    configs,
    roleMappings,
    encryptionEnabled,
    isLoading,
    isSaving,
    showApiKey,
    setShowApiKey,
    apiKeyDrafts,
    setApiKeyDrafts,
    testStatus,
    testLogs,
    testEvents,
    activeConfig,
    activeMeta,
    activeKey,
    needsApiKey,
    isAws,
    unassignedRoles,
    handleInputChange,
    handleRoleChange,
    assignAllRolesToSelected,
    handleSave,
    handleClearApiKey,
    runTestConnection,
  };
}
