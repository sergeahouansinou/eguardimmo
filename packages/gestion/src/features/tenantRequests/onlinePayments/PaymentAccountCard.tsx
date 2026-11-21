'use client';

import { Badge, Button, Icon } from '@eguardimmo/ui';
import { ExternalLink, Landmark } from 'lucide-react';
import { useState } from 'react';
import { SectionCard, useNotify } from '../../locataires/kit';
import { formatDateFr } from '../../locataires/kit/dates';
import { useTwoFactorProof } from '../../reauth';
import { ConfirmAction } from '../shared/parts/ConfirmAction';
import { QueryState } from '../shared/parts/QueryState';
import { useOnboardAccount, usePaymentAccount } from './hooks';
import { accountBadge } from './model';
import { runWithProof } from './proof';
import { useOnlinePaymentsSource } from './source';

export function PaymentAccountCard() {
  const source = useOnlinePaymentsSource();
  const account = usePaymentAccount(true);
  const onboard = useOnboardAccount();
  const notify = useNotify();
  const proof = useTwoFactorProof(source.confirmTwoFactor);
  const [confirming, setConfirming] = useState(false);
  const [onboardingUrl, setOnboardingUrl] = useState<string | null>(null);
  const current = account.data;
  const label = current === undefined || current === null ? 'Ouvrir le compte de paiement' : current.ready ? 'Actualiser le statut du compte' : 'Terminer l’ouverture du compte';

  return (
    <SectionCard
      id="payment-account"
      title="Compte de paiement"
      aside={
        current === undefined ? null : (
          <Button variant={current?.ready ? 'secondary' : 'primary'} size="sm" onClick={() => { setConfirming(true); }}>
            <Icon icon={Landmark} />
            {label}
          </Button>
        )
      }
    >
      {current === undefined ? (
        <QueryState query={account} label="Chargement du compte de paiement" title="Impossible de charger le compte de paiement" />
      ) : current === null ? (
        <p className="text-body text-fg-subtle">Aucun compte de paiement n’est ouvert. Sans lui, vos locataires ne peuvent pas payer en ligne : eGuardImmo ne détient jamais les fonds, ils vont directement sur le compte de votre organisation chez le prestataire.</p>
      ) : (
        <>
          <p className="flex flex-wrap items-center gap-2 text-body">
            <Badge tone={accountBadge[current.status].tone}>{accountBadge[current.status].label}</Badge>
            <span className="text-fg-muted">{`Prestataire : ${current.provider}`}</span>
            {current.onboardedAt === null ? null : <span className="text-fg-muted">{`ouvert le ${formatDateFr(current.onboardedAt)}`}</span>}
          </p>
          {current.status === 'restricted' ? <p className="text-caption text-fg-subtle">Le prestataire a restreint ce compte : terminez les vérifications demandées pour reprendre les encaissements.</p> : null}
        </>
      )}
      {onboardingUrl === null ? null : (
        <a href={onboardingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-body text-action-on-subtle underline underline-offset-2">
          Continuer l’ouverture chez le prestataire de paiement
          <Icon icon={ExternalLink} />
        </a>
      )}
      <ConfirmAction
        open={confirming}
        title="Ouvrir ou actualiser le compte de paiement ?"
        description="Cette action exige une double authentification récente. Elle ouvre, ou relit, le compte de votre organisation chez le prestataire de paiement, qui vérifie l’identité de l’organisation."
        confirmLabel="Confirmer"
        failureTitle="Compte non ouvert"
        run={async () => {
          const result = await runWithProof(proof, () => onboard.mutateAsync());
          setOnboardingUrl(result.ready ? null : result.onboardingUrl);
          notify({ title: result.ready ? 'Compte prêt' : 'Compte en cours d’ouverture', description: result.ready ? 'Vos locataires peuvent payer en ligne.' : 'Terminez l’ouverture chez le prestataire de paiement.' });
        }}
        onClose={() => { setConfirming(false); }}
      />
      {proof.dialog}
    </SectionCard>
  );
}
