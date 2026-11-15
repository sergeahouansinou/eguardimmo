'use client';

import { Alert, Avatar, Badge, Button, Icon, Tab, TabList, TabPanel, Tabs } from '@eguardimmo/ui';
import { Info, KeyRound, Power, ShieldAlert, ShieldOff } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useAccount } from '@/console/hooks/queries';
import {
  useReactivateAccount,
  useRequestAccountAccess,
  useResetTwoFactor,
  useRevokeSessions,
  useSuspendAccount,
} from '@/console/hooks/mutations';
import { PROFILE_LABELS } from '@/console/schemas';
import type { AccountDetail } from '@/console/schemas';
import { AccessRequestDialog, SuspendDialog } from '@/features/shared/ReasonDialogs';
import { formatDate, formatDateTime, formatInteger, initials, plural } from '@/lib/format';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import { DataTable } from '@/ui/DataTable';
import type { Column } from '@/ui/DataTable';
import { PageHeader } from '@/ui/PageHeader';
import { QueryState } from '@/ui/QueryState';
import { EmptyLine, KeyValueList, ListRow, Section } from '@/ui/Section';
import { useNotify } from '@/ui/notify';
import { AccountStateBadge } from './ComptesScreen';

export function CompteDetailScreen({ id }: { id: string }) {
  const query = useAccount(id);
  return (
    <QueryState
      query={query}
      label="Le compte"
      notFound={{
        title: 'Compte introuvable',
        description: 'Ce compte n’existe pas ou n’est plus visible depuis la console.',
        backHref: '/comptes',
        backLabel: 'Retour aux comptes',
      }}
    >
      {(detail) => <DetailContent detail={detail} />}
    </QueryState>
  );
}

type OpenDialog = 'access' | 'suspend' | 'reactivate' | 'twofactor' | 'sessions' | null;
type LoginRow = AccountDetail['logins']['rows'][number];

const loginColumns: Column<LoginRow>[] = [
  { id: 'date', header: 'Date', primary: true, cell: (row) => formatDateTime(row.at) },
  { id: 'profile', header: 'Profil', cell: (row) => row.profile },
  { id: 'device', header: 'Appareil', cell: (row) => row.device },
  { id: 'origin', header: 'Origine', cell: (row) => row.origin },
  { id: 'result', header: 'Résultat', cell: (row) => <Badge tone={row.success ? 'success' : 'danger'}>{row.success ? 'Réussie' : 'Échec'}</Badge> },
];

function DetailContent({ detail }: { detail: AccountDetail }) {
  const { account } = detail;
  const notify = useNotify();
  const [dialog, setDialog] = useState<OpenDialog>(null);
  const [tab, setTab] = useState('resume');
  const suspend = useSuspendAccount(account.id);
  const reactivate = useReactivateAccount(account.id);
  const resetTwoFactor = useResetTwoFactor(account.id);
  const revoke = useRevokeSessions(account.id);
  const requestAccess = useRequestAccountAccess(account.id);
  const close = (open: boolean) => { if (!open) setDialog(null); };
  const suspended = account.state === 'suspendu';
  const kinds = account.profiles.map((kind) => PROFILE_LABELS[kind].toLowerCase()).join(', ');

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        Link={Link}
        breadcrumb={[{ label: 'Comptes et profils', href: '/comptes' }, { label: account.name }]}
        lead={<Avatar initials={initials(account.name)} size="lg" />}
        title={account.name}
        badges={
          <>
            <AccountStateBadge state={account.state} />
            <Badge tone={account.twoFactor ? 'success' : 'neutral'}>{account.twoFactor ? '2FA activée' : 'Sans 2FA'}</Badge>
          </>
        }
        subtitle={`Compte créé le ${formatDate(detail.createdOn)} · ${plural(account.profiles.length, 'profil')} : ${kinds}`}
        actions={
          <>
            <Button variant="secondary" disabled={!account.twoFactor} onClick={() => { setDialog('twofactor'); }}>
              <Icon icon={ShieldOff} />
              Réinitialiser la 2FA
            </Button>
            {suspended ? (
              <Button variant="secondary" onClick={() => { setDialog('reactivate'); }}>
                Réactiver
              </Button>
            ) : (
              <Button variant="danger" disabled={account.state === 'invite'} onClick={() => { setDialog('suspend'); }}>
                <Icon icon={ShieldAlert} />
                Suspendre
              </Button>
            )}
            <Button variant="secondary" onClick={() => { setDialog('access'); }}>
              <Icon icon={KeyRound} />
              Demander un accès
            </Button>
          </>
        }
      />
      <Alert tone="info">
        <span className="flex items-start gap-2">
          <Icon icon={Info} className="mt-0.5 shrink-0" />
          Les données des {formatInteger(account.profiles.length)} espaces de {account.name} ne s’ouvrent que sur accès justifié, consigné dans le
          journal d’audit.
        </span>
      </Alert>
      <Tabs value={tab} defaultValue="resume" onValueChange={setTab}>
        <TabList aria-label="Sections du compte">
          <Tab value="resume">Résumé</Tab>
          <Tab value="profils" count={detail.profileList.length}>Profils</Tab>
          <Tab value="connexions" count={detail.logins.total}>Connexions</Tab>
          <Tab value="securite">Sécurité</Tab>
        </TabList>
        <TabPanel value="resume" className="flex flex-col gap-4 pt-2">
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'Profils', value: formatInteger(account.profiles.length), caption: kinds },
              {
                label: 'Dernière connexion',
                value: account.lastLoginAt ? formatDateTime(account.lastLoginAt) : 'Jamais',
                caption: detail.logins.rows[0]?.device ?? 'Aucune connexion',
              },
              { label: 'Connexions, 30 jours', value: formatInteger(detail.logins.last30Days), caption: plural(detail.logins.failures, 'échec') },
              {
                label: 'Double authentification',
                value: account.twoFactor ? 'Activée' : 'Désactivée',
                caption: detail.security.since ? `${detail.security.method}, depuis le ${formatDate(detail.security.since)}` : detail.security.method,
              },
            ].map((stat) => (
              <div key={stat.label} className="flex min-w-0 flex-col gap-0.5 rounded-lg border border-line bg-surface px-4 py-3">
                <dt className="text-caption text-fg-subtle">{stat.label}</dt>
                <dd className="text-[18px] leading-7 font-semibold break-words">{stat.value}</dd>
                <dd className="text-caption break-words text-fg-subtle">{stat.caption}</dd>
              </div>
            ))}
          </dl>
          <ProfilesSection detail={detail} onSeeAll={() => { setTab('profils'); }} />
          <LoginsSection detail={detail} limit={4} onSeeAll={() => { setTab('connexions'); }} />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <ContactSection detail={detail} />
            <SecuritySection detail={detail} onRevoke={() => { setDialog('sessions'); }} />
          </div>
        </TabPanel>
        <TabPanel value="profils" className="pt-2">
          <ProfilesSection detail={detail} />
        </TabPanel>
        <TabPanel value="connexions" className="pt-2">
          <LoginsSection detail={detail} />
        </TabPanel>
        <TabPanel value="securite" className="grid grid-cols-1 gap-4 pt-2 xl:grid-cols-2">
          <SecuritySection detail={detail} onRevoke={() => { setDialog('sessions'); }} />
          <ContactSection detail={detail} />
        </TabPanel>
      </Tabs>

      <AccessRequestDialog
        open={dialog === 'access'}
        onOpenChange={close}
        title="Demander un accès justifié"
        description={`Les espaces de ${account.name} s’ouvrent 60 minutes au plus, avec un motif consigné au journal d’audit.`}
        submitLabel="Demander l’accès"
        onSubmit={async (input) => {
          await requestAccess.mutateAsync(input);
          notify.success('Accès ouvert pour 60 minutes', 'La demande est consignée au journal d’audit.');
        }}
      />
      <SuspendDialog
        open={dialog === 'suspend'}
        onOpenChange={close}
        title={`Suspendre ${account.name}`}
        description="La connexion est bloquée sur tous ses profils et ses sessions sont révoquées. L’action est consignée au journal d’audit."
        submitLabel="Suspendre le compte"
        onSubmit={async (input) => {
          await suspend.mutateAsync(input);
          notify.success('Compte suspendu', 'La suspension est consignée au journal d’audit.');
        }}
      />
      <ConfirmDialog
        open={dialog === 'reactivate'}
        onOpenChange={close}
        title={`Réactiver ${account.name}`}
        description="La connexion est rétablie sur tous ses profils. L’action est consignée au journal d’audit."
        confirmLabel="Réactiver le compte"
        onConfirm={async () => {
          await reactivate.mutateAsync();
          notify.success('Compte réactivé', 'La réactivation est consignée au journal d’audit.');
        }}
      />
      <ConfirmDialog
        open={dialog === 'twofactor'}
        onOpenChange={close}
        title="Réinitialiser la double authentification"
        description={`${account.name} devra configurer à nouveau son application d’authentification à sa prochaine connexion. Ses codes de secours actuels sont invalidés.`}
        confirmLabel="Réinitialiser la 2FA"
        tone="danger"
        onConfirm={async () => {
          await resetTwoFactor.mutateAsync();
          notify.success('2FA réinitialisée', 'La réinitialisation est consignée au journal d’audit.');
        }}
      />
      <ConfirmDialog
        open={dialog === 'sessions'}
        onOpenChange={close}
        title="Révoquer les sessions"
        description={`${account.name} sera déconnecté de tous ses appareils (${plural(detail.security.sessions, 'session active', 'sessions actives')}).`}
        confirmLabel="Révoquer les sessions"
        tone="danger"
        onConfirm={async () => {
          await revoke.mutateAsync();
          notify.success('Sessions révoquées', 'La révocation est consignée au journal d’audit.');
        }}
      />
    </div>
  );
}

function ProfilesSection({ detail, onSeeAll }: { detail: AccountDetail; onSeeAll?: () => void }) {
  return (
    <Section
      id="profils"
      title="Profils"
      aside={
        onSeeAll ? (
          <Button variant="link" onClick={onSeeAll}>
            Tout voir, {formatInteger(detail.profileList.length)}
          </Button>
        ) : undefined
      }
    >
      <ul>
        {detail.profileList.map((profile) => (
          <ListRow
            key={profile.id}
            title={
              profile.organisationId ? (
                <Link href={`/organisations/${profile.organisationId}`} className="hover:underline">
                  {profile.title}
                </Link>
              ) : (
                profile.title
              )
            }
            detail={profile.detail}
            trailing={<Badge tone="neutral">{profile.status}</Badge>}
          />
        ))}
      </ul>
    </Section>
  );
}

function LoginsSection({ detail, limit, onSeeAll }: { detail: AccountDetail; limit?: number; onSeeAll?: () => void }) {
  const rows = limit ? detail.logins.rows.slice(0, limit) : detail.logins.rows;
  return (
    <Section
      id="connexions"
      title="Dernières connexions"
      aside={
        onSeeAll ? (
          <Button variant="link" onClick={onSeeAll}>
            Tout voir, {formatInteger(detail.logins.total)}
          </Button>
        ) : undefined
      }
    >
      {rows.length === 0 ? (
        <EmptyLine>Aucune connexion enregistrée.</EmptyLine>
      ) : (
        <DataTable label="Dernières connexions" Link={Link} columns={loginColumns} rows={rows} rowKey={(row) => row.id} />
      )}
    </Section>
  );
}

function ContactSection({ detail }: { detail: AccountDetail }) {
  return (
    <Section id="coordonnees" title="Coordonnées">
      <KeyValueList
        items={[
          { label: 'E-mail', value: detail.account.email },
          { label: 'Mobile', value: detail.contact.mobile },
          { label: 'Langue', value: detail.contact.language },
          { label: 'Mot de passe', value: `Modifié le ${formatDate(detail.contact.passwordChangedOn)}` },
        ]}
      />
    </Section>
  );
}

function SecuritySection({ detail, onRevoke }: { detail: AccountDetail; onRevoke: () => void }) {
  const { security } = detail;
  return (
    <Section
      id="securite-compte"
      title="Sécurité"
      aside={
        <Button variant="secondary" size="sm" disabled={security.sessions === 0} onClick={onRevoke}>
          <Icon icon={Power} />
          Révoquer les sessions
        </Button>
      }
    >
      <KeyValueList
        items={[
          { label: '2FA', value: detail.account.twoFactor ? security.method : 'Non activée' },
          { label: 'Codes de secours', value: `${String(security.backupCodesLeft)} sur ${String(security.backupCodesTotal)} restants` },
          { label: 'Sessions actives', value: plural(security.sessions, 'appareil') },
          { label: 'Dernier échec', value: security.lastFailure },
        ]}
      />
    </Section>
  );
}
