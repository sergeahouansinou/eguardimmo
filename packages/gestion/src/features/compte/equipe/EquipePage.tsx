'use client';

import { ScrollText, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { Alert, Button, Card, Icon, Select, Tab, TabList, TabPanel, Tabs, TextField } from '@eguardimmo/ui';
import { EmptyBlock, PageHeader, QueryState, pushFlash } from '../../outils/kit';
import type { ScreenProps } from '../../outils/kit';
import { teamErrorMessage } from './errors';
import { MemberDialogs } from './MemberDialogs';
import type { DialogState } from './MemberDialogs';
import { MemberTable } from './MemberTable';
import type { MemberAction } from './MemberTable';
import { RolesCard, SecurityCard } from './RoleCards';
import { fullName, seatsUsed } from './rules';
import { ROLES, ROLE_LABELS } from './schemas';
import type { Member, TeamData } from './schemas';
import { useTeam, useTeamActions } from './source';

type TabId = 'tous' | 'actifs' | 'invitations' | 'desactives';

const TAB_STATUS: Record<Exclude<TabId, 'tous'>, Member['status']> = { actifs: 'actif', invitations: 'invite', desactives: 'desactive' };
const TAB_LABELS: Record<TabId, string> = { tous: 'Tous', actifs: 'Actifs', invitations: 'Invitations', desactives: 'Désactivés' };
const TAB_IDS = ['tous', 'actifs', 'invitations', 'desactives'] as const;

const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function seatsMessage(team: TeamData): string {
  const active = team.members.filter((member) => member.status === 'actif').length;
  const invited = team.members.filter((member) => member.status === 'invite').length;
  if (team.seatLimit === null) return `Formule ${team.planName} : plusieurs membres inclus.`;
  const base = `Formule ${team.planName} : ${String(active)} ${active > 1 ? 'membres actifs' : 'membre actif'} sur ${String(team.seatLimit)}.`;
  if (invited > 0 && seatsUsed(team.members) >= team.seatLimit) {
    return `${base} ${invited > 1 ? 'Les invitations en attente occuperont' : "L'invitation en attente occupera"} la dernière place.`;
  }
  const free = team.seatLimit - seatsUsed(team.members);
  const tail = free <= 0 ? 'Aucune place disponible.' : free === 1 ? '1 place disponible.' : `${String(free)} places disponibles.`;
  return `${base} ${tail}`;
}

function TeamContent({ Link, team }: { Link: ScreenProps['Link']; team: TeamData }) {
  const actions = useTeamActions();
  const [tab, setTab] = useState<TabId>('tous');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [dialog, setDialog] = useState<DialogState>(null);
  const [error, setError] = useState<string | null>(null);

  const countFor = (id: TabId) => (id === 'tous' ? team.members.length : team.members.filter((member) => member.status === TAB_STATUS[id]).length);
  const needle = fold(search.trim());
  const rows = team.members.filter((member) => {
    if (tab !== 'tous' && member.status !== TAB_STATUS[tab]) return false;
    if (roleFilter !== 'all' && member.role !== roleFilter) return false;
    return needle === '' || fold(`${fullName(member)} ${member.email}`).includes(needle);
  });

  const run = async (task: () => Promise<unknown>, message: string) => {
    setError(null);
    try {
      await task();
      pushFlash(message);
    } catch (failure) {
      setError(teamErrorMessage(failure, "L'opération a échoué. Réessayez."));
    }
    setDialog(null);
  };

  const onAction = (action: MemberAction, member: Member) => {
    const name = fullName(member);
    if (action === 'resend') void run(() => actions.resend.mutateAsync(member.id), `Invitation renvoyée à ${member.email}.`);
    else if (action === 'reactivate') void run(() => actions.reactivate.mutateAsync(member.id), `${name} est de nouveau actif.`);
    else setDialog({ kind: action, member });
  };

  const pending = [actions.remove, actions.cancelInvitation, actions.deactivate, actions.changeRole, actions.changeScope].some((mutation) => mutation.isPending);
  const roleOptions = [{ value: 'all', label: 'Rôle : Tous' }, ...ROLES.map((role) => ({ value: role, label: `Rôle : ${ROLE_LABELS[role]}` }))];

  return (
    <>
      <Alert tone="info">{seatsMessage(team)}</Alert>
      {error ? <Alert tone="danger" title="Opération impossible">{error}</Alert> : null}
      <Card role="region" aria-label="Liste des membres" className="px-4 py-3">
        <Tabs value={tab} defaultValue="tous" onValueChange={(value) => { setTab(TAB_IDS.find((id) => id === value) ?? 'tous'); }}>
          <TabList aria-label="Filtrer les membres par état">
            {TAB_IDS.map((id) => (
              <Tab key={id} value={id} count={countFor(id)}>
                {TAB_LABELS[id]}
              </Tab>
            ))}
          </TabList>
          <div className="flex flex-wrap items-end gap-2">
            <TextField
              label="Rechercher un membre"
              hideLabel
              type="search"
              placeholder="Nom, e-mail"
              className="sm:w-60"
              value={search}
              onChange={(event) => { setSearch(event.target.value); }}
            />
            <Select label="Filtrer par rôle" hideLabel placeholder="Rôle : Tous" className="w-full sm:w-[180px]" options={roleOptions} value={roleFilter} onValueChange={setRoleFilter} />
          </div>
          <TabPanel value={tab}>
            {rows.length === 0 ? (
              <EmptyBlock title="Aucun membre ne correspond">Modifiez la recherche ou le filtre de rôle.</EmptyBlock>
            ) : (
              <MemberTable Link={Link} rows={rows} members={team.members} onAction={onAction} />
            )}
          </TabPanel>
          <div className="border-t border-line pt-2 text-caption text-fg-subtle" aria-live="polite">
            {`${rows.length === 0 ? '0' : '1'} à ${String(rows.length)} sur ${String(rows.length)}`}
          </div>
        </Tabs>
      </Card>
      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <RolesCard Link={Link} />
        <SecurityCard
          required={team.twoFactorRequired}
          pending={actions.setTwoFactorRequired.isPending}
          onChange={(required) => {
            void run(() => actions.setTwoFactorRequired.mutateAsync(required), required ? 'Double authentification exigée pour tous les membres.' : "Double authentification facultative pour les membres.");
          }}
        />
      </div>
      <MemberDialogs
        dialog={dialog}
        pending={pending}
        onClose={() => { setDialog(null); }}
        onRemove={(member) => { void run(() => actions.remove.mutateAsync(member.id), `${fullName(member)} a été retiré du compte.`); }}
        onCancel={(member) => { void run(() => actions.cancelInvitation.mutateAsync(member.id), `Invitation de ${fullName(member)} annulée.`); }}
        onDeactivate={(member) => { void run(() => actions.deactivate.mutateAsync(member.id), `${fullName(member)} a été désactivé.`); }}
        onRole={(member, role) => { void run(() => actions.changeRole.mutateAsync({ id: member.id, role }), `Rôle de ${fullName(member)} : ${ROLE_LABELS[role]}.`); }}
        onScope={(member) => { void run(() => actions.changeScope.mutateAsync({ id: member.id, scope: { type: 'all' } }), `${fullName(member)} a accès à tous les biens.`); }}
      />
    </>
  );
}

export function EquipePage({ Link, journal = true }: ScreenProps & { journal?: boolean }) {
  const query = useTeam();
  return (
    <>
      <PageHeader
        Link={Link}
        crumbs={[{ label: 'Compte', href: '/compte' }, { label: 'Équipe' }]}
        title="Équipe"
        description="Personnes qui gèrent le compte avec vous. Le rôle limite ce que chacune voit et modifie."
        actions={
          <>
            {journal ? (
              <Button variant="ghost" asChild>
                <Link href="/journal">
                  <Icon icon={ScrollText} />
                  Journal d'activité
                </Link>
              </Button>
            ) : null}
            <Button asChild>
              <Link href="/equipe/inviter">
                <Icon icon={UserPlus} />
                Inviter un membre
              </Link>
            </Button>
          </>
        }
      />
      <QueryState query={query} errorTitle="L'équipe n'a pas pu être chargée" loadingLabel="Chargement de l'équipe">
        {(team) => <TeamContent Link={Link} team={team} />}
      </QueryState>
    </>
  );
}
