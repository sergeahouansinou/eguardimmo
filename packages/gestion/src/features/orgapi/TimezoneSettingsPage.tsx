'use client';

import { Alert, Button, Card, Select } from '@eguardimmo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { LinkButton, PageHeader, useNotify } from '../locataires/kit';
import { links } from '../locataires/kit/links';
import { ActionError } from './ActionError';
import { QueryState } from './QueryState';
import { ORG_ROOT, useOrgTimezone, useUpdateTimezone } from './hooks';
import { useOrgInfoSource } from './source';
import { formatDateTimeFr, listTimeZones, zoneLabel } from './zone';

const CRUMBS = [{ label: 'Accueil', href: links.home }, { label: 'Réglages' }, { label: 'Fuseau horaire' }] as const;

export function TimezoneSettingsPage() {
  const { role } = useOrgInfoSource();
  const timezone = useOrgTimezone();
  const client = useQueryClient();
  let body;
  if (role !== 'owner' && role !== 'admin') {
    body = <Alert tone="info" title="Accès refusé">Seuls le propriétaire et les administrateurs de l’organisation peuvent modifier le fuseau horaire.</Alert>;
  } else if (timezone.data === undefined) {
    body = <QueryState query={timezone} label="Chargement du fuseau horaire" title="Impossible de charger le fuseau horaire" onRetry={() => { void client.invalidateQueries({ queryKey: ORG_ROOT }); }} />;
  } else {
    body = <TimezoneForm current={timezone.data} />;
  }
  return (
    <>
      <PageHeader crumbs={CRUMBS} title="Fuseau horaire" subtitle="Les dates et heures de l’agenda sont affichées dans le fuseau de l’organisation." />
      {body}
    </>
  );
}

function TimezoneForm({ current }: { current: string }) {
  const [selected, setSelected] = useState(current);
  const [failure, setFailure] = useState<unknown>(null);
  const update = useUpdateTimezone();
  const notify = useNotify();
  const options = useMemo(() => [...new Set([current, ...listTimeZones()])].sort().map((zone) => ({ value: zone, label: zone.replaceAll('_', ' ') })), [current]);

  const save = async () => {
    setFailure(null);
    try {
      const saved = await update.mutateAsync(selected);
      setSelected(saved);
      notify({ title: 'Fuseau horaire enregistré', description: zoneLabel(saved) });
    } catch (error) {
      setFailure(error);
    }
  };

  return (
    <Card role="region" aria-label="Fuseau horaire de l’organisation" className="gap-4">
      <form noValidate className="flex max-w-md flex-col gap-4" onSubmit={(event) => { event.preventDefault(); void save(); }}>
        <Select label="Fuseau horaire *" placeholder="Choisissez un fuseau" options={options} value={selected} onValueChange={setSelected} searchable hint={`Il est actuellement ${formatDateTimeFr(new Date().toISOString(), selected)} dans ce fuseau.`} />
        {failure === null ? null : <ActionError title="Fuseau horaire non enregistré" error={failure} />}
        <div className="flex flex-wrap justify-end gap-2">
          <LinkButton href={links.agenda} variant="ghost">Retour à l’agenda</LinkButton>
          <Button type="submit" loading={update.isPending} disabled={selected === current}>Enregistrer</Button>
        </div>
      </form>
    </Card>
  );
}
