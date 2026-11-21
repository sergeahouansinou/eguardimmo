'use client';

import { Alert, Card, TextField } from '@eguardimmo/ui';
import { useState } from 'react';
import { FeesTable } from './FeesTable';
import { OwnerFundsGate, OwnerFundsSections } from './parts';
import { ownerFundsPaths } from './paths';
import { LinkButton, PageHeader } from '../../locataires/kit';
import { links } from '../../locataires/kit/links';

export function FeesPage() {
  const [month, setMonth] = useState('');
  const valid = /^\d{4}-(0[1-9]|1[0-2])$/.test(month);

  return (
    <OwnerFundsGate>
      <PageHeader
        crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Finances' }, { label: 'Honoraires' }]}
        title="Honoraires"
        actions={<LinkButton href={ownerFundsPaths.simulation}>Simuler un barème</LinkButton>}
        subtitle="Honoraires de gestion calculés par le serveur sur les loyers encaissés d’un mois clos, un relevé par mandat et par mois."
      />
      <OwnerFundsSections current="fees" />
      <Alert tone="info" title="Aucune saisie ni aucun calcul dans cet écran">
        Le relevé d’un mois est figé à la première validation de lot qui le requiert ; la facture d’honoraires est émise par le serveur au mandant et réglée par compensation sur son compte. Le barème (base, minimum, mode TTC ou HT) est porté par le mandat.
      </Alert>
      <Card role="region" aria-label="Relevés d’honoraires" className="gap-3">
        <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <TextField label="Mois" type="month" placeholder="AAAA-MM" value={month} onChange={(event) => { setMonth(event.target.value); }} hint="Laissez vide pour tous les mois." />
        </div>
        <FeesTable key={valid ? month : 'tous'} month={valid ? month : undefined} />
      </Card>
    </OwnerFundsGate>
  );
}
