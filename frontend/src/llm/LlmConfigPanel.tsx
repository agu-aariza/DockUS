import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  RiCpuLine,
  RiSave2Line,
  RiFlashlightLine,
  RiLoader4Line,
  RiTimeLine,
  RiEyeLine,
  RiEyeOffLine,
  RiAlertLine,
  RiDeleteBin6Line,
} from "react-icons/ri";
import { Card } from "../shared/components/ui/Layout";
import { PageHeader } from "../shared/components/ui/PageHeader";
import { Button } from "../shared/components/ui/Button";
import { useToast } from "../shared/toast/ToastContext";
import { llmApi } from "../shared/api/services";
import {
  LLM_PROVIDER_IDS,
  type LlmProviderConfigView,
  type LlmProviderId,
  type LlmProviderTestResult,
  type LlmRole,
  type LlmRoleMappings,
} from "../features/llm/types";

/** Campos editables de un proveedor. El secreto se maneja aparte: nunca se lee del servidor. */
type ProviderForm = Omit<LlmProviderConfigView, "providerId" | "hasApiKey" | "apiKeyLast4">;

interface ConnectionEvent {
  id: string;
  time: string;
  type: "INFO" | "SUCCESS" | "ERROR";
  message: string;
  payload?: Record<string, unknown>;
}

const DEFAULT_CONFIGS: Record<LlmProviderId, ProviderForm> = {
  bedrock: {
    awsAccessKeyId: "",
    endpoint: "",
    region: "us-east-1",
    modelVersion: "",
    modelId: "us.anthropic.claude-3-5-sonnet-20241022-v2:0",
    temperature: 0.2,
    maxTokens: 4000,
    inputCostPerMillion: 3.0,
    outputCostPerMillion: 15.0,
  },
  azure: {
    awsAccessKeyId: "",
    endpoint: "https://my-resource.openai.azure.com/",
    region: "",
    modelVersion: "2024-02-15-preview",
    modelId: "gpt-4o",
    temperature: 0.1,
    maxTokens: 4000,
    inputCostPerMillion: 2.5,
    outputCostPerMillion: 10.0,
  },
  openai: {
    awsAccessKeyId: "",
    endpoint: "https://api.openai.com/v1",
    region: "",
    modelVersion: "",
    modelId: "gpt-4o",
    temperature: 0.2,
    maxTokens: 4096,
    inputCostPerMillion: 2.5,
    outputCostPerMillion: 10.0,
  },
  anthropic: {
    awsAccessKeyId: "",
    endpoint: "https://api.anthropic.com/v1",
    region: "",
    modelVersion: "2023-06-01",
    modelId: "claude-3-5-sonnet-20241022",
    temperature: 0.2,
    maxTokens: 4000,
    inputCostPerMillion: 3.0,
    outputCostPerMillion: 15.0,
  },
  gemini: {
    awsAccessKeyId: "",
    endpoint: "https://generativelanguage.googleapis.com/v1beta",
    region: "",
    modelVersion: "",
    modelId: "gemini-1.5-pro",
    temperature: 0.2,
    maxTokens: 8192,
    inputCostPerMillion: 1.25,
    outputCostPerMillion: 5.0,
  },
  ollama: {
    awsAccessKeyId: "",
    endpoint: "http://localhost:11434/v1",
    region: "",
    modelVersion: "",
    modelId: "llama3",
    temperature: 0.2,
    maxTokens: 2048,
    inputCostPerMillion: 0.0,
    outputCostPerMillion: 0.0,
  },
};

const PROVIDER_METADATA: Record<
  LlmProviderId,
  { name: string; subtitle: string; logoUrl: string; badge: string }
> = {
  bedrock: {
    name: "AWS Bedrock",
    subtitle: "Amazon Web Services",
    logoUrl: "/logos/aws.webp",
    badge: "Enterprise",
  },
  azure: {
    name: "Azure OpenAI",
    subtitle: "Microsoft Cloud",
    logoUrl: "/logos/azure.svg",
    badge: "Cloud Seguro",
  },
  openai: {
    name: "OpenAI",
    subtitle: "Modelos GPT nativos",
    logoUrl: "/logos/openai.svg",
    badge: "Estándar",
  },
  anthropic: {
    name: "Anthropic Claude",
    subtitle: "Claude Sonnet/Haiku",
    logoUrl: "/logos/anthropic.png",
    badge: "Razonamiento",
  },
  gemini: {
    name: "Google Gemini",
    subtitle: "Multimodal nativo",
    logoUrl: "/logos/gemini.webp",
    badge: "Velocidad",
  },
  ollama: {
    name: "Ollama",
    subtitle: "Modelos locales offline",
    logoUrl: "/logos/ollama.svg",
    badge: "Local",
  },
};

const ROLE_METADATA: Record<LlmRole, { label: string; hint: string }> = {
  planner: {
    label: "Planificador (Planner)",
    hint: "Orquesta tareas y pipelines de ejecución",
  },
  eval: {
    label: "Evaluador (Eval)",
    hint: "Califica y justifica los criterios de rúbricas",
  },
  quality: {
    label: "Auditor de Calidad (Quality)",
    hint: "Analiza código, lints y buenas prácticas",
  },
  chatbot: {
    label: "Tutor AI (Chatbot)",
    hint: "Responde dudas de código a los estudiantes",
  },
};

const EMPTY_ROLE_MAPPINGS: LlmRoleMappings = {
  planner: null,
  eval: null,
  quality: null,
  chatbot: null,
};

/** Ollama corre en local y no autentica. */
const KEYLESS_PROVIDERS: LlmProviderId[] = ["ollama"];

/**
 * Bedrock no tiene API keys: usa credenciales AWS. Si se dejan vacías, el backend
 * cae en las del entorno (`AWS_*`) o en el rol IAM de la máquina.
 */
const AWS_PROVIDERS: LlmProviderId[] = ["bedrock"];

const now = () => new Date().toISOString();

export function LlmConfigPanel(): JSX.Element {
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

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [testLogs, setTestLogs] = useState("");
  const [testEvents, setTestEvents] = useState<ConnectionEvent[]>([]);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const data = await llmApi.getConfigs();
        if (!active) return;

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
      } catch {
        if (active) {
          pushToast({
            title: "No se pudo cargar la configuración",
            description: "El servidor no devolvió los proveedores de IA configurados.",
            tone: "error",
          });
        }
      } finally {
        if (active) setIsLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [pushToast]);

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Modelos de IA"
        subtitle="Configura las credenciales y perfiles de los proveedores de modelos de lenguaje que sirven cada etapa del pipeline."
        icon={<RiCpuLine />}
      />

      {!encryptionEnabled && (
        <Banner tone="danger">
          <span className="font-semibold">Claves deshabilitadas:</span> falta la variable de entorno{" "}
          <code className="font-mono">LLM_CREDENTIALS_SECRET</code> en el servidor, así que no se
          pueden guardar claves de API. Bedrock y Ollama siguen funcionando (no la necesitan).
        </Banner>
      )}

      {unassignedRoles.length > 0 && (
        <Banner tone="warning">
          <span className="font-semibold">Atención:</span> sin proveedor asignado en{" "}
          {unassignedRoles.map((role) => ROLE_METADATA[role].label).join(", ")}. Esas etapas usarán
          el modelo de Bedrock definido por variables de entorno.
        </Banner>
      )}

      <section className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        {LLM_PROVIDER_IDS.map((id) => {
          const meta = PROVIDER_METADATA[id];
          const isSelected = selectedProvider === id;
          const activeRoles = (Object.keys(ROLE_METADATA) as LlmRole[]).filter(
            (role) => roleMappings[role] === id,
          );

          return (
            <button
              key={id}
              type="button"
              onClick={() => setSelectedProvider(id)}
              className={`flex flex-col text-left rounded-xl border p-4 transition-all duration-200 ${
                isSelected
                  ? "bg-slate-900 border-primary text-white ring-2 ring-primary/20 shadow-md"
                  : "bg-white border-app-border text-slate-700 hover:bg-slate-50 hover:-translate-y-0.5"
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white border border-slate-100 p-1.5 shadow-sm">
                  <img
                    src={meta.logoUrl}
                    alt={`Logo de ${meta.name}`}
                    className="h-full w-full object-contain"
                  />
                </div>
                <span
                  className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                    isSelected ? "bg-white/10 text-white" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {meta.badge}
                </span>
              </div>

              <h4 className={`mt-4 text-sm font-bold ${isSelected ? "text-white" : "text-slate-900"}`}>
                {meta.name}
              </h4>
              <p className="mt-0.5 text-xs text-slate-400">{meta.subtitle}</p>

              {activeRoles.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-3">
                  {activeRoles.map((role) => (
                    <span
                      key={role}
                      className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${
                        isSelected ? "bg-white/10 text-slate-300" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {ROLE_METADATA[role].label.split(" ")[0]}
                    </span>
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </section>

      <div className="grid gap-6 xl:grid-cols-12">
        <form onSubmit={handleSave} className="xl:col-span-7 space-y-6">
          <Card title={`Parámetros de ${activeMeta.name}`}>
            <div className="space-y-4">
              {isAws && (
                <div className="space-y-1.5">
                  <label className="label-text">Access Key ID (AWS)</label>
                  <input
                    type="text"
                    value={activeConfig.awsAccessKeyId ?? ""}
                    onChange={(event) => handleInputChange("awsAccessKeyId", event.target.value)}
                    placeholder="Opcional: AKIA... (vacío = credenciales del entorno o rol IAM)"
                    className="input-field"
                  />
                </div>
              )}

              {needsApiKey && (
                <div className="space-y-1.5">
                  <label className="label-text flex items-center justify-between">
                    <span>{isAws ? "Secret Access Key (AWS)" : "Clave de API (API Key)"}</span>
                    <button
                      type="button"
                      onClick={() => setShowApiKey((prev) => !prev)}
                      className="text-xs font-semibold text-primary hover:text-primary-hover flex items-center gap-1"
                    >
                      {showApiKey ? (
                        <>
                          <RiEyeOffLine /> Ocultar
                        </>
                      ) : (
                        <>
                          <RiEyeLine /> Mostrar
                        </>
                      )}
                    </button>
                  </label>

                  <input
                    type={showApiKey ? "text" : "password"}
                    value={apiKeyDrafts[selectedProvider] ?? ""}
                    onChange={(event) =>
                      setApiKeyDrafts((prev) => ({
                        ...prev,
                        [selectedProvider]: event.target.value,
                      }))
                    }
                    disabled={!encryptionEnabled}
                    placeholder={
                      activeKey.hasApiKey
                        ? `Guardada (••••${activeKey.last4 ?? "????"}) — escribe una nueva para reemplazarla`
                        : isAws
                          ? "Opcional: vacío usa las credenciales del entorno o el rol IAM"
                          : `Introduce la clave de API de ${activeMeta.name}`
                    }
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-slate-400 disabled:bg-slate-50"
                  />

                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] text-slate-400 leading-normal">
                      {isAws
                        ? "Bedrock no usa API keys, sino credenciales de AWS. Déjalas vacías para que el backend use las del entorno o el rol IAM de la máquina."
                        : "La clave se cifra en el servidor y no vuelve a salir de él: aquí solo verás sus últimos 4 caracteres."}
                    </p>
                    {activeKey.hasApiKey && (
                      <button
                        type="button"
                        onClick={handleClearApiKey}
                        disabled={isSaving}
                        className="shrink-0 text-[11px] font-semibold text-danger hover:underline flex items-center gap-1"
                      >
                        <RiDeleteBin6Line /> Borrar clave
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="label-text">Ruta de Endpoint (Endpoint URL)</label>
                <input
                  type="text"
                  value={activeConfig.endpoint ?? ""}
                  onChange={(event) => handleInputChange("endpoint", event.target.value)}
                  placeholder={
                    selectedProvider === "bedrock"
                      ? "Automático según la región de AWS"
                      : "https://api.provider.com/v1"
                  }
                  disabled={selectedProvider === "bedrock"}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-slate-400 disabled:bg-slate-50 disabled:text-slate-400"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="label-text">Región AWS</label>
                  <input
                    type="text"
                    value={activeConfig.region ?? ""}
                    onChange={(event) => handleInputChange("region", event.target.value)}
                    placeholder="us-east-1"
                    disabled={selectedProvider !== "bedrock"}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-slate-400 disabled:bg-slate-50 disabled:text-slate-400"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="label-text">
                    {selectedProvider === "azure" ? "Nombre del Despliegue" : "ID del Modelo"}
                  </label>
                  <input
                    type="text"
                    required
                    value={activeConfig.modelId}
                    onChange={(event) => handleInputChange("modelId", event.target.value)}
                    placeholder="gpt-4o"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-slate-400"
                  />
                </div>
              </div>

              {(selectedProvider === "azure" || selectedProvider === "anthropic") && (
                <div className="space-y-1.5">
                  <label className="label-text">
                    {selectedProvider === "azure"
                      ? "Versión de API (api-version)"
                      : "Versión de API (anthropic-version)"}
                  </label>
                  <input
                    type="text"
                    value={activeConfig.modelVersion ?? ""}
                    onChange={(event) => handleInputChange("modelVersion", event.target.value)}
                    placeholder={
                      selectedProvider === "azure" ? "2024-02-15-preview" : "2023-06-01"
                    }
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-slate-400"
                  />
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2 pt-2">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">Temperatura:</span>
                    <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-800">
                      {activeConfig.temperature}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={activeConfig.temperature}
                    onChange={(event) =>
                      handleInputChange("temperature", Number.parseFloat(event.target.value))
                    }
                    className="w-full accent-primary cursor-pointer"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">Tokens Máximos:</span>
                    <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-800">
                      {activeConfig.maxTokens}
                    </span>
                  </div>
                  <input
                    type="number"
                    min={1}
                    value={activeConfig.maxTokens}
                    onChange={(event) =>
                      handleInputChange("maxTokens", Number.parseInt(event.target.value, 10) || 1)
                    }
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                  />
                </div>
              </div>

              <div className="space-y-4 border-t border-app-border pt-6 mt-6">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Costes de Tokens (USD por Millón)
                </h4>
                <p className="text-xs text-slate-500 leading-normal">
                  Tarifa con la que se calcula el coste de cada run servido por este proveedor. Si la
                  dejas a 0, se usa la tabla de referencia del backend; si el modelo tampoco está
                  ahí, el coste se reporta como 0.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="label-text">Coste Entrada ($/M tokens)</label>
                    <input
                      type="number"
                      step="0.0001"
                      min="0"
                      value={activeConfig.inputCostPerMillion}
                      onChange={(event) =>
                        handleInputChange(
                          "inputCostPerMillion",
                          Number.parseFloat(event.target.value) || 0,
                        )
                      }
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="label-text">Coste Salida ($/M tokens)</label>
                    <input
                      type="number"
                      step="0.0001"
                      min="0"
                      value={activeConfig.outputCostPerMillion}
                      onChange={(event) =>
                        handleInputChange(
                          "outputCostPerMillion",
                          Number.parseFloat(event.target.value) || 0,
                        )
                      }
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4 border-t border-app-border pt-6 mt-6">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Asignación de Roles en la Aplicación
                  </h4>
                  <button
                    type="button"
                    onClick={() =>
                      setRoleMappings({
                        planner: selectedProvider,
                        eval: selectedProvider,
                        quality: selectedProvider,
                        chatbot: selectedProvider,
                      })
                    }
                    className="text-[11px] font-bold text-primary hover:text-primary-hover hover:underline"
                  >
                    Asignar todos los roles
                  </button>
                </div>
                <p className="text-xs text-slate-500 leading-normal">
                  Define qué etapas del pipeline usan este modelo. Solo un proveedor por rol.
                </p>

                <div className="grid gap-3 sm:grid-cols-2">
                  {(Object.keys(ROLE_METADATA) as LlmRole[]).map((role) => {
                    const owner = roleMappings[role];
                    const isMine = owner === selectedProvider;

                    return (
                      <label
                        key={role}
                        className="flex items-start gap-3 rounded-lg border border-app-border bg-slate-50/50 p-3 cursor-pointer hover:bg-slate-100/50 transition"
                      >
                        <input
                          type="checkbox"
                          checked={isMine}
                          onChange={(event) => handleRoleChange(role, event.target.checked)}
                          className="mt-0.5 rounded border-slate-300 text-primary focus:ring-primary h-4 w-4"
                        />
                        <div>
                          <div className="text-xs font-semibold text-slate-800">
                            {ROLE_METADATA[role].label}
                          </div>
                          <div className="text-[10px] text-slate-500 leading-tight">
                            {ROLE_METADATA[role].hint}
                          </div>
                          {owner && !isMine && (
                            <div className="mt-1 text-[10px] font-semibold text-slate-400">
                              Asignado a {PROVIDER_METADATA[owner].name}
                            </div>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 pt-6 border-t border-app-border mt-6">
              <Button
                type="button"
                variant="secondary"
                onClick={runTestConnection}
                disabled={isLoading || testStatus === "testing"}
              >
                {testStatus === "testing" ? (
                  <RiLoader4Line className="animate-spin" />
                ) : (
                  <RiFlashlightLine />
                )}
                Probar Conexión
              </Button>

              <Button type="submit" variant="primary" disabled={isSaving || isLoading}>
                {isSaving ? <RiLoader4Line className="animate-spin" /> : <RiSave2Line />}
                Guardar Configuración
              </Button>
            </div>
          </Card>
        </form>

        <section className="xl:col-span-5 space-y-6">
          <Card title="Prueba de Conexión en Directo">
            {testStatus === "idle" ? (
              <div className="rounded-md border border-dashed border-app-border bg-app-bg px-4 py-20 text-center text-sm text-slate-400">
                Guarda la configuración y pulsa «Probar Conexión»: el backend enviará un prompt real
                al proveedor con las credenciales almacenadas y verás aquí su latencia y sus tokens.
              </div>
            ) : (
              <div className="space-y-6">
                <div className="min-w-0 overflow-hidden rounded-lg border border-app-border bg-slate-950">
                  <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-100">Consola de pruebas</h3>
                      <p className="mt-0.5 font-mono text-xs text-slate-500">
                        respuesta del proveedor
                      </p>
                    </div>
                    {testStatus === "testing" && (
                      <span className="flex items-center gap-2 rounded-full border border-success/20 bg-success/10 px-2.5 py-1">
                        <span
                          className="h-1.5 w-1.5 rounded-full bg-success animate-pulse"
                          aria-hidden="true"
                        />
                        <span className="font-mono text-xs font-medium text-success">
                          conectando
                        </span>
                      </span>
                    )}
                  </header>

                  <pre className="custom-scrollbar max-h-[160px] min-h-[120px] max-w-full overflow-y-auto whitespace-pre-wrap break-all p-4 font-mono text-xs leading-6 text-emerald-400 bg-slate-950">
                    {testLogs || "Esperando respuesta..."}
                  </pre>
                </div>

                <div className="rounded-lg border border-app-border bg-slate-50/50 p-4">
                  <header className="border-b border-app-border pb-3 mb-4">
                    <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <RiTimeLine className="text-base text-slate-400" />
                      Traza de la Conexión
                    </h4>
                  </header>

                  <ol className="relative border-l border-app-border ml-2 pl-4 space-y-4">
                    {testEvents.map((event) => {
                      const isSuccess = event.type === "SUCCESS";
                      const isError = event.type === "ERROR";

                      return (
                        <li key={event.id} className="relative">
                          <span
                            className={`absolute -left-[21px] mt-1 h-2.5 w-2.5 rounded-full ring-4 ring-white ${
                              isSuccess ? "bg-success" : isError ? "bg-danger" : "bg-primary"
                            }`}
                          />

                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-3">
                              <span
                                className={`font-mono text-[10px] font-bold uppercase tracking-wide ${
                                  isSuccess
                                    ? "text-success"
                                    : isError
                                      ? "text-danger"
                                      : "text-slate-500"
                                }`}
                              >
                                {event.type}
                              </span>
                              <time className="text-[10px] font-mono text-slate-400">
                                {event.time.slice(11, 19)}
                              </time>
                            </div>

                            <p
                              className={`mt-0.5 text-xs ${
                                isError ? "text-danger font-semibold" : "text-slate-600"
                              }`}
                            >
                              {event.message}
                            </p>

                            {event.payload && (
                              <pre className="mt-2 max-w-full overflow-x-auto rounded-md bg-slate-900 p-2 font-mono text-[10px] leading-relaxed text-slate-300 border border-white/5">
                                {JSON.stringify(event.payload, null, 2)}
                              </pre>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              </div>
            )}
          </Card>
        </section>
      </div>
    </div>
  );
}

function Banner({
  tone,
  children,
}: {
  tone: "warning" | "danger";
  children: React.ReactNode;
}): JSX.Element {
  const palette =
    tone === "danger"
      ? "border-red-200 bg-red-50 text-red-800"
      : "border-amber-200 bg-amber-50 text-amber-800";

  return (
    <div className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm ${palette}`}>
      <RiAlertLine className="text-lg shrink-0" />
      <div className="flex-1">{children}</div>
    </div>
  );
}

const clock = () => new Date().toLocaleTimeString("es-ES", { hour12: false });

/** Mensaje de error del backend, que es más útil que un "algo ha fallado". */
function extractApiError(error: unknown): string {
  const response = (error as { response?: { data?: { message?: string | string[] } } }).response;
  const message = response?.data?.message;

  if (Array.isArray(message)) return message.join(". ");
  if (typeof message === "string") return message;
  if (error instanceof Error) return error.message;
  return "El servidor no pudo completar la operación.";
}
