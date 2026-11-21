import { Card, CardHeader, CardTitle, ProgressBar } from "@eguardimmo/ui";
import { formatStorage, percentOf } from "./subscriptionFormat";
import type { SubscriptionView } from "./subscriptionSchemas";

function UsageLine({ label, value, percent }: { label: string; value: string; percent: number | null }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2 text-body">
        <span className="text-fg-muted">{label}</span>
        <b className="text-fg tabular-nums">{value}</b>
      </div>
      {percent === null ? null : <ProgressBar value={percent} label={`${String(percent)} % utilisé`} />}
    </div>
  );
}

function limitedUsage(used: number, limit: number | null, unlimited: string): { value: string; percent: number | null } {
  if (limit === null) return { value: `${String(used)} / ${unlimited}`, percent: null };
  return { value: `${String(used)} / ${String(limit)}`, percent: percentOf(used, limit) };
}

export function UsageCard({ usage }: { usage: SubscriptionView["usage"] }) {
  const lots = limitedUsage(usage.lots.used, usage.lots.limit, "illimité");
  const seats = limitedUsage(usage.seats.used, usage.seats.limit, "selon le plan");
  return (
    <Card role="region" aria-label="Utilisation">
      <CardHeader>
        <CardTitle as="h2">Utilisation</CardTitle>
      </CardHeader>
      <UsageLine label="Lots" value={lots.value} percent={lots.percent} />
      <UsageLine label="Collaborateurs" value={seats.value} percent={seats.percent} />
      <UsageLine
        label="Stockage"
        value={`${formatStorage(usage.storage.usedMb)} / ${formatStorage(usage.storage.limitMb)}`}
        percent={percentOf(usage.storage.usedMb, usage.storage.limitMb)}
      />
    </Card>
  );
}
