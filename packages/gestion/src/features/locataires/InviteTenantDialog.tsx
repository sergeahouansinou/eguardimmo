'use client';

import { Button, Dialog, DialogClose, DialogContent, Select, TextField } from '@eguardimmo/ui';
import { errorMessage, useNotify } from './kit';
import { useZodForm } from './kit/useZodForm';
import { useInviteTenant, useUnits } from './hooks';
import { tenantInviteSchema, unitFullLabel } from './schemas';

const EMPTY = { email: '', firstName: '', lastName: '', unitId: '' };

export function InviteTenantDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const form = useZodForm(tenantInviteSchema, EMPTY);
  const units = useUnits();
  const invite = useInviteTenant();
  const notify = useNotify();

  const submit = async () => {
    const values = form.submit();
    if (!values) return;
    try {
      await invite.mutateAsync(values);
      notify({ title: 'Invitation envoyée', description: `${values.firstName} ${values.lastName} recevra un lien à ${values.email}.` });
      form.reset(EMPTY);
      onOpenChange(false);
    } catch (error) {
      notify({ tone: 'danger', title: 'Invitation impossible', description: errorMessage(error) });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Inviter un locataire" description="Le locataire reçoit un lien pour créer son espace et compléter son dossier.">
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
          className="flex flex-col gap-3 p-4"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TextField
              label="Prénom *"
              placeholder="Ex. Mariam"
              value={form.values.firstName}
              error={form.error('firstName')}
              data-autofocus
              onChange={(event) => { form.setValue('firstName', event.target.value); }}
              onBlur={() => { form.touch('firstName'); }}
            />
            <TextField
              label="Nom *"
              placeholder="Ex. Sy"
              value={form.values.lastName}
              error={form.error('lastName')}
              onChange={(event) => { form.setValue('lastName', event.target.value); }}
              onBlur={() => { form.touch('lastName'); }}
            />
          </div>
          <TextField
            label="E-mail *"
            type="email"
            placeholder="prenom.nom@example.com"
            value={form.values.email}
            error={form.error('email')}
            onChange={(event) => { form.setValue('email', event.target.value); }}
            onBlur={() => { form.touch('email'); }}
          />
          <Select
            label="Bien concerné"
            placeholder="Choisir un bien (facultatif)"
            searchable
            value={form.values.unitId}
            onValueChange={(value) => { form.setValue('unitId', value); }}
            options={(units.data ?? []).map((unit) => ({ value: unit.id, label: unitFullLabel(unit) }))}
          />
          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <DialogClose asChild>
              <Button variant="ghost">Annuler</Button>
            </DialogClose>
            <Button type="submit" loading={invite.isPending}>
              Envoyer l’invitation
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
