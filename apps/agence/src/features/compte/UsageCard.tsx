import { Card, CardHeader, CardTitle, ProgressBar } from "@eguardimmo/ui";
import { formatStorage, percentOf } from "./subscriptionFormat";
import type { SubscriptionView } from "./subscriptionSchemas";

function UsageLine({ label, value, percent }: { label: string; value: string; percent: number }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2 text-body">
        <span className="text-fg-muted">{label}</span>
        <b className="text-fg tabular-nums">{value}</b>
      </div>
      <ProgressBar value={percent} label={`${String(percent)} % utilisé`} />
    </div>
  );
}

export function UsageCard({ usage }: { usage: SubscriptionView["usage"] }) {
  return (
    <Card role="region" aria-label="Utilisation">
      <CardHeader>
        <CardTitle as="h2">Utilisation</CardTitle>
      </CardHeader>
      <UsageLine label="Lots" value={`${String(usage.lots.used)} / ${String(usage.lots.limit)}`} percent={percentOf(usage.lots.used, usage.lots.limit)} />
      <UsageLine
        label="Collaborateurs"
        value={`${String(usage.seats.used)} / ${String(usage.seats.limit)}`}
        percent={percentOf(usage.seats.used, usage.seats.limit)}
      />
      <UsageLine
        label="Stockage"
        value={`${formatStorage(usage.storage.usedMb)} / ${formatStorage(usage.storage.limitMb)}`}
        percent={percentOf(usage.storage.usedMb, usage.storage.limitMb)}
      />
    </Card>
  );
}
