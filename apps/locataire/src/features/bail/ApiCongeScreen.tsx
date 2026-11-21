'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Button, Card, CardHeader, CardTitle, Icon, Select, TextField } from '@eguardimmo/ui';
import { DoorOpen } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { CheckboxField } from '@/components/CheckboxField';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { FailureAlert } from '@/components/FailureAlert';
import { FileDrop } from '@/components/FileDrop';
import { LeaseGate } from '@/components/LeaseGate';
import { PageHeader } from '@/components/PageHeader';
import { Skeleton } from '@/components/ScreenState';
import { EmptyLine, SectionCard } from '@/components/Section';
import { useFlash } from '@/components/flash';
import { formatDate, todayIso } from '@/lib/dates';
import { ATTESTATION_RULES } from '@/lib/files';
import { useAttemptKey } from '@/tenant/clientId';
import { describeFailure } from '@/tenant/errors';
import type { LeaseSummary } from '@/tenant/model';
import { NOTICE_UNAVAILABLE, NOTICE_WORDING } from '@/tenant/noticeLabels';
import { useNoticeOptions, useNoticeRequests, useSubmitNotice } from '@/tenant/noticeQueries';
import type { NoticeOptions } from '@/tenant/noticeSchemas';
import { useSelectedLease } from '@/tenant/selectedLease';
import { NoticeRequestCard } from './NoticeRequestCard';
import { FORWARDING_ADDRESS_MAX, noticeSchema } from './noticeForm';
import type { NoticeValues } from './noticeForm';

const CRUMBS = [{ label: 'Mon logement' }, { label: 'Mon bail', href: '/bail' }, { label: 'Donner congé' }];
const GENERIC_UNAVAILABLE = 'La demande de congé en ligne n’est pas disponible pour ce bail. Écrivez à votre agence.';

export function ApiCongeScreen() {
  const selection = useSelectedLease();
  return (
    <>
      <PageHeader
        title="Donner congé"
        crumbs={CRUMBS}
        subtitle="Votre demande est transmise à votre agence, qui en accuse réception à une date certaine."
      />
      <LeaseGate selection={selection} errorTitle="Vos baux n’ont pas pu être chargés">
        {(lease) => <NoticeContent key={lease.id} lease={lease} />}
      </LeaseGate>
    </>
  );
}

function NoticeContent({ lease }: { lease: LeaseSummary }) {
  const options = useNoticeOptions(lease.id);
  const requests = useNoticeRequests();
  if (options.data === undefined) {
    return options.isError ? (
      <FailureAlert title="Le formulaire de congé n’a pas pu être chargé" error={options.error} wording={NOTICE_WORDING} onRetry={() => void options.refetch()} />
    ) : (
      <Skeleton rows={2} />
    );
  }
  const data = options.data;
  const mine = (requests.data?.pages ?? []).flatMap((page) => page.items).filter((item) => item.leaseId === lease.id);
  return (
    <>
      {data.available ? (
        <NoticeForm lease={lease} options={data} />
      ) : (
        <Alert tone="info" title="Congé en ligne indisponible">
          {data.unavailableReason === null ? GENERIC_UNAVAILABLE : (NOTICE_UNAVAILABLE[data.unavailableReason] ?? GENERIC_UNAVAILABLE)}
        </Alert>
      )}
      <SectionCard id="cg-suivi" title="Suivi de mes demandes">
        {requests.isError ? (
          <FailureAlert title="Vos demandes n’ont pas pu être chargées" error={requests.error} wording={NOTICE_WORDING} onRetry={() => void requests.refetch()} />
        ) : requests.isPending ? (
          <Skeleton rows={1} />
        ) : mine.length === 0 ? (
          <EmptyLine>Vous n’avez fait aucune demande de congé pour ce bail.</EmptyLine>
        ) : (
          <div>
            {mine.map((item) => (
              <NoticeRequestCard key={item.id} item={item} reasonLabel={data.reasons.find((reason) => reason.key === item.reasonKey)?.label ?? item.reasonKey} />
            ))}
          </div>
        )}
        {requests.hasNextPage ? (
          <Button variant="secondary" size="sm" loading={requests.isFetchingNextPage} onClick={() => void requests.fetchNextPage()}>
            Afficher plus
          </Button>
        ) : null}
      </SectionCard>
    </>
  );
}

function NoticeForm({ lease, options }: { lease: LeaseSummary; options: NoticeOptions }) {
  const show = useFlash((state) => state.show);
  const submit = useSubmitNotice();
  const attemptKey = useAttemptKey();
  const today = useMemo(() => todayIso(), []);
  const schema = useMemo(() => noticeSchema(options.reasons, today), [options.reasons, today]);
  const [pending, setPending] = useState<NoticeValues | null>(null);
  const form = useForm<NoticeValues>({
    resolver: zodResolver(schema),
    defaultValues: { reasonKey: '', departureOn: '', forwardingAddress: '', proof: null, consent: false },
  });
  const { register, handleSubmit, formState, control, setValue, reset } = form;
  const reasonKey = useWatch({ control, name: 'reasonKey' });
  const reason = options.reasons.find((item) => item.key === reasonKey);

  const choose = (key: string) => {
    setValue('reasonKey', key, { shouldValidate: formState.isSubmitted });
    const next = options.reasons.find((item) => item.key === key);
    if (next !== undefined) setValue('departureOn', next.earliestDepartureOn, { shouldValidate: formState.isSubmitted });
    if (next?.proofRequired !== true) setValue('proof', null);
  };

  const send = () => {
    if (pending === null) return;
    const proof = pending.proof instanceof File ? pending.proof : null;
    const clientId = attemptKey([lease.id, pending.reasonKey, pending.departureOn, pending.forwardingAddress, proof?.name ?? '', String(proof?.size ?? 0)].join('|'));
    submit.mutate(
      { leaseId: lease.id, reasonKey: pending.reasonKey, departureOn: pending.departureOn, forwardingAddress: pending.forwardingAddress, consentVersion: options.consent.version, proof, clientId },
      {
        onSuccess: (created) => {
          setPending(null);
          reset();
          show({
            tone: 'success',
            title: 'Demande de congé transmise',
            detail: `Départ souhaité le ${formatDate(created.requestedDepartureOn)}. Votre agence en accusera réception.`,
            path: '/bail/conge',
          });
        },
      },
    );
  };

  return (
    <>
      <Alert tone="info" title="Avant d’envoyer">
        {options.legalNotice}
      </Alert>
      <form
        noValidate
        onSubmit={(event) => {
          void handleSubmit((values) => { setPending(values); })(event);
        }}
        className="flex flex-col gap-3"
      >
        <Card role="region" aria-labelledby="dc-depart" className="px-4 py-3">
          <CardHeader>
            <CardTitle as="h2" id="dc-depart">Votre départ</CardTitle>
          </CardHeader>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Select
                label="Motif du préavis *"
                placeholder="Choisir un motif"
                value={reasonKey}
                options={options.reasons.map((item) => ({ value: item.key, label: `${item.label} · préavis de ${String(item.months)} mois` }))}
                onValueChange={choose}
                error={formState.errors.reasonKey?.message}
              />
            </div>
            <TextField
              label="Date de départ souhaitée *"
              placeholder="JJ/MM/AAAA"
              type="date"
              min={reason?.earliestDepartureOn ?? today}
              hint={reason === undefined ? 'Choisissez d’abord un motif' : `Au plus tôt le ${formatDate(reason.earliestDepartureOn)}`}
              {...register('departureOn')}
              error={formState.errors.departureOn?.message}
            />
          </div>
          {reason?.proofRequired === true ? (
            <div className="mt-3">
              <Controller
                control={control}
                name="proof"
                render={({ field, fieldState }) => (
                  <FileDrop
                    title="Joindre le justificatif du motif"
                    rules={ATTESTATION_RULES}
                    files={field.value instanceof File ? [field.value] : []}
                    onFilesChange={(files) => { field.onChange(files[0] ?? null); }}
                    error={fieldState.error?.message}
                  />
                )}
              />
            </div>
          ) : null}
        </Card>
        <Card role="region" aria-labelledby="dc-adresse" className="px-4 py-3">
          <CardHeader>
            <CardTitle as="h2" id="dc-adresse">Adresse de réexpédition</CardTitle>
          </CardHeader>
          <TextField
            label="Adresse (facultatif)"
            placeholder="22 avenue Jean Jaurès, 69007 Lyon"
            autoComplete="street-address"
            maxLength={FORWARDING_ADDRESS_MAX}
            {...register('forwardingAddress')}
            error={formState.errors.forwardingAddress?.message}
          />
        </Card>
        <Card role="region" aria-labelledby="dc-envoi" className="px-4 py-3">
          <CardHeader>
            <CardTitle as="h2" id="dc-envoi">Confirmation</CardTitle>
          </CardHeader>
          <CheckboxField {...register('consent')} error={formState.errors.consent?.message}>
            {options.consent.text}
          </CheckboxField>
        </Card>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" asChild>
            <Link href="/bail">Annuler</Link>
          </Button>
          <Button type="submit" variant="danger">
            <Icon icon={DoorOpen} />
            Transmettre ma demande
          </Button>
        </div>
      </form>
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => { if (!open) setPending(null); }}
        title="Transmettre votre demande de congé ?"
        description={`Votre demande est transmise à votre agence pour un départ le ${pending === null ? '' : formatDate(pending.departureOn)}. La date de départ reste indicative tant que l’agence n’a pas accusé réception. Vous pouvez retirer la demande jusque-là.`}
        confirmLabel="Transmettre ma demande"
        loading={submit.isPending}
        onConfirm={send}
        error={submit.isError ? describeFailure(submit.error, NOTICE_WORDING).message : undefined}
      />
    </>
  );
}
