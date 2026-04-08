import type { StreamState } from "../hooks/useBuilderRunStream";

interface BuilderControlCardProps {
  deliveryId: string;
  canUseBuilder: boolean;
  busyAction: string | null;
  streamState: StreamState;
  latestSequence: number;
  onDeliveryIdChange: (value: string) => void;
  onStartRun: () => void;
  onLoadRuns: () => void;
}

export function BuilderControlCard({
  deliveryId,
  canUseBuilder,
  busyAction,
  streamState,
  latestSequence,
  onDeliveryIdChange,
  onStartRun,
  onLoadRuns,
}: BuilderControlCardProps): JSX.Element {
  return (
    <article className="card stack">
      <h3>Control</h3>
      <div className="grid two-col">
        <label>
          Delivery ID
          <input
            value={deliveryId}
            onChange={(event) => onDeliveryIdChange(event.target.value)}
            placeholder="uuid de entrega"
          />
        </label>
        <label>
          Estado del stream
          <input value={`${streamState} · seq ${latestSequence}`} readOnly />
        </label>
      </div>
      <div className="row gap-8">
        <button
          className="btn"
          disabled={!canUseBuilder || busyAction === "run"}
          onClick={onStartRun}
        >
          Ejecutar delivery
        </button>
        <button className="btn ghost" disabled={!canUseBuilder} onClick={onLoadRuns}>
          Cargar historial
        </button>
      </div>
    </article>
  );
}
