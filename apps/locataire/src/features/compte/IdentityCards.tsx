'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Icon, TextField } from '@eguardimmo/ui';
import { Check } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { FailureAlert } from '@/components/FailureAlert';
import { useFlash } from '@/components/flash';
import { SectionCard } from '@/components/Section';
import { ACCOUNT_WORDING } from '@/tenant/accountLabels';
import { useUpdateName, useUpdatePhone } from '@/tenant/accountQueries';
import type { AccountProfile } from '@/tenant/accountSchemas';
import { PHONE_MAX, nameFormSchema, phoneFormSchema } from './accountForms';
import type { NameValues, PhoneValues } from './accountForms';

export function NameCard({ profile }: { profile: AccountProfile }) {
  const update = useUpdateName();
  const show = useFlash((state) => state.show);
  const { register, handleSubmit, formState } = useForm<NameValues>({ resolver: zodResolver(nameFormSchema), defaultValues: { name: profile.name } });
  const submit = handleSubmit((values) => {
    update.mutate(values.name, { onSuccess: () => { show({ tone: 'success', title: 'Nom enregistré', detail: 'Votre nom a été mis à jour.', path: '/compte/modifier' }); } });
  });
  return (
    <SectionCard id="mo-nom" title="Nom">
      <form onSubmit={(event) => { void submit(event); }} noValidate className="flex flex-col gap-3">
        {update.isError ? <FailureAlert title="Le nom n’a pas pu être enregistré" error={update.error} wording={ACCOUNT_WORDING} /> : null}
        <TextField label="Nom complet *" placeholder="Camille Martin" autoComplete="name" {...register('name')} error={formState.errors.name?.message} />
        <div className="flex justify-end">
          <Button type="submit" loading={update.isPending} disabled={!formState.isDirty}>
            <Icon icon={Check} />
            Enregistrer le nom
          </Button>
        </div>
      </form>
    </SectionCard>
  );
}

export function PhoneCard({ profile }: { profile: AccountProfile }) {
  const update = useUpdatePhone();
  const show = useFlash((state) => state.show);
  const { register, handleSubmit, formState } = useForm<PhoneValues>({ resolver: zodResolver(phoneFormSchema), defaultValues: { phone: profile.phone ?? '' } });
  const submit = handleSubmit((values) => {
    const phone = values.phone.trim() === '' ? null : values.phone.trim();
    update.mutate(phone, {
      onSuccess: () => {
        show({ tone: 'success', title: phone === null ? 'Téléphone retiré' : 'Téléphone enregistré', detail: 'Votre compte a été mis à jour.', path: '/compte/modifier' });
      },
    });
  });
  return (
    <SectionCard id="mo-telephone" title="Téléphone">
      <form onSubmit={(event) => { void submit(event); }} noValidate className="flex flex-col gap-3">
        {update.isError ? <FailureAlert title="Le téléphone n’a pas pu être enregistré" error={update.error} wording={ACCOUNT_WORDING} /> : null}
        <TextField
          label="Téléphone (facultatif)"
          placeholder="+33 6 12 34 56 78"
          type="tel"
          autoComplete="tel"
          maxLength={PHONE_MAX}
          hint="Format international. Laissez vide pour retirer votre numéro."
          {...register('phone')}
          error={formState.errors.phone?.message}
        />
        <div className="flex justify-end">
          <Button type="submit" loading={update.isPending} disabled={!formState.isDirty}>
            <Icon icon={Check} />
            Enregistrer le téléphone
          </Button>
        </div>
      </form>
    </SectionCard>
  );
}
