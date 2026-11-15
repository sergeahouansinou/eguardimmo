'use client';

import { Alert, Avatar, Badge, Button, Icon, Tab, TabList, TabPanel, Tabs } from '@eguardimmo/ui';
import { FileClock, Info, KeyRound, Puzzle, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useOrganisation } from '@/console/hooks/queries';
import {
  useReactivateOrganisation,
  useRequestOrganisationAccess,
  useSuspendOrganisation,
} from '@/console/hooks/mutations';
import { ORGANISATION_TYPE_LABELS } from '@/console/schemas';
import type { OrganisationDetail } from '@/console/schemas';
import { AccessRequestDialog, SuspendDialog } from '@/features/shared/ReasonDialogs';
import { formatDate, formatDateTime, formatEuros, formatInteger, formatTime } from '@/lib/format';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import { PageHeader } from '@/ui/PageHeader';
import { QueryState } from '@/ui/QueryState';
import { EmptyLine, KeyValueList, ListRow, Section, UsageBar } from '@/ui/Section';
import { useNotify } from '@/ui/notify';
import { ChangePlanDialog, EditOrganisationDialog } from './OrganisationDialogs';
import { OrganisationStateBadge } from './labels';

export function OrganisationDetailScreen({ id }: { id: string }) {
  const query = useOrganisation(id);
  return (
    <QueryState
      query={query}
      label="L’organisation"
      notFound={{
        title: 'Organisation introuvable',
        description: 'Cette organisation n’existe pas ou n’est plus visible depuis la console.',
        backHref: '/organisations',
        backLabel: 'Retour aux organisations',
      }}
    >
      {(detail) => <DetailContent detail={detail} />}
    </QueryState>
  );
}

type OpenDialog = 'plan' | 'access' | 'suspend' | 'reactivate' | 'edit' | null;

function DetailContent({ detail }: { detail: OrganisationDetail }) {
  const { organisation } = detail;
  const notify = useNotify();
  const [dialog, setDialog] = useState<OpenDialog>(null);
  const [tab, setTab] = useState('resume');
  const suspend = useSuspendOrganisation(organisation.id);
  const reactivate = useReactivateOrganisation(organisation.id);
  const requestAccess = useRequestOrganisationAccess(organisation.id);
  const close = (open: boolean) => { if (!open) setDialog(null); };
  const suspended = organisation.state === 'suspendue';

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        Link={Link}
        breadcrumb={[{ label: 'Organisations', href: '/organisations' }, { label: organisation.name }]}
        lead={<Avatar initials={organisation.name.split(/\s+/).map((part) => part[0] ?? '').join('')} size="lg" />}
        title={organisation.name}
        badges={
          <>
            <Badge tone="neutral">{ORGANISATION_TYPE_LABELS[organisation.type]}</Badge>
            <OrganisationStateBadge row={organisation} />
          </>
        }
        subtitle={`Créée le ${formatDate(organisation.createdOn)} · Plan ${organisation.planName} · Titulaire : ${detail.holder.name}`}
        actions={
          <>
            <Button variant="secondary" asChild>
              <Link href={`/organisations/${organisation.id}/modules`}>
                <Icon icon={Puzzle} />
                Modules
              </Link>
            </Button>
            <Button variant="secondary" onClick={() => { setDialog('plan'); }}>
              Changer de plan
            </Button>
            <Button variant="secondary" onClick={() => { setDialog('access'); }}>
              <Icon icon={KeyRound} />
              Demander un accès
            </Button>
            {suspended ? (
              <Button variant="secondary" onClick={() => { setDialog('reactivate'); }}>
                Réactiver
              </Button>
            ) : (
              <Button variant="danger" onClick={() => { setDialog('suspend'); }}>
                <Icon icon={ShieldAlert} />
                Suspendre
              </Button>
            )}
          </>
        }
      />
      {suspended ? (
        <Alert tone="danger" title="Organisation suspendue">
          L’accès de l’organisation est bloqué ; ses données sont conservées. Réactivez-la pour rétablir l’accès.
        </Alert>
      ) : null}
      <Alert tone="info">
        <span className="flex items-start gap-2">
          <Icon icon={Info} className="mt-0.5 shrink-0" />
          Les données de {organisation.name} (mandants, locataires, quittances) ne sont consultables que sur accès justifié : motif obligatoire,
          durée limitée à 60 minutes, consigné dans le journal d’audit.
        </span>
      </Alert>
      <Tabs value={tab} defaultValue="resume" onValueChange={setTab}>
        <TabList aria-label="Sections de l’organisation">
          <Tab value="resume">Résumé</Tab>
          <Tab value="utilisateurs" count={organisation.userCount}>Utilisateurs</Tab>
          <Tab value="modules" count={detail.modules.enabled}>Modules</Tab>
          <Tab value="usage">Usage</Tab>
          <Tab value="journal">Journal</Tab>
        </TabList>
        <TabPanel value="resume" className="flex flex-col gap-4 pt-2">
          <Summary detail={detail} onEdit={() => { setDialog('edit'); }} onSeeUsers={() => { setTab('utilisateurs'); }} />
        </TabPanel>
        <TabPanel value="utilisateurs" className="pt-2">
          <Section id="tab-utilisateurs" title={`Utilisateurs (${formatInteger(detail.users.length)})`}>
            <UsersList detail={detail} />
          </Section>
        </TabPanel>
        <TabPanel value="modules" className="flex flex-col gap-4 pt-2">
          <DisabledModules detail={detail} />
        </TabPanel>
        <TabPanel value="usage" className="pt-2">
          <UsageSection detail={detail} />
        </TabPanel>
        <TabPanel value="journal" className="flex flex-col gap-4 pt-2">
          <ActionsSection detail={detail} />
          <AccessesSection detail={detail} />
        </TabPanel>
      </Tabs>

      <ChangePlanDialog open={dialog === 'plan'} onOpenChange={close} detail={detail} />
      <EditOrganisationDialog open={dialog === 'edit'} onOpenChange={close} detail={detail} />
      <AccessRequestDialog
        open={dialog === 'access'}
        onOpenChange={close}
        title="Demander un accès justifié"
        description="Motif obligatoire. L’accès dure 60 minutes au plus et est consigné au journal d’audit."
        submitLabel="Demander l’accès"
        onSubmit={async (input) => {
          await requestAccess.mutateAsync(input);
          notify.success('Accès ouvert pour 60 minutes', 'La demande est consignée au journal d’audit.');
        }}
      />
      <SuspendDialog
        open={dialog === 'suspend'}
        onOpenChange={close}
        title={`Suspendre ${organisation.name}`}
        description="L’accès de tous ses utilisateurs est bloqué ; les données sont conservées. L’action est consignée au journal d’audit."
        submitLabel="Suspendre l’organisation"
        onSubmit={async (input) => {
          await suspend.mutateAsync(input);
          notify.success('Organisation suspendue', 'La suspension est consignée au journal d’audit.');
        }}
      />
      <ConfirmDialog
        open={dialog === 'reactivate'}
        onOpenChange={close}
        title={`Réactiver ${organisation.name}`}
        description="L’accès de ses utilisateurs est rétabli. L’action est consignée au journal d’audit."
        confirmLabel="Réactiver l’organisation"
        onConfirm={async () => {
          await reactivate.mutateAsync();
          notify.success('Organisation réactivée', 'La réactivation est consignée au journal d’audit.');
        }}
      />
    </div>
  );
}

function Summary({ detail, onEdit, onSeeUsers }: { detail: OrganisationDetail; onEdit: () => void; onSeeUsers: () => void }) {
  const { organisation } = detail;
  const stats = [
    { label: 'Plan', value: organisation.planName, caption: `${formatEuros(detail.planMonthlyMinor)} HT par mois` },
    {
      label: 'Utilisateurs',
      value: formatInteger(organisation.userCount),
      caption: `sur ${formatInteger(detail.includedUsers)} inclus dans le plan`,
    },
    {
      label: 'Modules activés',
      value: formatInteger(detail.modules.enabled),
      caption: `sur ${formatInteger(detail.modules.total)}${detail.modules.disabled.length > 0 ? ` · ${detail.modules.disabled.map((item) => item.name).join(' et ')} désactivés` : ''}`,
    },
    {
      label: 'Dernière activité',
      value: formatDateTime(detail.lastActivity.at),
      caption: detail.lastActivity.by,
    },
  ];
  return (
    <>
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="flex min-w-0 flex-col gap-0.5 rounded-lg border border-line bg-surface px-4 py-3">
            <dt className="text-caption text-fg-subtle">{stat.label}</dt>
            <dd className="text-[18px] leading-7 font-semibold break-words">{stat.value}</dd>
            <dd className="text-caption break-words text-fg-subtle">{stat.caption}</dd>
          </div>
        ))}
      </dl>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Section
          id="informations"
          title="Informations"
          aside={
            <Button variant="link" onClick={onEdit}>
              Modifier
            </Button>
          }
        >
          <KeyValueList
            items={[
              { label: 'Type', value: ORGANISATION_TYPE_LABELS[organisation.type] },
              { label: 'Plan', value: `${organisation.planName}, ${formatEuros(detail.planMonthlyMinor)} HT par mois` },
              { label: 'Titulaire', value: detail.holder.name },
              { label: 'Contact', value: detail.contactEmail },
              { label: 'Siège', value: detail.headquarters },
              { label: 'Activité', value: detail.activity },
              { label: 'Création', value: detail.creation },
            ]}
          />
        </Section>
        <UsageSection detail={detail} />
        <Section
          id="utilisateurs"
          title="Utilisateurs"
          aside={
            <Button variant="link" onClick={onSeeUsers}>
              Tout voir, {formatInteger(organisation.userCount)}
            </Button>
          }
        >
          <UsersList detail={detail} limit={4} />
        </Section>
        <ActionsSection detail={detail} />
        <DisabledModules detail={detail} />
        <AccessesSection detail={detail} />
      </div>
    </>
  );
}

function UsersList({ detail, limit }: { detail: OrganisationDetail; limit?: number }) {
  const users = limit ? detail.users.slice(0, limit) : detail.users;
  if (users.length === 0) return <EmptyLine>Aucun utilisateur.</EmptyLine>;
  return (
    <ul>
      {users.map((user) => (
        <ListRow
          key={user.id}
          title={
            <span className="flex items-center gap-2">
              <Avatar initials={user.name.split(/\s+/).map((part) => part[0] ?? '').join('')} />
              {user.name}
            </span>
          }
          detail={`Dernière connexion ${formatDateTime(user.lastLoginAt)}`}
          trailing={<Badge tone="neutral">{user.role}</Badge>}
        />
      ))}
    </ul>
  );
}

function UsageSection({ detail }: { detail: OrganisationDetail }) {
  return (
    <Section id="usage" title="Usage du plan">
      <div className="flex flex-col gap-3 pt-1">
        {detail.usage.map((item) => (
          <UsageBar key={item.id} label={item.label} value={item.value} max={item.max} text={item.text} />
        ))}
      </div>
      <p className="pt-3 text-caption text-fg-subtle">Aucun dépassement sur les 3 derniers mois.</p>
    </Section>
  );
}

function ActionsSection({ detail }: { detail: OrganisationDetail }) {
  return (
    <Section
      id="dernieres-actions"
      title="Dernières actions"
      aside={
        <Link
          href={`/audit?organisation=${detail.organisation.id}`}
          className="text-caption font-medium text-action-on-subtle underline underline-offset-3"
        >
          Tout voir, {formatInteger(detail.auditTotal)}
        </Link>
      }
    >
      {detail.recentActions.length === 0 ? (
        <EmptyLine>Aucune action enregistrée.</EmptyLine>
      ) : (
        <ul>
          {detail.recentActions.map((action) => (
            <ListRow
              key={action.id}
              icon={FileClock}
              tone="neutral"
              title={
                <Link href={`/audit/${action.id}`} className="hover:underline">
                  {action.title}
                </Link>
              }
              detail={`${formatDateTime(action.at)} · ${action.context}`}
              trailing={action.operator ? <Badge tone="warning">Opérateur</Badge> : undefined}
            />
          ))}
        </ul>
      )}
    </Section>
  );
}

function DisabledModules({ detail }: { detail: OrganisationDetail }) {
  return (
    <Section
      id="modules-desactives"
      title="Modules désactivés"
      aside={
        <Link
          href={`/organisations/${detail.organisation.id}/modules`}
          className="text-caption font-medium text-action-on-subtle underline underline-offset-3"
        >
          Gérer les modules
        </Link>
      }
    >
      {detail.modules.disabled.length === 0 ? (
        <EmptyLine>Tous les modules sont activés.</EmptyLine>
      ) : (
        <ul>
          {detail.modules.disabled.map((module) => (
            <ListRow
              key={module.id}
              icon={Puzzle}
              tone="neutral"
              title={module.name}
              detail={module.reason}
              trailing={<Badge tone="neutral">Désactivé</Badge>}
            />
          ))}
        </ul>
      )}
    </Section>
  );
}

function AccessesSection({ detail }: { detail: OrganisationDetail }) {
  return (
    <Section id="acces-operateur" title="Accès opérateur">
      {detail.accesses.length === 0 ? (
        <EmptyLine>Aucun accès justifié sur cette organisation.</EmptyLine>
      ) : (
        <ul>
          {detail.accesses.map((access) => (
            <ListRow
              key={access.id}
              icon={KeyRound}
              tone="warning"
              title={access.ticket ? `Accès justifié, ticket ${access.ticket}` : 'Accès justifié'}
              detail={`${formatDateTime(access.startedAt)} → ${formatTime(access.endsAt)} · ${access.operator} · ${access.reason}`}
              trailing={<Badge tone={access.active ? 'warning' : 'neutral'}>{access.active ? 'En cours' : 'Terminé'}</Badge>}
            />
          ))}
        </ul>
      )}
    </Section>
  );
}
