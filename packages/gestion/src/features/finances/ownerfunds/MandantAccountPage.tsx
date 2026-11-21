'use client';

import { Alert, Badge, Button, Card } from '@eguardimmo/ui';
import { useState } from 'react';
import { FeesTable } from './FeesTable';
import { HoldsCard } from './HoldsCard';
import { PlaceHoldDialog } from './PlaceHoldDialog';
import { OwnerFundsApiError } from './api/ownerFundsErrors';
import { useMandantAccount, useOwnerFundsPermissions, usePartyNames } from './hooks';
import { exclusionLabel, moneyText } from './labels';
import { ownerFundsPaths } from './paths';
import { OwnerFundsGate, OwnerFundsSections } from './parts';
import { LedgerLines, ListLoading, LoadError, NotFoundPanel, PageHeader, useGestionNavigation } from '../../locataires/kit';
import { links } from '../../locataires/kit/links';

export function MandantAccountPage({ id }: { id: string }) {
  return (
    <OwnerFundsGate>
      <MandantAccountContent id={id} />
    </OwnerFundsGate>
  );
}

function MandantAccountContent({ id }: { id: string }) {
  const { Link } = useGestionNavigation();
  const permissions = useOwnerFundsPermissions();
  const account = useMandantAccount(id);
  const names = usePartyNames([id]);
  const name = names(id);
  const [holding, setHolding] = useState(false);

  if (account.isError) {
    if (account.error instanceof OwnerFundsApiError && account.error.kind === 'not_found') {
      return <NotFoundPanel title="Mandant introuvable" description="Ce mandant n’existe pas dans votre organisation." backHref={ownerFundsPaths.payouts} backLabel="Retour aux reversements" />;
    }
    return <LoadError title={account.error?.message ?? 'Le compte du mandant n’a pas pu être chargé'} />;
  }

  const data = account.data;

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Finances' }, { label: 'Reversements', href: ownerFundsPaths.payouts }, { label: name }]}
        title={`Compte de ${name}`}
        subtitle="Fonds détenus pour ce mandant, calculés par le serveur à partir du grand livre."
        badges={data?.fullHold ? <Badge tone="warning">Blocage total</Badge> : undefined}
        actions={
          <>
            <Button variant="secondary" asChild>
              <Link href={ownerFundsPaths.requestsOf(id)}>Changements d’IBAN</Link>
            </Button>
            {permissions.prepare && data ? <Button variant="secondary" onClick={() => { setHolding(true); }}>Poser une retenue</Button> : null}
          </>
        }
      />
      <OwnerFundsSections current="payouts" />
      {!data ? <ListLoading label="Chargement du compte du mandant" /> : null}
      {data ? (
        <Card role="region" aria-label="Compte du mandant" className="gap-3">
          <h2 className="text-block-title text-fg">Compte du mandant</h2>
          <LedgerLines
            lines={[
              { label: 'Dû au mandant', value: moneyText(data.payable) },
              { label: 'Virements en cours', value: moneyText(data.inTransit) },
              { label: 'Loyers appelés non encaissés', value: moneyText(data.calledNotCollected) },
              { label: 'Honoraires dus', value: moneyText(data.feesDue) },
              { label: 'Honoraires estimés du mois en cours', value: moneyText(data.feesEstimated) },
              { label: 'Retenues', value: data.fullHold ? 'Blocage total' : moneyText(data.reserve) },
              { label: 'Compte de paiement', value: data.bankLast4 === null ? 'Aucun compte valide' : `IBAN •••• ${data.bankLast4}` },
            ]}
            total={{ label: 'Net reversible', value: moneyText(data.netPayable) }}
          />
          {data.exclusionReason ? <Alert tone="warning" title="Ce mandant n’est pas reversible">{exclusionLabel[data.exclusionReason]}</Alert> : null}
        </Card>
      ) : null}
      <HoldsCard mandantId={id} />
      <Card role="region" aria-label="Honoraires du mandant" className="gap-3">
        <h2 className="text-block-title text-fg">Honoraires du mandant</h2>
        <FeesTable mandantId={id} showMandant={false} />
      </Card>
      <PlaceHoldDialog target={holding && data ? { mandantId: id, name, currency: data.netPayable.currency } : null} onClose={() => { setHolding(false); }} />
    </>
  );
}
