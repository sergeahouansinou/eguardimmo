'use client';

import { Send } from 'lucide-react';
import { useState } from 'react';
import { Alert, Button, Card, CardTitle, Icon, TextField, Textarea, cx } from '@eguardimmo/ui';
import { PageHeader, QueryState, pushFlash } from '../../outils/kit';
import type { ScreenProps } from '../../outils/kit';
import { PlanLimitAlert } from '../../orgapi/PlanLimitAlert';
import { isPlanLimitError } from '../../orgapi/planLimit';
import { teamErrorMessage } from './errors';
import { RoleRights } from './RoleRights';
import { seatsUsed } from './rules';
import { INVITABLE_ROLES, ROLE_LABELS, ROLE_SUMMARIES, inviteSchema } from './schemas';
import type { InvitableRole, TeamData } from './schemas';
import { useInviteMember, useTeam } from './source';

interface Draft {
  firstName: string;
  lastName: string;
  email: string;
  role: InvitableRole;
  message: string;
}

const INITIAL: Draft = { firstName: '', lastName: '', email: '', role: 'comptable', message: '' };

function RoleChoices({ value, onChange }: { value: InvitableRole; onChange: (role: InvitableRole) => void }) {
  return (
    <Card role="group" aria-labelledby="ei-r" className="px-4 py-3">
      <CardTitle as="h2" id="ei-r">
        Rôle *
      </CardTitle>
      <div role="radiogroup" aria-labelledby="ei-r" className="flex flex-col gap-2">
        {INVITABLE_ROLES.map((role) => {
          const checked = role === value;
          return (
            <div
              key={role}
              className={cx(
                'relative flex items-center gap-2.5 rounded-lg border px-3 py-2.5 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus',
                checked ? 'border-2 border-action bg-action-subtle px-[11px] py-[9px]' : 'border-line',
              )}
            >
              <input id={`ei-role-${role}`} type="radio" name="role" value={role} checked={checked} onChange={() => { onChange(role); }} className="size-4 accent-action" />
              <label htmlFor={`ei-role-${role}`} className="flex min-w-0 cursor-pointer flex-col after:absolute after:inset-0">
                <b className="text-body font-medium text-fg">{ROLE_LABELS[role]}</b>
                <span className="text-caption text-fg-subtle">{ROLE_SUMMARIES[role]}</span>
              </label>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function InviteForm({ Link, navigate, team }: ScreenProps & { team: TeamData }) {
  const invite = useInviteMember();
  const [draft, setDraft] = useState(INITIAL);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [planError, setPlanError] = useState<unknown>(null);
  const full = team.seatLimit !== null && seatsUsed(team.members) >= team.seatLimit;
  const set = (patch: Partial<Draft>) => {
    setDraft((previous) => ({ ...previous, ...patch }));
    setErrors({});
  };

  const submit = () => {
    const parsed = inviteSchema.safeParse({
      firstName: draft.firstName,
      lastName: draft.lastName,
      email: draft.email,
      role: draft.role,
      scope: { type: 'all' },
      message: draft.message,
    });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0] ?? 'form')] ??= issue.message;
      setErrors(next);
      return;
    }
    setFailure(null);
    setPlanError(null);
    invite.mutate(parsed.data, {
      onSuccess: (member) => {
        pushFlash(`Invitation envoyée à ${member.email}.`);
        navigate('/equipe');
      },
      onError: (error) => {
        if (isPlanLimitError(error)) {
          setPlanError(error);
          return;
        }
        setFailure(teamErrorMessage(error, "L'invitation n'a pas pu être envoyée. Réessayez."));
      },
    });
  };

  return (
    <>
      {full ? (
        <Alert tone="warning" title="Aucune place disponible">
          Toutes les places de la formule {team.planName} sont utilisées. Annulez une invitation en attente ou{' '}
          <Link href="/compte/abonnement" className="font-medium underline">
            changez de formule
          </Link>
          .
        </Alert>
      ) : null}
      <PlanLimitAlert error={planError} Link={Link} />
      {failure ? <Alert tone="danger" title="L'invitation n'a pas pu être envoyée">{failure}</Alert> : null}
      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-3">
          <Card role="region" aria-labelledby="ei-m" className="px-4 py-3">
            <CardTitle as="h2" id="ei-m">
              Membre
            </CardTitle>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextField label="Prénom *" placeholder="Ex. : Fatou" autoComplete="off" value={draft.firstName} error={errors.firstName} onChange={(event) => { set({ firstName: event.target.value }); }} />
              <TextField label="Nom *" placeholder="Ex. : Ndiaye" autoComplete="off" value={draft.lastName} error={errors.lastName} onChange={(event) => { set({ lastName: event.target.value }); }} />
            </div>
            <TextField
              label="E-mail *"
              type="email"
              placeholder="Ex. : fatou.ndiaye@example.com"
              hint="L'invitation est envoyée à cette adresse."
              autoComplete="off"
              value={draft.email}
              error={errors.email}
              onChange={(event) => { set({ email: event.target.value }); }}
            />
          </Card>
          <RoleChoices value={draft.role} onChange={(role) => { set({ role }); }} />
          <Card role="region" aria-labelledby="ei-b" className="px-4 py-3">
            <CardTitle as="h2" id="ei-b">
              Biens accessibles
            </CardTitle>
            <p className="text-body font-medium text-fg">Tous les biens</p>
            <span className="text-caption text-fg-subtle">
              Le périmètre limité à certains biens n'est pas appliqué par le serveur : le membre voit tous les biens, y compris ceux ajoutés plus tard, dans la limite des droits de son rôle.
            </span>
          </Card>
          <Card role="region" aria-labelledby="ei-msg" className="px-4 py-3">
            <CardTitle as="h2" id="ei-msg">
              Message
            </CardTitle>
            <Textarea
              label="Message personnel"
              placeholder="Ex. : Bonjour Fatou, voici ton accès pour suivre les loyers."
              value={draft.message}
              error={errors.message}
              onChange={(event) => { set({ message: event.target.value }); }}
            />
          </Card>
        </div>
        <aside className="flex min-w-0 flex-col gap-3">
          <RoleRights role={draft.role} Link={Link} />
          {team.twoFactorRequired ? <Alert tone="warning">Double authentification exigée à la connexion.</Alert> : null}
        </aside>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" asChild>
          <Link href="/equipe">Annuler</Link>
        </Button>
        <Button onClick={submit} loading={invite.isPending} disabled={full}>
          <Icon icon={Send} />
          Envoyer l'invitation
        </Button>
      </div>
    </>
  );
}

export function EquipeInvitePage(props: ScreenProps) {
  const query = useTeam();
  return (
    <>
      <PageHeader
        Link={props.Link}
        crumbs={[{ label: 'Équipe', href: '/equipe' }, { label: 'Inviter un membre' }]}
        title="Inviter un membre"
        description="Le membre reçoit un lien valable 7 jours pour créer son accès."
      />
      <QueryState query={query} errorTitle="L'équipe n'a pas pu être chargée" loadingLabel="Chargement de l'équipe">
        {(team) => <InviteForm {...props} team={team} />}
      </QueryState>
    </>
  );
}
