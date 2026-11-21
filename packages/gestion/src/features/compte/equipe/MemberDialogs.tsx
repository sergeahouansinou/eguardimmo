'use client';

import { useState } from 'react';
import { Button, Dialog, DialogClose, DialogContent, RadioGroup } from '@eguardimmo/ui';
import { ConfirmDialog } from '../../outils/kit';
import { fullName } from './rules';
import { INVITABLE_ROLES, ROLE_LABELS, ROLE_SUMMARIES } from './schemas';
import type { InvitableRole, Member } from './schemas';

export type DialogState =
  | { kind: 'remove' | 'cancel' | 'deactivate' | 'role' | 'scope'; member: Member }
  | null;

interface Common {
  member: Member;
  pending: boolean;
  onClose: () => void;
}

export function RoleDialog({ member, pending, onClose, onSave }: Common & { onSave: (role: InvitableRole) => void }) {
  const [role, setRole] = useState<InvitableRole>(INVITABLE_ROLES.find((candidate) => candidate === member.role) ?? 'comptable');
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent title={`Modifier le rôle de ${fullName(member)}`} description="Le rôle limite ce que le membre voit et modifie." className="max-w-md">
        <div className="flex flex-col gap-3 p-4">
          <RadioGroup
            label="Rôle"
            value={role}
            onValueChange={(value) => { setRole(INVITABLE_ROLES.find((candidate) => candidate === value) ?? role); }}
            options={INVITABLE_ROLES.map((value) => ({ value, label: `${ROLE_LABELS[value]} : ${ROLE_SUMMARIES[value]}` }))}
          />
          <div className="flex flex-wrap justify-end gap-2">
            <DialogClose asChild>
              <Button variant="secondary">Annuler</Button>
            </DialogClose>
            <Button loading={pending} onClick={() => { onSave(role); }} data-autofocus>
              Enregistrer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export interface DialogsProps {
  dialog: DialogState;
  pending: boolean;
  onClose: () => void;
  onRemove: (member: Member) => void;
  onCancel: (member: Member) => void;
  onDeactivate: (member: Member) => void;
  onRole: (member: Member, role: InvitableRole) => void;
  onScope: (member: Member) => void;
}

export function MemberDialogs({ dialog, pending, onClose, onRemove, onCancel, onDeactivate, onRole, onScope }: DialogsProps) {
  if (!dialog) return null;
  const { member } = dialog;
  const name = fullName(member);
  if (dialog.kind === 'role') return <RoleDialog member={member} pending={pending} onClose={onClose} onSave={(role) => { onRole(member, role); }} />;
  const confirm = {
    remove: {
      title: `Retirer ${name} du compte ?`,
      description: 'Le membre perd immédiatement son accès. Ses actions passées restent dans le journal d\'activité.',
      confirmLabel: 'Retirer du compte',
      run: onRemove,
    },
    cancel: {
      title: `Annuler l'invitation de ${name} ?`,
      description: 'Le lien envoyé ne fonctionnera plus. Vous pourrez inviter à nouveau cette personne.',
      confirmLabel: "Annuler l'invitation",
      run: onCancel,
    },
    scope: {
      title: `Rétablir l'accès à tous les biens pour ${name} ?`,
      description: "Le périmètre limité à certains biens n'est pas appliqué par le serveur : ce membre voit déjà tous les biens. Cette action met sa fiche en accord avec cet état.",
      confirmLabel: 'Rétablir « Tous les biens »',
      run: onScope,
    },
    deactivate: {
      title: `Désactiver ${name} ?`,
      description: 'Le membre ne pourra plus se connecter, sans perdre son historique. Vous pourrez le réactiver.',
      confirmLabel: 'Désactiver',
      run: onDeactivate,
    },
  }[dialog.kind];
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => { if (!open) onClose(); }}
      title={confirm.title}
      description={confirm.description}
      confirmLabel={confirm.confirmLabel}
      cancelLabel="Garder"
      tone={dialog.kind === 'scope' ? 'primary' : 'danger'}
      pending={pending}
      onConfirm={() => { confirm.run(member); }}
    />
  );
}
