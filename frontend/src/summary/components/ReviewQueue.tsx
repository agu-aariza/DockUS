import { RiArrowRightLine, RiCheckboxCircleLine, RiShieldCheckLine } from "react-icons/ri";
import type { DeliveryEntity } from "../../features/deliveries/types";
import { Button } from "../../shared/components/ui/Button";
import { EmptyState } from "../../shared/components/EmptyState";
import { formatAge } from "../../shared/utils/format";

interface ReviewQueueProps {
  pending: DeliveryEntity[];
  evaluated: DeliveryEntity[];
  pendingTotal: number;
  onOpenDelivery: (_delivery: DeliveryEntity) => void;
  onSeeAll: () => void;
}

/**
 * La cola de trabajo del profesor: lo que espera revisión, ordenado por antigüedad.
 * Es la razón por la que se abre este panel, así que ocupa la columna principal.
 */
export function ReviewQueue({
  pending,
  evaluated,
  pendingTotal,
  onOpenDelivery,
  onSeeAll,
}: ReviewQueueProps): JSX.Element {
  const isEmpty = pending.length === 0 && evaluated.length === 0;

  return (
    <section className="rounded-lg border border-app-border bg-white">
      <header className="flex items-center justify-between border-b border-app-border px-5 py-4">
        <div>
          <div className="accent-rule mb-2" aria-hidden="true" />
          <h2 className="text-base font-semibold tracking-tight text-slate-900">
            Cola de revisión
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">
            {pendingTotal > 0
              ? `${pendingTotal} entregas esperan tu revisión.`
              : "Ninguna entrega espera revisión."}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onSeeAll}>
          Ver entregas
          <RiArrowRightLine />
        </Button>
      </header>

      {isEmpty ? (
        <div className="p-5">
          <EmptyState
            icon={<RiShieldCheckLine className="text-2xl text-success" />}
            title="Todo al día"
            description="No hay entregas pendientes ni evaluaciones recientes. Las nuevas entregas aparecerán aquí en cuanto los alumnos las suban."
          />
        </div>
      ) : (
        <>
          <ul className="divide-y divide-app-border">
            {pending.map((delivery) => (
              <li key={delivery.id}>
                <QueueRow delivery={delivery} onOpen={onOpenDelivery} />
              </li>
            ))}
          </ul>

          {evaluated.length > 0 && (
            <div className="border-t border-app-border bg-app-bg-subtle/60 px-5 py-4">
              <div className="ui-label mb-3 flex items-center gap-1.5">
                <RiCheckboxCircleLine className="text-sm text-success" />
                Evaluadas recientemente
              </div>
              <ul className="space-y-1">
                {evaluated.map((delivery) => (
                  <li key={delivery.id}>
                    <EvaluatedRow delivery={delivery} onOpen={onOpenDelivery} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function QueueRow({
  delivery,
  onOpen,
}: {
  delivery: DeliveryEntity;
  onOpen: (_delivery: DeliveryEntity) => void;
}): JSX.Element {
  return (
    <button
      onClick={() => onOpen(delivery)}
      className="group relative flex w-full items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-app-bg-subtle"
    >
      {/* El filete vino sustituye al cambio de color de texto: marca la fila sin repintarla. */}
      <span
        className="absolute inset-y-0 left-0 w-0.5 scale-y-0 bg-accent transition-transform duration-[--motion-standard] ease-[--motion-ease-out] group-hover:scale-y-100"
        aria-hidden="true"
      />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900">
          {delivery.studentName || delivery.studentEmail}
        </p>
        <p className="truncate text-sm text-slate-500">{delivery.projectTitle}</p>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        {delivery.isLate && (
          <span className="rounded-full bg-warning-subtle px-2 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wide text-warning">
            tarde
          </span>
        )}
        <span className="data-meta text-slate-400">v{delivery.version}</span>
        <span className="data-meta w-14 text-right">{formatAge(delivery.createdAt)}</span>
        <RiArrowRightLine className="text-slate-300 transition-transform duration-[--motion-standard] group-hover:translate-x-0.5 group-hover:text-accent" />
      </div>
    </button>
  );
}

function EvaluatedRow({
  delivery,
  onOpen,
}: {
  delivery: DeliveryEntity;
  onOpen: (_delivery: DeliveryEntity) => void;
}): JSX.Element {
  const grade = delivery.grade;

  return (
    <button
      onClick={() => onOpen(delivery)}
      className="group flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-white"
    >
      <span className="min-w-0 flex-1 truncate text-sm text-slate-600">
        {delivery.studentName || delivery.studentEmail}
      </span>
      <span className="data-meta shrink-0 text-slate-400">v{delivery.version}</span>
      <span
        className={`data-figure w-10 shrink-0 text-right text-sm font-semibold ${
          grade === null ? "text-slate-400" : grade >= 5 ? "text-success" : "text-danger"
        }`}
      >
        {grade === null ? "—" : grade.toFixed(1)}
      </span>
    </button>
  );
}
