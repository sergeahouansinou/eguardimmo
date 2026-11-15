'use client';

import { useState } from 'react';
import { Button, Dialog, DialogClose, DialogContent, RadioGroup } from '@eguardimmo/ui';
import { Checkbox, ConfirmDialog, Segmented } from '../../outils/kit';
import { fullName } from './rules';
import { BUILDINGS, INVITABLE_ROLES, ROLE_LABELS, ROLE_SUMMARIES } from './schemas';
import type { InvitableRole, Member, Scope } from './schemas';

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

export function ScopeDialog({ member, pending, onClose, onSave }: Common & { onSave: (scope: Scope) => void }) {
  const [type, setType] = useState<Scope['type']>(member.scope.type);
  const [selected, setSelected] = useState<readonly string[]>(member.scope.type === 'selected' ? member.scope.buildings : []);
  const [problem, setProblem] = useState<string | null>(null);
  const save = () => {
    if (type === 'all') {
      onSave({ type: 'all' });
      return;
    }
    const buildings = BUILDINGS.filter((name) => selected.includes(name));
    if (buildings.length === 0) {
      setProblem('Choisissez au moins un bien.');
      return;
    }
    setProblem(null);
    onSave({ type: 'selected', buildings });
  };
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent title={`Biens accessibles à ${fullName(member)}`} description="Les biens ajoutés plus tard seront accessibles si « Tous les biens » est choisi." className="max-w-md">
        <div className="flex flex-col gap-3 p-4">
          <Segmented
            label="Biens accessibles"
            value={type}
            onValueChange={setType}
            options={[
              { value: 'all', label: 'Tous les biens' },
              { value: 'selected', label: 'Biens choisis' },
            ]}
          />
          {type === 'selected' ? (
            <div className="flex flex-col gap-2">
              {BUILDINGS.map((name) => (
                <Checkbox
                  key={name}
                  label={name}
                  checked={selected.includes(name)}
                  onCheckedChange={(checked) => { setSelected((previous) => (checked ? [...previous, name] : previous.filter((item) => item !== name))); }}
                />
              ))}
              {problem ? <p className="text-caption text-fg-danger">{problem}</p> : null}
            </div>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2">
            <DialogClose asChild>
              <Button variant="secondary">Annuler</Button>
            </DialogClose>
            <Button loading={pending} onClick={save} data-autofocus>
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
  onScope: (member: Member, scope: Scope) => void;
}

export function MemberDialogs({ dialog, pending, onClose, onRemove, onCancel, onDeactivate, onRole, onScope }: DialogsProps) {
  if (!dialog) return null;
  const { member } = dialog;
  const name = fullName(member);
  if (dialog.kind === 'role') return <RoleDialog member={member} pending={pending} onClose={onClose} onSave={(role) => { onRole(member, role); }} />;
  if (dialog.kind === 'scope') return <ScopeDialog member={member} pending={pending} onClose={onClose} onSave={(scope) => { onScope(member, scope); }} />;
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
      pending={pending}
      onConfirm={() => { confirm.run(member); }}
    />
  );
}
