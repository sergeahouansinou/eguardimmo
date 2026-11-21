'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Icon, Select } from '@eguardimmo/ui';
import { Send } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { CheckboxField } from '@/components/CheckboxField';
import { FailureAlert } from '@/components/FailureAlert';
import { useFlash } from '@/components/flash';
import { EmptyLine, ListRow, SectionCard } from '@/components/Section';
import { StatusBadge } from '@/components/StatusBadge';
import { Skeleton } from '@/components/ScreenState';
import { formatDateTime } from '@/lib/dates';
import { ACCOUNT_WORDING, CONTACT_FIELD_LABEL, CONTACT_STATUS_VIEW } from '@/tenant/accountLabels';
import { useContactUpdates, useRequestContactUpdate } from '@/tenant/accountQueries';
import { CONTACT_FIELDS } from '@/tenant/accountSchemas';
import { useAttemptKey } from '@/tenant/clientId';
import { useLinks } from '@/tenant/queries';
import { LoadMore } from '../rent/LoadMore';
import { contactFormSchema } from './contactForm';
import type { ContactValues } from './contactForm';

export function ContactUpdatesCard() {
  const links = useLinks();
  const updates = useContactUpdates();
  const create = useRequestContactUpdate();
  const attemptKey = useAttemptKey();
  const show = useFlash((state) => state.show);
  const { handleSubmit, control, formState } = useForm<ContactValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: { organizationId: '', fields: ['email', 'phone'] },
  });

  if (links.data === undefined) {
    return (
      <SectionCard id="mo-agences" title="Transmettre à mes agences">
        {links.isError ? <FailureAlert title="Vos agences n’ont pas pu être chargées" error={links.error} wording={ACCOUNT_WORDING} onRetry={() => void links.refetch()} /> : <Skeleton rows={1} />}
      </SectionCard>
    );
  }
  const organizations = [...new Map(links.data.map((link) => [link.organization.id, link.organization])).values()];
  const nameOf = (id: string): string => organizations.find((item) => item.id === id)?.name ?? 'Agence';
  const items = updates.data?.pages.flatMap((page) => page.items) ?? [];

  const submit = handleSubmit((values) => {
    const fields = CONTACT_FIELDS.filter((field) => values.fields.includes(field));
    const clientId = attemptKey([values.organizationId, ...fields].join('|'));
    create.mutate(
      { organizationId: values.organizationId, fields, clientId },
      { onSuccess: () => { show({ tone: 'success', title: 'Coordonnées transmises', detail: `${nameOf(values.organizationId)} les traitera prochainement.`, path: '/compte/modifier' }); } },
    );
  });

  return (
    <SectionCard id="mo-agences" title="Transmettre à mes agences">
      <p className="text-body text-fg-muted">Vos coordonnées de compte ne modifient pas d’elles-mêmes votre dossier chez l’agence : transmettez-les-lui pour qu’elle les applique.</p>
      {organizations.length === 0 ? (
        <EmptyLine>Aucune agence n’est rattachée à votre compte.</EmptyLine>
      ) : (
        <form onSubmit={(event) => { void submit(event); }} noValidate className="flex flex-col gap-3">
          {create.isError ? <FailureAlert title="La transmission a échoué" error={create.error} wording={ACCOUNT_WORDING} /> : null}
          <Controller
            control={control}
            name="organizationId"
            render={({ field }) => (
              <Select
                label="Agence *"
                placeholder="Choisir une agence"
                value={field.value}
                options={organizations.map((item) => ({ value: item.id, label: item.name ?? 'Agence' }))}
                onValueChange={field.onChange}
                error={formState.errors.organizationId?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="fields"
            render={({ field }) => (
              <fieldset className="flex flex-col gap-2">
                <legend className="text-caption text-fg-muted">Coordonnées à transmettre</legend>
                {CONTACT_FIELDS.map((item) => (
                  <CheckboxField
                    key={item}
                    checked={field.value.includes(item)}
                    onChange={(event) => { field.onChange(event.target.checked ? [...field.value, item] : field.value.filter((value) => value !== item)); }}
                  >
                    {CONTACT_FIELD_LABEL[item]}
                  </CheckboxField>
                ))}
                {formState.errors.fields ? <p role="alert" className="text-caption text-fg-danger">{formState.errors.fields.message}</p> : null}
              </fieldset>
            )}
          />
          <div className="flex justify-end">
            <Button type="submit" loading={create.isPending}>
              <Icon icon={Send} />
              Transmettre
            </Button>
          </div>
        </form>
      )}
      <h3 className="text-block-title">Suivi de mes transmissions</h3>
      {updates.isError && items.length === 0 ? (
        <FailureAlert title="Le suivi n’a pas pu être chargé" error={updates.error} wording={ACCOUNT_WORDING} onRetry={() => void updates.refetch()} />
      ) : updates.isPending ? (
        <Skeleton rows={1} />
      ) : items.length === 0 ? (
        <EmptyLine>Vous n’avez encore rien transmis à vos agences.</EmptyLine>
      ) : (
        <ul>
          {items.map((item) => (
            <ListRow
              key={item.id}
              title={nameOf(item.organizationId)}
              detail={`Transmise le ${formatDateTime(item.createdAt)}${item.decidedAt === null ? '' : ` · traitée le ${formatDateTime(item.decidedAt)}`}`}
              trailing={<StatusBadge tone={CONTACT_STATUS_VIEW[item.status].tone}>{CONTACT_STATUS_VIEW[item.status].label}</StatusBadge>}
            />
          ))}
        </ul>
      )}
      <LoadMore query={updates} label="Afficher plus" errorTitle="La suite du suivi n’a pas pu être chargée" />
    </SectionCard>
  );
}
