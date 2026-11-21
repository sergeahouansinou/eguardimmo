'use client';

import { Alert, Badge, Button } from '@eguardimmo/ui';
import Link from 'next/link';
import { useState } from 'react';
import { formatDateTime } from '@/lib/format';
import { APPROVAL_ACTION_LABELS, SUSPENSION_REASON_LABELS, labelOf } from '@/platform/labels';
import type { Account } from '@/platform/accounts/accounts';
import { hasRole } from '@/platform/roles';
import { PageHeader } from '@/ui/PageHeader';
import { PlatformState } from '@/ui/PlatformState';
import { KeyValueList, Section } from '@/ui/Section';
import { usePendingApprovals, useRoles } from '../organisations/hooks';
import { ReactivateAccountDialog, ResetTwoFactorDialog, ReviewSuspensionDialog, RevokeSessionsDialog, SuspendAccountDialog } from './AccountDialogs';
import { useAccount } from './hooks';
import { PROFILE_LABELS } from './labels';

const APPROVAL_ACTIONS = ['identity.account.reactivate', 'identity.account.reset_two_factor'];

type DialogName = 'revoke' | 'suspend' | 'review' | 'reactivate' | 'reset' | null;

export function CompteScreen({ id }: { id: string }) {
  const query = useAccount(id);
  return (
    <PlatformState
      query={query}
      label="Le compte"
      notFound={{ title: 'Compte introuvable', description: 'Ce compte n’existe pas ou n’est plus accessible.', backHref: '/comptes', backLabel: 'Retour à la recherche' }}
    >
      {(account) => <Content account={account} />}
    </PlatformState>
  );
}

function Content({ account }: { account: Account }) {
  const roles = useRoles();
  const pending = usePendingApprovals().find((row) => row.subjectId === account.id && APPROVAL_ACTIONS.includes(row.action));
  const [dialog, setDialog] = useState<DialogName>(null);
  const close = (open: boolean) => {
    if (!open) setDialog(null);
  };
  const manageable = !account.deleted && !account.isOperator;
  const canAct = manageable && hasRole(roles, 'admin', 'support');
  const canReview = manageable && hasRole(roles, 'admin', 'compliance') && account.suspension !== null && !account.suspension.reviewed;
  const suspended = account.suspension !== null;
  const shared = { accountId: account.id, accountName: account.name };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        Link={Link}
        breadcrumb={[{ label: 'Comptes', href: '/comptes' }, { label: account.name }]}
        title={account.name}
        badges={
          <>
            {account.deleted ? <Badge tone="neutral">Supprimé</Badge> : null}
            {suspended ? <Badge tone="danger">Suspendu</Badge> : null}
            {account.isOperator ? <Badge tone="info">{PROFILE_LABELS.operator}</Badge> : null}
          </>
        }
        subtitle={account.email ?? 'Adresse non communiquée'}
      />
      {account.deleted ? (
        <Alert tone="info" title="Compte supprimé">
          Ce compte est en lecture seule{account.deletedAt === null ? '' : ` depuis le ${formatDateTime(account.deletedAt)}`} : aucune action n’est possible.
        </Alert>
      ) : null}
      {account.isOperator ? (
        <Alert tone="info" title="Compte opérateur">
          Ce compte est géré par commande sur le serveur : la console n’y propose aucune action.
        </Alert>
      ) : null}
      {pending ? (
        <Alert tone="info" title="En attente d’un second opérateur">
          {labelOf(APPROVAL_ACTION_LABELS, pending.action)}, demandée par {pending.requestedBy.name ?? 'un opérateur'}. <Link href="/approbations" className="underline underline-offset-3">Voir les approbations</Link>
        </Alert>
      ) : null}
      {account.suspension ? (
        <Alert tone="warning" title="Compte suspendu">
          Suspendu le {formatDateTime(account.suspension.suspendedAt)}, motif : {account.suspension.reason === null ? 'non renseigné' : labelOf(SUSPENSION_REASON_LABELS, account.suspension.reason)}.{' '}
          {account.suspension.reviewed
            ? `Suspension revue${account.suspension.reviewedAt === null ? '' : ` le ${formatDateTime(account.suspension.reviewedAt)}`}.`
            : 'Revue a posteriori requise.'}
        </Alert>
      ) : null}
      <Section id="identite" title="Identité et accès">
        <KeyValueList
          items={[
            { label: 'Adresse e-mail', value: account.email ?? '—' },
            { label: 'Vérification de l’adresse', value: account.emailVerified ? 'Vérifiée' : 'Non vérifiée' },
            { label: 'Création', value: account.createdAt === null ? '—' : formatDateTime(account.createdAt) },
            { label: 'Dernière connexion', value: account.lastLoginAt === null ? 'Jamais' : formatDateTime(account.lastLoginAt) },
            { label: 'Double authentification', value: account.twoFactor.enabled ? 'Activée' : 'Désactivée' },
            { label: 'Codes de secours restants', value: account.twoFactor.recoveryCodesRemaining === null ? '—' : String(account.twoFactor.recoveryCodesRemaining) },
            { label: 'Appareils', value: String(account.devicesCount) },
            { label: 'Jetons actifs', value: String(account.tokensCount) },
            { label: 'Types de profil', value: account.profileTypes.length === 0 ? '—' : account.profileTypes.map((type) => PROFILE_LABELS[type] ?? type).join(', ') },
            { label: 'Organisations', value: String(account.organizationsCount) },
          ]}
        />
      </Section>
      {canAct || canReview ? (
        <Section id="actions" title="Actions">
          <div className="flex flex-wrap gap-2">
            {canAct ? (
              <Button variant="secondary" onClick={() => { setDialog('revoke'); }}>
                Révoquer les sessions
              </Button>
            ) : null}
            {canAct && !suspended ? (
              <Button variant="danger" onClick={() => { setDialog('suspend'); }}>
                Suspendre le compte
              </Button>
            ) : null}
            {canReview ? (
              <Button variant="secondary" onClick={() => { setDialog('review'); }}>
                Revoir la suspension
              </Button>
            ) : null}
            {canAct && suspended && pending?.action !== 'identity.account.reactivate' ? (
              <Button variant="secondary" onClick={() => { setDialog('reactivate'); }}>
                Demander la réactivation
              </Button>
            ) : null}
            {canAct && account.twoFactor.enabled && pending?.action !== 'identity.account.reset_two_factor' ? (
              <Button variant="secondary" onClick={() => { setDialog('reset'); }}>
                Réinitialiser la double authentification
              </Button>
            ) : null}
          </div>
        </Section>
      ) : null}
      <RevokeSessionsDialog open={dialog === 'revoke'} onOpenChange={close} {...shared} />
      <SuspendAccountDialog open={dialog === 'suspend'} onOpenChange={close} {...shared} />
      <ReviewSuspensionDialog open={dialog === 'review'} onOpenChange={close} {...shared} />
      <ReactivateAccountDialog open={dialog === 'reactivate'} onOpenChange={close} {...shared} />
      <ResetTwoFactorDialog open={dialog === 'reset'} onOpenChange={close} {...shared} />
    </div>
  );
}
