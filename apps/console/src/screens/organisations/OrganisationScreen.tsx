'use client';

import { Alert, Badge, Button } from '@eguardimmo/ui';
import Link from 'next/link';
import { useState } from 'react';
import { formatDate } from '@/lib/format';
import { APPROVAL_ACTION_LABELS, SUSPENSION_REASON_LABELS, labelOf } from '@/platform/labels';
import type { Organisation } from '@/platform/organisations/organisations';
import { hasRole } from '@/platform/roles';
import { PageHeader } from '@/ui/PageHeader';
import { PlatformState } from '@/ui/PlatformState';
import { KeyValueList, Section } from '@/ui/Section';
import { EntitlementsSection } from './EntitlementsSection';
import { SupportAccessesSection } from './SupportAccessesSection';
import { ReactivateOrganisationDialog, SuspendOrganisationDialog } from './SuspensionDialogs';
import { usePendingApprovals, useOrganisation, useRoles } from './hooks';
import { KIND_LABELS, SUBSCRIPTION_LABELS } from './labels';

const STATE_ACTIONS = ['organizations.suspend', 'organizations.reactivate'];

export function OrganisationScreen({ id }: { id: string }) {
  const query = useOrganisation(id);
  return (
    <PlatformState
      query={query}
      label="L’organisation"
      notFound={{ title: 'Organisation introuvable', description: 'Cette organisation n’existe pas ou n’est plus accessible.', backHref: '/organisations', backLabel: 'Retour aux organisations' }}
    >
      {(organisation) => <Content organisation={organisation} />}
    </PlatformState>
  );
}

function Content({ organisation }: { organisation: Organisation }) {
  const roles = useRoles();
  const pending = usePendingApprovals().find((row) => row.subjectId === organisation.id && STATE_ACTIONS.includes(row.action));
  const [dialog, setDialog] = useState<'suspend' | 'reactivate' | null>(null);
  const suspended = organisation.state === 'suspended';
  const canRequest = hasRole(roles, 'admin', 'support');
  const close = (open: boolean) => {
    if (!open) setDialog(null);
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        Link={Link}
        breadcrumb={[{ label: 'Organisations', href: '/organisations' }, { label: organisation.name }]}
        title={organisation.name}
        badges={
          <>
            <Badge tone={suspended ? 'danger' : 'success'}>{suspended ? 'Suspendue' : 'Active'}</Badge>
            <Badge tone="neutral">{KIND_LABELS[organisation.kind] ?? organisation.kind}</Badge>
          </>
        }
        subtitle={`Client depuis le ${formatDate(organisation.createdAt)}`}
        actions={
          <>
            <Button variant="secondary" asChild>
              <Link href={`/organisations/${encodeURIComponent(organisation.id)}/modules`}>Modules et droits</Link>
            </Button>
            {canRequest && pending === undefined ? (
              suspended ? (
                <Button variant="secondary" onClick={() => { setDialog('reactivate'); }}>
                  Demander la réactivation
                </Button>
              ) : (
                <Button variant="danger" onClick={() => { setDialog('suspend'); }}>
                  Demander la suspension
                </Button>
              )
            ) : null}
          </>
        }
      />
      {pending ? (
        <Alert tone="info" title="En attente d’un second opérateur">
          {labelOf(APPROVAL_ACTION_LABELS, pending.action)}, demandée par {pending.requestedBy.name ?? 'un opérateur'}. <Link href="/approbations" className="underline underline-offset-3">Voir les approbations</Link>
        </Alert>
      ) : null}
      {suspended && organisation.suspension ? (
        <Alert tone="warning" title="Organisation suspendue">
          Suspendue le {formatDate(organisation.suspension.suspendedAt)}, motif : {organisation.suspension.reason === null ? 'non renseigné' : labelOf(SUSPENSION_REASON_LABELS, organisation.suspension.reason)}. Ses écritures sont refusées ; ses lectures et ses exports restent ouverts.
        </Alert>
      ) : null}
      <Section id="fiche" title="Fiche plateforme">
        <KeyValueList
          items={[
            { label: 'Pays', value: organisation.country },
            { label: 'Type', value: KIND_LABELS[organisation.kind] ?? organisation.kind },
            {
              label: 'Titulaire',
              value:
                organisation.owner === null ? (
                  '—'
                ) : organisation.owner.accountId === null ? (
                  `${organisation.owner.firstName} ${organisation.owner.lastName}`
                ) : (
                  <Link href={`/comptes/${organisation.owner.accountId}`} className="underline underline-offset-3">
                    {organisation.owner.firstName} {organisation.owner.lastName}
                  </Link>
                ),
            },
            { label: 'Membres actifs', value: String(organisation.membersCount) },
            { label: 'Double authentification', value: organisation.twoFactorRequired === null ? '—' : organisation.twoFactorRequired ? 'Exigée pour les membres' : 'Non exigée' },
            { label: 'Plan', value: organisation.plan ?? '—' },
            { label: 'Abonnement', value: organisation.subscriptionStatus === null ? '—' : (SUBSCRIPTION_LABELS[organisation.subscriptionStatus] ?? organisation.subscriptionStatus) },
          ]}
        />
      </Section>
      <EntitlementsSection organisationId={organisation.id} />
      <SupportAccessesSection organisationId={organisation.id} />
      <SuspendOrganisationDialog open={dialog === 'suspend'} onOpenChange={close} organisationId={organisation.id} organisationName={organisation.name} />
      <ReactivateOrganisationDialog open={dialog === 'reactivate'} onOpenChange={close} organisationId={organisation.id} organisationName={organisation.name} />
    </div>
  );
}
