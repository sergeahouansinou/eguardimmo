'use client';

import { Alert, Badge, Button, Card } from '@eguardimmo/ui';
import { useState } from 'react';
import { RequestsList } from './RequestsList';
import { usePartyNames } from './hooks';
import { requestBadge } from './labels';
import { PAYOUT_REQUEST_STATUSES } from './model';
import type { PayoutRequestStatus } from './model';
import { ownerFundsPaths } from './paths';
import { OwnerFundsGate, OwnerFundsSections, RoleNotice } from './parts';
import { useOwnerFundsPermissions } from './hooks';
import { PageHeader, useGestionNavigation } from '../../locataires/kit';
import { links } from '../../locataires/kit/links';

const ORDER: readonly PayoutRequestStatus[] = ['pending', 'awaiting_code', ...PAYOUT_REQUEST_STATUSES.filter((status) => status !== 'pending' && status !== 'awaiting_code')];

export function RequestsPage() {
  return (
    <OwnerFundsGate>
      <RequestsContent />
    </OwnerFundsGate>
  );
}

function RequestsContent() {
  const { Link, search } = useGestionNavigation();
  const permissions = useOwnerFundsPermissions();
  const [status, setStatus] = useState<PayoutRequestStatus>('pending');
  const rawMandant = search.get('mandant');
  const mandantId = rawMandant === null || rawMandant === '' ? undefined : rawMandant;
  const names = usePartyNames(mandantId === undefined ? [] : [mandantId]);

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Finances' }, { label: 'Reversements', href: ownerFundsPaths.payouts }, { label: 'Changements d’IBAN' }]}
        title="Changements d’IBAN des propriétaires"
        subtitle="Un propriétaire propose un nouvel IBAN depuis son espace, avec une pièce du RIB. Rien ne change tant que l’agence ne l’a pas validé."
      />
      <OwnerFundsSections current="accounts" />
      <Alert tone="info" title="Comment valider un changement">
        Ouvrez la pièce du RIB, contrôlez que le titulaire est bien le mandant, appelez-le à un numéro déjà connu de l’agence, puis ressaisissez l’IBAN et le titulaire lus sur la pièce. Le serveur les compare à la demande sans jamais afficher l’IBAN. Une demande sans suite expire d’elle-même.
      </Alert>
      <Card role="region" aria-label="Demandes de changement d’IBAN" className="gap-3">
        <div role="group" aria-label="Filtrer par état" className="flex flex-wrap gap-2">
          {ORDER.map((candidate) => (
            <Button key={candidate} size="sm" variant={candidate === status ? 'primary' : 'secondary'} aria-pressed={candidate === status} onClick={() => { setStatus(candidate); }}>
              {requestBadge[candidate].label}
            </Button>
          ))}
        </div>
        {mandantId === undefined ? null : (
          <p className="flex flex-wrap items-center gap-2 text-caption text-fg-muted">
            <span>Mandant :</span>
            <Badge tone="info">{names(mandantId)}</Badge>
            <Link href={ownerFundsPaths.requests} className="text-action-on-subtle underline underline-offset-2">Voir tous les mandants</Link>
          </p>
        )}
        <RequestsList key={`${status}:${mandantId ?? ''}`} status={status} mandantId={mandantId} />
        {permissions.sensitive ? null : <RoleNotice>Votre rôle permet de consulter les demandes. Ouvrir la pièce, approuver ou refuser est réservé aux rôles propriétaire, administrateur et comptable.</RoleNotice>}
      </Card>
    </>
  );
}
