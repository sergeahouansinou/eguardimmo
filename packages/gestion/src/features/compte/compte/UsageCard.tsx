import { SettingsCard } from '../shared/SettingRow';
import { planOf } from './plans';
import type { Plan } from './plans';
import type { Subscription } from './schemas';

function UsageRow({ label, used, limit, text, warnAt = 80 }: { label: string; used: number; limit: number | null; text: string; warnAt?: number }) {
  const share = limit === null || limit === 0 ? 0 : Math.round((used / limit) * 100);
  return (
    <li className="flex flex-col gap-1 border-t border-line py-2 first:border-t-0">
      <div className="flex justify-between text-body text-fg-muted">
        <span>{label}</span>
        <b className="font-semibold text-fg tabular-nums">{text}</b>
      </div>
      {limit === null ? null : (
        <div role="img" aria-label={`${String(share)} % utilisé`} className="h-1.5 overflow-hidden rounded-full bg-muted">
          <span className={share >= warnAt ? 'block h-full bg-warning-line' : 'block h-full bg-action'} style={{ width: `${String(Math.min(100, share))}%` }} />
        </div>
      )}
    </li>
  );
}

function gigabytes(mb: number): string {
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(mb / 1000)} Go`;
}

export function UsageCard({ subscription, plan = planOf(subscription.planId) }: { subscription: Subscription; plan?: Plan }) {
  const { usage } = subscription;
  const { limits } = plan;
  const of = (used: number, limit: number | null) => `${String(used)} / ${limit === null ? 'illimité' : String(limit)}`;
  return (
    <SettingsCard id="ab-use" title="Utilisation">
      <ul>
        <UsageRow label="Lots" used={usage.lots} limit={limits.lots} text={of(usage.lots, limits.lots)} />
        <UsageRow label="Utilisateurs" used={usage.users} limit={limits.users} text={of(usage.users, limits.users)} />
        <UsageRow label="Signatures ce mois" used={usage.signatures} limit={limits.signatures} text={of(usage.signatures, limits.signatures)} />
        <UsageRow label="Stockage" used={usage.storageMb} limit={limits.storageMb} text={`${gigabytes(usage.storageMb)} / ${gigabytes(limits.storageMb)}`} />
      </ul>
    </SettingsCard>
  );
}
