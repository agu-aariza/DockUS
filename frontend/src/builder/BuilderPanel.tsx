import { useEffect, useState } from "react";
import { builderApi } from "../shared/api/builderApi";
import { JsonResult } from "../shared/components/JsonResult";
import type {
  BuildRunComparisonResponse,
  BuildRunEntity,
  PaginatedResponse,
  SessionRecord,
} from "../shared/types";
import { getErrorMessage } from "../shared/utils/errors";
import { BuilderComparisonPane } from "./components/BuilderComparisonPane";
import { BuilderControlCard } from "./components/BuilderControlCard";
import { BuilderLiveRunPane } from "./components/BuilderLiveRunPane";
import { BuilderReproducibilityPane } from "./components/BuilderReproducibilityPane";
import { BuilderRunsTable } from "./components/BuilderRunsTable";
import { useBuilderRunStream } from "./hooks/useBuilderRunStream";

interface BuilderPanelProps {
  session: SessionRecord | null;
}

export function BuilderPanel({ session }: BuilderPanelProps): JSX.Element {
  const [deliveryId, setDeliveryId] = useState("");
  const [runsResponse, setRunsResponse] =
    useState<PaginatedResponse<BuildRunEntity> | null>(null);
  const [selectedRunId, setSelectedRunId] = useState("");
  const [selectedRun, setSelectedRun] = useState<BuildRunEntity | null>(null);
  const [compareBaseId, setCompareBaseId] = useState("");
  const [compareCandidateId, setCompareCandidateId] = useState("");
  const [comparison, setComparison] =
    useState<BuildRunComparisonResponse | null>(null);
  const [message, setMessage] = useState("");
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const { events, streamState, streamError, latestSequence } =
    useBuilderRunStream(selectedRunId, session);

  const canUseBuilder = Boolean(session);
  const runs = runsResponse?.data ?? [];
  const liveEvents = [...events].slice(-40).reverse();

  const showError = (error: unknown) => setMessage(getErrorMessage(error));

  const loadRuns = async () => {
    if (!deliveryId.trim() || !canUseBuilder) {
      return;
    }
    setMessage("");
    try {
      const response = await builderApi.listByDelivery({
        deliveryId: deliveryId.trim(),
        page: 1,
        limit: 20,
      });
      setRunsResponse(response);
      if (!selectedRunId && response.data[0]) {
        setSelectedRunId(response.data[0].id);
      }
    } catch (error) {
      showError(error);
    }
  };

  const loadRunDetail = async (buildRunId: string) => {
    if (!buildRunId.trim() || !canUseBuilder) {
      return;
    }
    try {
      const response = await builderApi.detail(buildRunId.trim());
      setSelectedRun(response);
    } catch (error) {
      showError(error);
    }
  };

  useEffect(() => {
    if (!selectedRunId || !canUseBuilder) {
      setSelectedRun(null);
      return;
    }

    let disposed = false;
    const sync = async () => {
      const response = await builderApi.detail(selectedRunId);
      if (!disposed) {
        setSelectedRun(response);
      }
    };

    void sync().catch(showError);
    const interval = window.setInterval(() => {
      void sync().catch(showError);
    }, 3000);

    return () => {
      disposed = true;
      window.clearInterval(interval);
    };
  }, [selectedRunId, canUseBuilder]);

  const handleStartRun = async () => {
    if (!deliveryId.trim() || !canUseBuilder) {
      return;
    }
    setBusyAction("run");
    setMessage("");
    try {
      const response = await builderApi.runForDelivery(deliveryId.trim());
      setSelectedRunId(response.buildRunId);
      setMessage(`Run encolado: ${response.buildRunId}`);
      await loadRuns();
      await loadRunDetail(response.buildRunId);
    } catch (error) {
      showError(error);
    } finally {
      setBusyAction(null);
    }
  };

  const handleReplay = async (buildRunId: string) => {
    if (!canUseBuilder) {
      return;
    }
    setBusyAction(`replay:${buildRunId}`);
    setMessage("");
    try {
      const response = await builderApi.replay(buildRunId);
      setSelectedRunId(response.buildRunId);
      setMessage(`Frozen replay encolado: ${response.buildRunId}`);
      await loadRuns();
      await loadRunDetail(response.buildRunId);
    } catch (error) {
      showError(error);
    } finally {
      setBusyAction(null);
    }
  };

  const handleCancel = async () => {
    if (!selectedRunId || !canUseBuilder) {
      return;
    }
    setBusyAction("cancel");
    setMessage("");
    try {
      await builderApi.cancel(selectedRunId);
      setMessage("Run cancelado.");
      await loadRunDetail(selectedRunId);
      await loadRuns();
    } catch (error) {
      showError(error);
    } finally {
      setBusyAction(null);
    }
  };

  const handleCompare = async () => {
    if (!compareBaseId || !compareCandidateId || !canUseBuilder) {
      return;
    }
    setBusyAction("compare");
    setMessage("");
    try {
      const response = await builderApi.compareRuns(
        compareBaseId,
        compareCandidateId,
      );
      setComparison(response);
    } catch (error) {
      showError(error);
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <section className="stack">
      <header className="panel-header">
        <h2>Builder</h2>
        <p>Observabilidad en vivo, comparador técnico y frozen replay.</p>
      </header>

      {message ? <p className="message info">{message}</p> : null}
      {streamError ? <p className="message warning">{streamError}</p> : null}

      <BuilderControlCard
        deliveryId={deliveryId}
        canUseBuilder={canUseBuilder}
        busyAction={busyAction}
        streamState={streamState}
        latestSequence={latestSequence}
        onDeliveryIdChange={setDeliveryId}
        onStartRun={() => {
          void handleStartRun();
        }}
        onLoadRuns={() => {
          void loadRuns();
        }}
      />

      <BuilderRunsTable
        runs={runs}
        busyAction={busyAction}
        onSelectRun={setSelectedRunId}
        onSelectBase={setCompareBaseId}
        onSelectCandidate={setCompareCandidateId}
        onReplay={(runId) => {
          void handleReplay(runId);
        }}
      />

      <BuilderLiveRunPane
        selectedRun={selectedRun}
        liveEvents={liveEvents}
        streamState={streamState}
        busyAction={busyAction}
        onRefresh={() => {
          if (selectedRunId) {
            void loadRunDetail(selectedRunId);
          }
        }}
        onCancel={() => {
          void handleCancel();
        }}
      />

      <BuilderComparisonPane
        runs={runs}
        compareBaseId={compareBaseId}
        compareCandidateId={compareCandidateId}
        comparison={comparison}
        busyAction={busyAction}
        onBaseChange={setCompareBaseId}
        onCandidateChange={setCompareCandidateId}
        onCompare={() => {
          void handleCompare();
        }}
      />

      <BuilderReproducibilityPane selectedRun={selectedRun} />

      <JsonResult
        title="Run seleccionado"
        value={selectedRun ?? { message: "Sin run seleccionado." }}
      />
    </section>
  );
}
