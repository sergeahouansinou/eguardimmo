'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Button, Card, CardHeader, CardTitle, Icon, Select, TextField } from '@eguardimmo/ui';
import { DoorOpen, Mail } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { CheckboxField } from '@/components/CheckboxField';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useFlash } from '@/components/flash';
import { PageHeader } from '@/components/PageHeader';
import { RadioCards } from '@/components/RadioCards';
import { Async3 } from '@/components/ScreenState';
import { KeyValueList } from '@/components/Section';
import { useGiveNotice, useHome, useInstallments, useLease } from '@/data/queries';
import { NOTICE_REASONS, noticeInputSchema } from '@/data/schemas/logement';
import type { Lease, NoticeInput } from '@/data/schemas/logement';
import type { Installment } from '@/data/schemas/loyers';
import { addDays, addMonths, formatDate, monthOf } from '@/lib/dates';
import { formatMoney } from '@/lib/money';

const CRUMBS = [{ label: 'Mon logement' }, { label: 'Mon bail', href: '/bail' }, { label: 'Donner congé' }];

export function CongeScreen() {
  const lease = useLease();
  const installments = useInstallments();
  const home = useHome();
  return (
    <Async3 a={lease} b={installments} c={home} errorTitle="Le formulaire de congé n’a pas pu être chargé">
      {(leaseData, items, homeData) =>
        leaseData.status === 'conge_donne' ? (
          <AlreadyGiven lease={leaseData} />
        ) : (
          <NoticeForm lease={leaseData} items={items} today={homeData.today} />
        )
      }
    </Async3>
  );
}

function AlreadyGiven({ lease }: { lease: Lease }) {
  return (
    <>
      <PageHeader title="Donner congé" crumbs={CRUMBS} />
      <Alert tone="success" title="Votre congé a été envoyé">
        {lease.notice
          ? `Envoyé le ${formatDate(lease.notice.sentOn)} (réf. ${lease.notice.reference}), départ prévu le ${formatDate(lease.notice.departureOn)}.`
          : 'Votre congé a été enregistré.'}
      </Alert>
      <Button variant="secondary" asChild className="self-start">
        <Link href="/bail">Retour à mon bail</Link>
      </Button>
    </>
  );
}

function NoticeForm({ lease, items, today }: { lease: Lease; items: Installment[]; today: string }) {
  const router = useRouter();
  const show = useFlash((state) => state.show);
  const give = useGiveNotice();
  const earliest = addMonths(today, lease.noticeMonths);
  const defaultDeparture = addDays(addMonths(`${earliest.slice(0, 8)}01`, 1), -1);
  const unpaid = items.filter((item) => item.status === 'impaye');
  const [pending, setPending] = useState<NoticeInput | null>(null);

  const schema = useMemo(
    () =>
      noticeInputSchema.refine((value) => value.departureOn >= earliest, {
        path: ['departureOn'],
        error: `Le départ est possible au plus tôt le ${formatDate(earliest)}.`,
      }),
    [earliest],
  );
  const form = useForm<NoticeInput>({
    resolver: zodResolver(schema),
    defaultValues: { departureOn: defaultDeparture, reason: '', street: '', postalCode: '', city: '', confirm: undefined },
  });
  const { register, handleSubmit, formState, control, setValue } = form;
  const departureOnValue = useWatch({ control, name: 'departureOn' });
  const reasonValue = useWatch({ control, name: 'reason' });

  const send = () => {
    if (!pending) return;
    give.mutate(pending, {
      onSuccess: () => {
        setPending(null);
        show({
          tone: 'success',
          title: 'Congé envoyé',
          detail: `Départ prévu le ${formatDate(pending.departureOn)}. Un état des lieux de sortie va vous être proposé.`,
          path: '/bail',
        });
        router.push('/bail');
      },
    });
  };

  return (
    <>
      <PageHeader
        title="Donner congé"
        crumbs={CRUMBS}
        subtitle={`Le préavis est d'un mois : votre logement est situé en zone tendue.`}
      />
      {unpaid[0] ? (
        <Alert tone="warning" title={`Le loyer ${monthOf(unpaid[0].id)}, ${formatMoney(unpaid[0].rentCents + unpaid[0].provisionsCents)}, reste à régler`}>
          Le loyer reste dû jusqu’à la fin du préavis. Le dépôt de garantie sera restitué après l’état des lieux de sortie.
        </Alert>
      ) : null}
      <form
        noValidate
        onSubmit={(event) => {
          void handleSubmit((values) => { setPending(values); })(event);
        }}
        className="flex flex-col gap-3"
      >
        <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col gap-3">
            <Card role="region" aria-labelledby="dc-depart" className="px-4 py-3">
              <CardHeader>
                <CardTitle as="h2" id="dc-depart">Votre départ</CardTitle>
              </CardHeader>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <TextField
                  label="Date de départ souhaitée *"
                  placeholder="JJ/MM/AAAA"
                  type="date"
                  min={earliest}
                  hint={`Au plus tôt le ${formatDate(earliest)}, un mois après l'envoi`}
                  {...register('departureOn')}
                  error={formState.errors.departureOn?.message}
                />
                <TextField label="Durée du préavis" placeholder="1 mois" readOnly value={lease.noticeZoneLabel} hint="Appliquée à Paris" />
                <div className="sm:col-span-2">
                  <Select
                    label="Motif"
                    placeholder="Choisir un motif"
                    hint="Facultatif en zone tendue"
                    value={reasonValue}
                    options={NOTICE_REASONS}
                    onValueChange={(value) => { setValue('reason', value); }}
                  />
                </div>
              </div>
            </Card>
            <Card role="region" aria-labelledby="dc-adresse" className="px-4 py-3">
              <CardHeader>
                <CardTitle as="h2" id="dc-adresse">Adresse de réexpédition</CardTitle>
              </CardHeader>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <TextField
                    label="Adresse *"
                    placeholder="22 avenue Jean Jaurès"
                    autoComplete="street-address"
                    {...register('street')}
                    error={formState.errors.street?.message}
                  />
                </div>
                <TextField
                  label="Code postal *"
                  placeholder="69007"
                  inputMode="numeric"
                  autoComplete="postal-code"
                  {...register('postalCode')}
                  error={formState.errors.postalCode?.message}
                />
                <TextField label="Ville *" placeholder="Lyon" autoComplete="address-level2" {...register('city')} error={formState.errors.city?.message} />
              </div>
            </Card>
            <Card role="region" aria-labelledby="dc-envoi" className="px-4 py-3">
              <CardHeader>
                <CardTitle as="h2" id="dc-envoi">Envoi</CardTitle>
              </CardHeader>
              <RadioCards
                legend="Mode d'envoi"
                value="lre"
                onValueChange={() => undefined}
                options={[{ value: 'lre', label: 'Demande de congé en ligne', detail: 'Transmise à votre agence, qui en accuse réception à une date certaine', icon: Mail }]}
              />
              <CheckboxField {...register('confirm')} error={formState.errors.confirm?.message}>
                Je confirme donner congé du logement {lease.property.unit}, {lease.property.street}
              </CheckboxField>
            </Card>
          </div>
          <div className="flex min-w-0 flex-col gap-3">
            <Card role="region" aria-labelledby="dc-recap" className="px-4 py-3">
              <CardHeader>
                <CardTitle as="h2" id="dc-recap">Récapitulatif</CardTitle>
              </CardHeader>
              <KeyValueList
                labelWidth="7.5rem"
                items={[
                  { label: 'Envoi', value: formatDate(today) },
                  { label: 'Départ', value: departureOnValue ? formatDate(departureOnValue) : '—' },
                  { label: 'Préavis', value: lease.noticeLabel },
                  { label: 'Dépôt de garantie', value: formatMoney(lease.depositCents) },
                ]}
              />
            </Card>
            <Card role="region" aria-labelledby="dc-suite" className="px-4 py-3">
              <CardHeader>
                <CardTitle as="h2" id="dc-suite">Après l'envoi</CardTitle>
              </CardHeader>
              <p className="text-body text-fg-muted">Un état des lieux de sortie est proposé par {lease.landlord.name} avant votre départ.</p>
            </Card>
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" asChild>
            <Link href="/bail">Annuler</Link>
          </Button>
          <Button type="submit" variant="danger">
            <Icon icon={DoorOpen} />
            Envoyer mon congé
          </Button>
        </div>
      </form>
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => { if (!open) setPending(null); }}
        title="Envoyer votre congé ?"
        description={`Votre congé sera envoyé à ${lease.landlord.name} en ligne, pour un départ le ${pending ? formatDate(pending.departureOn) : ''}. L’agence en accuse réception à une date certaine.`}
        confirmLabel="Confirmer l'envoi du congé"
        loading={give.isPending}
        onConfirm={send}
        error={give.isError ? give.error.message : undefined}
      />
    </>
  );
}
