/**
 * @fileoverview Panel de configuración de modelos de IA y proveedores (ProviderConfigForm).
 *
 * @module ProviderConfigForm
 */

import type { FormEvent } from "react";
import {
  RiDeleteBin6Line,
  RiEyeLine,
  RiEyeOffLine,
  RiFlashlightLine,
  RiLoader4Line,
  RiSave2Line,
} from "react-icons/ri";
import { Card } from "../../shared/components/ui/Layout";
import { Button } from "../../shared/components/ui/Button";
import type { LlmProviderId, LlmRole } from "../../features/llm/types";
import { PROVIDER_METADATA, ROLE_METADATA, type ProviderForm } from "../llmConfigConstants";
import type { useLlmConfigManagement } from "../hooks/useLlmConfigManagement";

type LlmConfigManagement = ReturnType<typeof useLlmConfigManagement>;

interface ProviderConfigFormProps {
  selectedProvider: LlmProviderId;
  activeConfig: ProviderForm;
  activeMeta: (typeof PROVIDER_METADATA)[LlmProviderId];
  activeKey: { hasApiKey: boolean; last4: string | null };
  needsApiKey: boolean;
  isAws: boolean;
  encryptionEnabled: boolean;
  showApiKey: boolean;
  setShowApiKey: LlmConfigManagement["setShowApiKey"];
  apiKeyDrafts: LlmConfigManagement["apiKeyDrafts"];
  setApiKeyDrafts: LlmConfigManagement["setApiKeyDrafts"];
  roleMappings: LlmConfigManagement["roleMappings"];
  isSaving: boolean;
  isLoading: boolean;
  testStatus: LlmConfigManagement["testStatus"];
  onInputChange: LlmConfigManagement["handleInputChange"];
  onRoleChange: LlmConfigManagement["handleRoleChange"];
  onAssignAllRoles: LlmConfigManagement["assignAllRolesToSelected"];
  onClearApiKey: () => void;
  onTestConnection: () => void;
  onSave: (_event: FormEvent) => void;
}

export function ProviderConfigForm({
  selectedProvider,
  activeConfig,
  activeMeta,
  activeKey,
  needsApiKey,
  isAws,
  encryptionEnabled,
  showApiKey,
  setShowApiKey,
  apiKeyDrafts,
  setApiKeyDrafts,
  roleMappings,
  isSaving,
  isLoading,
  testStatus,
  onInputChange,
  onRoleChange,
  onAssignAllRoles,
  onClearApiKey,
  onTestConnection,
  onSave,
}: ProviderConfigFormProps): JSX.Element {
  return (
    <form onSubmit={onSave} className="xl:col-span-7 space-y-6">
      <Card title={`Parámetros de ${activeMeta.name}`}>
        <div className="space-y-4">
          {isAws && (
            <div className="space-y-1.5">
              <label htmlFor="llm-provider-aws-access-key" className="label-text">Access Key ID (AWS)</label>
              <input
                id="llm-provider-aws-access-key"
                type="text"
                value={activeConfig.awsAccessKeyId ?? ""}
                onChange={(event) => onInputChange("awsAccessKeyId", event.target.value)}
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
                className="input-field"
              />

              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] text-app-text-muted leading-normal">
                  {isAws
                    ? "Bedrock no usa API keys, sino credenciales de AWS. Déjalas vacías para que el backend use las del entorno o el rol IAM de la máquina."
                    : "La clave se cifra en el servidor y no vuelve a salir de él: aquí solo verás sus últimos 4 caracteres."}
                </p>
                {activeKey.hasApiKey && (
                  <button
                    type="button"
                    onClick={onClearApiKey}
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
            <label htmlFor="llm-provider-endpoint" className="label-text">Ruta de Endpoint (Endpoint URL)</label>
            <input
              id="llm-provider-endpoint"
              type="text"
              value={activeConfig.endpoint ?? ""}
              onChange={(event) => onInputChange("endpoint", event.target.value)}
              placeholder={
                selectedProvider === "bedrock"
                  ? "Automático según la región de AWS"
                  : "https://api.provider.com/v1"
              }
              disabled={selectedProvider === "bedrock"}
              className="input-field"
            />
          </div>

          <div className={`grid gap-4 ${isAws ? "sm:grid-cols-2" : ""}`}>
            {isAws && (
              <div className="space-y-1.5">
                <label htmlFor="llm-provider-region" className="label-text">Región AWS</label>
                <input
                  id="llm-provider-region"
                  type="text"
                  value={activeConfig.region ?? ""}
                  onChange={(event) => onInputChange("region", event.target.value)}
                  placeholder="us-east-1"
                  className="input-field"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="label-text">
                {selectedProvider === "azure" ? "Nombre del Despliegue" : "ID del Modelo"}
              </label>
              <input
                type="text"
                required
                value={activeConfig.modelId}
                onChange={(event) => onInputChange("modelId", event.target.value)}
                placeholder="gpt-4o"
                className="input-field"
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
                onChange={(event) => onInputChange("modelVersion", event.target.value)}
                placeholder={selectedProvider === "azure" ? "2024-02-15-preview" : "2023-06-01"}
                className="input-field"
              />
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 pt-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-app-text-secondary">Temperatura:</span>
                <span className="font-mono bg-app-bg-subtle px-1.5 py-0.5 rounded text-app-text">
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
                  onInputChange("temperature", Number.parseFloat(event.target.value))
                }
                className="w-full accent-primary cursor-pointer"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-app-text-secondary">Tokens Máximos:</span>
                <span className="font-mono bg-app-bg-subtle px-1.5 py-0.5 rounded text-app-text">
                  {activeConfig.maxTokens}
                </span>
              </div>
              <input
                type="number"
                min={1}
                value={activeConfig.maxTokens}
                onChange={(event) =>
                  onInputChange("maxTokens", Number.parseInt(event.target.value, 10) || 1)
                }
                className="input-field"
              />
            </div>
          </div>

          <div className="space-y-4 border-t border-app-border pt-6 mt-6">
            <h4 className="text-xs font-bold text-app-text-secondary uppercase tracking-wider">
              Costes de Tokens (USD por Millón)
            </h4>
            <p className="text-xs text-app-text-muted leading-normal">
              Tarifa con la que se calcula el coste de cada run servido por este proveedor. Si la
              dejas a 0, se usa la tabla de referencia del backend; si el modelo tampoco está
              ahí, el coste se reporta como 0.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="llm-provider-input-cost" className="label-text">Coste Entrada ($/M tokens)</label>
                <input
                  id="llm-provider-input-cost"
                  type="number"
                  step="0.0001"
                  min="0"
                  value={activeConfig.inputCostPerMillion}
                  onChange={(event) =>
                    onInputChange(
                      "inputCostPerMillion",
                      Number.parseFloat(event.target.value) || 0,
                    )
                  }
                  className="input-field font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="llm-provider-output-cost" className="label-text">Coste Salida ($/M tokens)</label>
                <input
                  id="llm-provider-output-cost"
                  type="number"
                  step="0.0001"
                  min="0"
                  value={activeConfig.outputCostPerMillion}
                  onChange={(event) =>
                    onInputChange(
                      "outputCostPerMillion",
                      Number.parseFloat(event.target.value) || 0,
                    )
                  }
                  className="input-field font-mono"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4 border-t border-app-border pt-6 mt-6">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-app-text-secondary uppercase tracking-wider">
                Asignación de Roles en la Aplicación
              </h4>
              <button
                type="button"
                onClick={onAssignAllRoles}
                className="text-[11px] font-bold text-primary hover:text-primary-hover hover:underline"
              >
                Asignar todos los roles
              </button>
            </div>
            <p className="text-xs text-app-text-muted leading-normal">
              Define qué etapas del pipeline usan este modelo. Solo un proveedor por rol.
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              {(Object.keys(ROLE_METADATA) as LlmRole[]).map((role) => {
                const owner = roleMappings[role];
                const isMine = owner === selectedProvider;

                return (
                  <label
                    key={role}
                    className="flex items-start gap-3 rounded-lg border border-app-border bg-app-bg-subtle/50 p-3 cursor-pointer hover:bg-app-bg-subtle transition"
                  >
                    <input
                      type="checkbox"
                      checked={isMine}
                      onChange={(event) => onRoleChange(role, event.target.checked)}
                      className="mt-0.5 rounded border-slate-300 text-primary focus:ring-primary h-4 w-4"
                    />
                    <div>
                      <div className="text-xs font-semibold text-app-text-secondary">
                        {ROLE_METADATA[role].label}
                      </div>
                      <div className="text-[10px] text-app-text-muted leading-tight">
                        {ROLE_METADATA[role].hint}
                      </div>
                      {owner && !isMine && (
                        <div className="mt-1 text-[10px] font-semibold text-app-text-muted">
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
            onClick={onTestConnection}
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
  );
}
