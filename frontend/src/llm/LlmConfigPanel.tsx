import { RiCpuLine } from "react-icons/ri";
import { PageHeader } from "../shared/components/ui/PageHeader";
import { Banner } from "./components/Banner";
import { ProviderSelector } from "./components/ProviderSelector";
import { ProviderConfigForm } from "./components/ProviderConfigForm";
import { ConnectionTestPanel } from "./components/ConnectionTestPanel";
import { ROLE_METADATA } from "./llmConfigConstants";
import { useLlmConfigManagement } from "./hooks/useLlmConfigManagement";

export function LlmConfigPanel(): JSX.Element {
  const llm = useLlmConfigManagement();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Modelos de IA"
        subtitle="Configura las credenciales y perfiles de los proveedores de modelos de lenguaje que sirven cada etapa del pipeline."
        icon={<RiCpuLine />}
      />

      {!llm.encryptionEnabled && (
        <Banner tone="danger">
          <span className="font-semibold">Claves deshabilitadas:</span> falta la variable de entorno{" "}
          <code className="font-mono">LLM_CREDENTIALS_SECRET</code> en el servidor, así que no se
          pueden guardar claves de API. Bedrock y Ollama siguen funcionando (no la necesitan).
        </Banner>
      )}

      {llm.unassignedRoles.length > 0 && (
        <Banner tone="warning">
          <span className="font-semibold">Atención:</span> sin proveedor asignado en{" "}
          {llm.unassignedRoles.map((role) => ROLE_METADATA[role].label).join(", ")}. Esas etapas usarán
          el modelo de Bedrock definido por variables de entorno.
        </Banner>
      )}

      <ProviderSelector
        selectedProvider={llm.selectedProvider}
        roleMappings={llm.roleMappings}
        onSelect={llm.setSelectedProvider}
      />

      <div className="grid gap-6 xl:grid-cols-12">
        <ProviderConfigForm
          selectedProvider={llm.selectedProvider}
          activeConfig={llm.activeConfig}
          activeMeta={llm.activeMeta}
          activeKey={llm.activeKey}
          needsApiKey={llm.needsApiKey}
          isAws={llm.isAws}
          encryptionEnabled={llm.encryptionEnabled}
          showApiKey={llm.showApiKey}
          setShowApiKey={llm.setShowApiKey}
          apiKeyDrafts={llm.apiKeyDrafts}
          setApiKeyDrafts={llm.setApiKeyDrafts}
          roleMappings={llm.roleMappings}
          isSaving={llm.isSaving}
          isLoading={llm.isLoading}
          testStatus={llm.testStatus}
          onInputChange={llm.handleInputChange}
          onRoleChange={llm.handleRoleChange}
          onAssignAllRoles={llm.assignAllRolesToSelected}
          onClearApiKey={() => void llm.handleClearApiKey()}
          onTestConnection={() => void llm.runTestConnection()}
          onSave={(event) => void llm.handleSave(event)}
        />

        <section className="xl:col-span-5 space-y-6">
          <ConnectionTestPanel
            testStatus={llm.testStatus}
            testLogs={llm.testLogs}
            testEvents={llm.testEvents}
          />
        </section>
      </div>
    </div>
  );
}
