'use client';

import { Ellipsis, ShieldCheck, TriangleAlert } from 'lucide-react';
import { Avatar, Badge, Button, Icon, IconButton, Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@eguardimmo/ui';
import type { LinkComponent } from '@eguardimmo/ui';
import { DataTable, Td, Th, useReferenceDay } from '../../outils/kit';
import { lastLoginLabel, scopeLabel } from './format';
import { deactivationBlock, fullName, removalBlock, roleChangeBlock } from './rules';
import { ROLE_LABELS } from './schemas';
import type { Member } from './schemas';

export type MemberAction = 'resend' | 'cancel' | 'role' | 'scope' | 'deactivate' | 'reactivate' | 'remove';

function blockTag(member: Member): string {
  if (member.role === 'titulaire') return 'Titulaire';
  return member.self ? 'Vous' : 'Seul admin';
}

function RowMenu({ member, members, onAction }: { member: Member; members: readonly Member[]; onAction: (action: MemberAction, member: Member) => void }) {
  const name = fullName(member);
  const roleBlocked = roleChangeBlock(member, members) !== null;
  const removeBlocked = removalBlock(member, members) !== null;
  const deactivateBlocked = deactivationBlock(member, members) !== null;
  return (
    <Menu>
      <MenuTrigger asChild>
        <IconButton label={`Plus d'actions pour ${name}`} icon={Ellipsis} />
      </MenuTrigger>
      <MenuContent aria-label="Actions de la ligne">
        {member.status === 'invite' ? (
          <MenuItem onSelect={() => { onAction('resend', member); }}>Renvoyer l'invitation</MenuItem>
        ) : null}
        <MenuItem disabled={roleBlocked} meta={roleBlocked ? blockTag(member) : undefined} onSelect={() => { onAction('role', member); }}>
          Modifier le rôle
        </MenuItem>
        <MenuItem onSelect={() => { onAction('scope', member); }}>Modifier les biens accessibles</MenuItem>
        <MenuSeparator />
        {member.status === 'actif' ? (
          <MenuItem disabled={deactivateBlocked} meta={deactivateBlocked ? blockTag(member) : undefined} onSelect={() => { onAction('deactivate', member); }}>
            Désactiver
          </MenuItem>
        ) : null}
        {member.status === 'invite' ? (
          <MenuItem tone="danger" onSelect={() => { onAction('cancel', member); }}>
            Annuler l'invitation
          </MenuItem>
        ) : (
          <MenuItem tone="danger" disabled={removeBlocked} meta={removeBlocked ? blockTag(member) : undefined} onSelect={() => { onAction('remove', member); }}>
            Retirer du compte
          </MenuItem>
        )}
      </MenuContent>
    </Menu>
  );
}

function TwoFactor({ member }: { member: Member }) {
  if (member.twoFactor === 'activee') {
    return (
      <span className="inline-flex items-center gap-1 text-success-fg">
        <Icon icon={ShieldCheck} />
        Activée
      </span>
    );
  }
  if (member.twoFactor === 'non-activee') {
    return (
      <span className="inline-flex items-center gap-1 text-warning-fg">
        <Icon icon={TriangleAlert} />
        Non activée
      </span>
    );
  }
  return <span className="text-caption text-fg-subtle">À l'acceptation</span>;
}

function StatusBadge({ status }: { status: Member['status'] }) {
  if (status === 'actif') return <Badge tone="success">Actif</Badge>;
  if (status === 'invite') return <Badge tone="warning">Invitation envoyée</Badge>;
  return <Badge>Désactivé</Badge>;
}

export interface MemberTableProps {
  Link: LinkComponent;
  rows: readonly Member[];
  members: readonly Member[];
  onAction: (action: MemberAction, member: Member) => void;
}

export function MemberTable({ Link, rows, members, onAction }: MemberTableProps) {
  const today = useReferenceDay();
  return (
    <DataTable caption="Membres de l'équipe">
      <thead>
        <tr>
          <Th>Membre</Th>
          <Th>Rôle</Th>
          <Th>Biens</Th>
          <Th>Double auth.</Th>
          <Th>Dernière connexion</Th>
          <Th>État</Th>
          <Th>
            <span className="sr-only">Actions</span>
          </Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((member) => {
          const name = fullName(member);
          return (
            <tr key={member.id} className={member.status === 'desactive' ? 'text-fg-subtle' : undefined}>
              <Td strong className="h-12">
                <span className="flex items-center gap-2">
                  <Avatar size="md" initials={`${member.firstName.slice(0, 1)}${member.lastName.slice(0, 1)}`} />
                  <span className="flex flex-col">
                    <span>
                      {name}
                      {member.self ? <span className="text-caption font-normal text-fg-subtle"> (vous)</span> : null}
                    </span>
                    <span className="text-caption font-normal text-fg-subtle">{member.email}</span>
                  </span>
                </span>
              </Td>
              <Td>
                <Badge tone={member.role === 'titulaire' || member.role === 'administrateur' ? 'info' : 'neutral'}>{ROLE_LABELS[member.role]}</Badge>
              </Td>
              <Td>{scopeLabel(member)}</Td>
              <Td>
                <TwoFactor member={member} />
              </Td>
              <Td>{lastLoginLabel(member, today)}</Td>
              <Td>
                <StatusBadge status={member.status} />
              </Td>
              <Td>
                <span className="flex items-center justify-end gap-1">
                  {member.role === 'titulaire' ? (
                    <Button variant="link" size="sm" asChild>
                      <Link href="/compte">
                        Modifier<span className="sr-only"> {name}</span>
                      </Link>
                    </Button>
                  ) : (
                    <>
                      {member.status === 'invite' ? (
                        <Button variant="link" size="sm" onClick={() => { onAction('resend', member); }}>
                          Renvoyer<span className="sr-only"> l'invitation à {name}</span>
                        </Button>
                      ) : null}
                      {member.status === 'desactive' ? (
                        <Button variant="link" size="sm" onClick={() => { onAction('reactivate', member); }}>
                          Réactiver<span className="sr-only"> {name}</span>
                        </Button>
                      ) : null}
                      <RowMenu member={member} members={members} onAction={onAction} />
                    </>
                  )}
                </span>
              </Td>
            </tr>
          );
        })}
      </tbody>
    </DataTable>
  );
}
