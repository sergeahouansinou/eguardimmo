import { CalendarClock, ChartPie, Mail, TriangleAlert } from 'lucide-react';
import { StatCard } from '@eguardimmo/ui';
import type { CampaignStats } from '../model';

export function StatsRow({ stats }: { stats: CampaignStats }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label="Envoyées ce mois" value={stats.thisMonth} icon={Mail} />
      <StatCard label="Programmées" value={stats.scheduled} icon={CalendarClock} />
      <StatCard label="Taux de lecture" value={stats.readRatePercent === null ? '—' : `${String(stats.readRatePercent)} %`} icon={ChartPie}>
        <span className="text-caption text-fg-subtle">{`${String(stats.readCount)} lus sur ${String(stats.sentCount)} envois`}</span>
      </StatCard>
      <StatCard label="Échecs d’envoi" value={stats.failures} icon={TriangleAlert} tone={stats.failures > 0 ? 'danger' : 'default'} />
    </div>
  );
}
