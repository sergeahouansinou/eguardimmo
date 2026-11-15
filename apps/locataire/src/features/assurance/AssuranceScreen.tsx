'use client';

import { Alert, Button, Icon, StatCard } from '@eguardimmo/ui';
import { Bell, Download, ShieldCheck, Upload } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { Async2 } from '@/components/ScreenState';
import { EmptyLine, KeyValueList, ListRow, SectionCard } from '@/components/Section';
import { StatusBadge } from '@/components/StatusBadge';
import { useAttestations, useHome } from '@/data/queries';
import type { Attestation } from '@/data/schemas/logement';
import { addDays, formatDate, plural } from '@/lib/dates';
import { downloadDemoPdf } from '@eguardimmo/shell';
import { insuranceView, periodStatus } from './insurance';
import type { InsuranceView } from './insurance';

const BADGES: Record<InsuranceView['status'], { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' }> = {
  valide: { label: 'Valide', tone: 'success' },
  a_renouveler: { label: 'À renouveler', tone: 'warning' },
  expiree: { label: 'Expirée', tone: 'danger' },
  aucune: { label: 'Aucune attestation', tone: 'neutral' },
};

const PERIOD_BADGES = {
  en_vigueur: { label: 'En vigueur', tone: 'success' },
  a_venir: { label: 'À venir', tone: 'info' },
  expiree: { label: 'Expirée', tone: 'neutral' },
} as const;

export function AssuranceScreen() {
  const attestations = useAttestations();
  const home = useHome();
  return (
    <Async2 a={attestations} b={home} errorTitle="Votre assurance n’a pas pu être chargée">
      {(items, homeData) => <AssuranceContent items={items} today={homeData.today} />}
    </Async2>
  );
}

function AssuranceContent({ items, today }: { items: Attestation[]; today: string }) {
  const view = insuranceView(items, today);
  const badge = BADGES[view.status];
  const { current } = view;
  const history = [...items].sort((a, b) => b.endOn.localeCompare(a.endOn));
  const download = (item: Attestation) => {
    downloadDemoPdf(`${item.id}.pdf`, `Attestation d'assurance habitation`, [`${item.insurer} - ${item.contractNumber}`, `${formatDate(item.startOn)} au ${formatDate(item.endOn)}`]);
  };
  return (
    <>
      <PageHeader
        title="Assurance habitation"
        crumbs={[{ label: 'Échanges' }, { label: 'Assurance' }]}
        badge={<StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>}
        subtitle={current ? `Attestation valable jusqu'au ${formatDate(current.endOn)}.` : 'Aucune attestation en cours de validité.'}
        actions={
          <>
            {current ? (
              <Button variant="secondary" onClick={() => { download(current); }}>
                <Icon icon={Download} />
                Télécharger l’attestation
              </Button>
            ) : null}
            <Button asChild>
              <Link href="/assurance/deposer">
                <Icon icon={Upload} />
                Déposer une attestation
              </Link>
            </Button>
          </>
        }
      />
      {current && view.status === 'a_renouveler' && view.daysLeft !== null ? (
        <Alert tone="warning" title={`Attestation à renouveler avant le ${formatDate(current.endOn)}`}>
          Il reste {plural(view.daysLeft, 'jour', 'jours')}. Déposez la nouvelle attestation dès que votre assureur l’a émise.
        </Alert>
      ) : null}
      {!current ? (
        <Alert tone="danger" title="Aucune attestation valide">
          Votre bail exige une assurance habitation : déposez une attestation en cours de validité.
        </Alert>
      ) : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Statut" value={current ? 'Valide' : 'Aucune'}>
          <span className="text-caption text-fg-subtle">{current ? `Déposée le ${formatDate(current.depositedOn)}` : 'À déposer'}</span>
        </StatCard>
        <StatCard label="Échéance" value={current ? formatDate(current.endOn) : '—'}>
          <span className="text-caption text-fg-subtle">{view.daysLeft !== null ? `Dans ${plural(view.daysLeft, 'jour', 'jours')}` : '—'}</span>
        </StatCard>
        <StatCard label="Assureur" value={current?.insurer ?? '—'}>
          <span className="text-caption text-fg-subtle">Multirisque habitation</span>
        </StatCard>
        <StatCard label="N° de contrat" value={current?.contractNumber ?? '—'}>
          <span className="text-caption text-fg-subtle">
            {current ? `Période ${current.startOn.slice(0, 4)}-${current.endOn.slice(0, 4)}` : '—'}
          </span>
        </StatCard>
      </div>
      {current ? (
        <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <SectionCard id="as-courante" title="Attestation en cours">
            <div className="grid grid-cols-1 gap-x-6 gap-y-2 md:grid-cols-2">
              <KeyValueList
                labelWidth="6.5rem"
                items={[
                  { label: 'Assureur', value: current.insurer },
                  { label: 'N° de contrat', value: current.contractNumber },
                  { label: 'Début', value: formatDate(current.startOn) },
                ]}
              />
              <KeyValueList
                labelWidth="6.5rem"
                items={[
                  { label: 'Fin', value: formatDate(current.endOn) },
                  { label: 'Garanties', value: current.guarantees },
                  { label: 'Déposée le', value: formatDate(current.depositedOn) },
                ]}
              />
            </div>
          </SectionCard>
          <SectionCard id="as-rappels" title="Rappels">
            <ul>
              <ListRow icon={Bell} title="Premier rappel" detail={`${formatDate(addDays(current.endOn, -30))} · e-mail et notification`} />
              <ListRow icon={Bell} title="Second rappel" detail={`${formatDate(addDays(current.endOn, -6))} · e-mail et notification`} />
            </ul>
          </SectionCard>
        </div>
      ) : null}
      <SectionCard id="as-historique" title="Attestations déposées">
        {history.length === 0 ? (
          <EmptyLine>Aucune attestation déposée.</EmptyLine>
        ) : (
          <ul>
            {history.map((item) => {
              const status = PERIOD_BADGES[periodStatus(item, today)];
              return (
                <ListRow
                  key={item.id}
                  icon={ShieldCheck}
                  tone={status.tone}
                  title={item.label}
                  detail={`Déposée le ${formatDate(item.depositedOn)} · ${item.insurer}`}
                  trailing={
                    <>
                      <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                      <Button size="sm" variant="ghost" aria-label={`Télécharger ${item.label}`} onClick={() => { download(item); }}>
                        Télécharger
                      </Button>
                    </>
                  }
                />
              );
            })}
          </ul>
        )}
      </SectionCard>
    </>
  );
}
