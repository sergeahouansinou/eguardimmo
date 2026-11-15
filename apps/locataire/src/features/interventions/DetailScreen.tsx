'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Card, CardHeader, CardTitle, Dialog, DialogClose, DialogContent, Icon, Select, StatCard, TextField } from '@eguardimmo/ui';
import { CalendarClock, CircleCheck, Clock, ImageIcon, MessageSquare } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useFlash } from '@/components/flash';
import { PageHeader } from '@/components/PageHeader';
import { Async3, NotFoundState } from '@/components/ScreenState';
import { KeyValueList, ListRow, SectionCard } from '@/components/Section';
import { StatusBadge } from '@/components/StatusBadge';
import { useHome, useInterventions, useLease, useRescheduleIntervention } from '@/data/queries';
import { SLOTS, URGENCIES, rescheduleInputSchema } from '@/data/schemas/interventions';
import type { Intervention, RescheduleInput } from '@/data/schemas/interventions';
import { addDays, daysBetween, formatDate, formatWeekdayDate, plural } from '@/lib/dates';
import { interventionStatus } from '../shared/status';

export function DetailScreen({ interventionId }: { interventionId: string }) {
  const interventions = useInterventions();
  const home = useHome();
  const lease = useLease();
  return (
    <Async3 a={interventions} b={home} c={lease} errorTitle="La demande n’a pas pu être chargée">
      {(items, homeData, leaseData) => {
        const item = items.find((candidate) => candidate.id === interventionId);
        return item ? (
          <Detail item={item} today={homeData.today} unit={leaseData.property.unit} />
        ) : (
          <NotFoundState title="Demande introuvable" backHref="/interventions" backLabel="Revenir aux interventions" />
        );
      }}
    </Async3>
  );
}

function Detail({ item, today, unit }: { item: Intervention; today: string; unit: string }) {
  const [rescheduling, setRescheduling] = useState(false);
  const view = interventionStatus(item.status);
  const days = daysBetween(item.reportedAt.slice(0, 10), today);
  const urgency = URGENCIES.find((candidate) => candidate.value === item.urgency)?.label ?? item.urgency;
  const appointment = item.appointment;
  return (
    <>
      <PageHeader
        title={item.title}
        crumbs={[{ label: 'Interventions', href: '/interventions' }, { label: item.id }]}
        badge={<StatusBadge tone={view.tone}>{view.label}</StatusBadge>}
        subtitle={`Signalée le ${formatDate(item.reportedAt)} · ${item.room} · ${item.typeLabel.split(',')[0] ?? item.typeLabel}`}
        actions={
          <>
            <Button variant="secondary" asChild>
              <Link href="/messages/nouveau">
                <Icon icon={MessageSquare} />
                Écrire au gestionnaire
              </Link>
            </Button>
            {appointment && item.status !== 'terminee' ? (
              <Button onClick={() => { setRescheduling(true); }}>
                <Icon icon={CalendarClock} />
                Modifier le rendez-vous
              </Button>
            ) : null}
          </>
        }
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Statut" value={view.label}>
          <span className="text-caption text-fg-subtle">{item.mandatedOn ? 'Intervenant mandaté' : 'En attente de prise en charge'}</span>
        </StatCard>
        <StatCard label="Rendez-vous" value={appointment ? formatDate(appointment.date) : '—'}>
          <span className="text-caption text-fg-subtle">
            {appointment ? `${(formatWeekdayDate(appointment.date).split(' ')[0] ?? '')}, ${appointment.slot}` : 'Aucun rendez-vous fixé'}
          </span>
        </StatCard>
        <StatCard label="Intervenant" value={appointment?.contractor ?? '—'}>
          <span className="text-caption text-fg-subtle">{item.mandatedOn ? `Mandaté le ${formatDate(item.mandatedOn)}` : 'Pas encore mandaté'}</span>
        </StatCard>
        <StatCard label="Signalée il y a" value={plural(days, 'jour', 'jours')}>
          <span className="text-caption text-fg-subtle">Le {formatDate(item.reportedAt)}</span>
        </StatCard>
      </div>
      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <SectionCard id="iv-chrono" title="Chronologie">
          <ol>
            {item.timeline.map((step) => (
              <ListRow
                key={step.label}
                icon={step.state === 'done' ? CircleCheck : Clock}
                tone={step.state === 'done' ? 'success' : step.state === 'next' ? 'warning' : 'neutral'}
                title={step.label}
                detail={step.detail}
                trailing={step.state === 'done' ? null : <StatusBadge tone={step.state === 'next' ? 'warning' : 'neutral'}>À venir</StatusBadge>}
              />
            ))}
          </ol>
        </SectionCard>
        <div className="flex min-w-0 flex-col gap-3">
          <Card role="region" aria-labelledby="iv-rdv" className="px-4 py-3">
            <CardHeader>
              <CardTitle as="h2" id="iv-rdv">Détail du rendez-vous</CardTitle>
            </CardHeader>
            {appointment ? (
              <KeyValueList
                labelWidth="5rem"
                items={[
                  { label: 'Date', value: formatWeekdayDate(appointment.date) },
                  { label: 'Créneau', value: appointment.slot },
                  { label: 'Lieu', value: `${unit}, ${item.room.toLowerCase()}` },
                  { label: 'Présence', value: appointment.presenceRequired ? 'Requise' : 'Non requise' },
                ]}
              />
            ) : (
              <p className="text-body text-fg-muted">Aucun rendez-vous fixé pour l’instant. Vous serez prévenu dès qu’un intervenant est mandaté.</p>
            )}
          </Card>
          {appointment ? (
            <Card role="region" aria-labelledby="iv-inter" className="px-4 py-3">
              <CardHeader>
                <CardTitle as="h2" id="iv-inter">Coordonnées de l’intervenant</CardTitle>
              </CardHeader>
              <KeyValueList
                labelWidth="6rem"
                items={[
                  { label: 'Entreprise', value: appointment.contractor },
                  {
                    label: 'Téléphone',
                    value: (
                      <a href={`tel:${appointment.phone.replace(/\s/g, '')}`} className="text-action-on-subtle underline underline-offset-3">
                        {appointment.phone}
                      </a>
                    ),
                  },
                  { label: 'Mandaté par', value: 'Gestion Les Tilleuls' },
                ]}
              />
            </Card>
          ) : null}
        </div>
      </div>
      <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-2">
        <SectionCard id="iv-signalement" title="Votre signalement">
          <KeyValueList
            labelWidth="6rem"
            items={[
              { label: 'Type', value: item.typeLabel },
              { label: 'Pièce', value: item.room },
              { label: 'Urgence', value: urgency },
              { label: 'Description', value: item.description },
            ]}
          />
        </SectionCard>
        <SectionCard id="iv-photos" title="Photos jointes">
          {item.photos.length === 0 ? (
            <p className="py-2 text-body text-fg-subtle">Aucune photo jointe.</p>
          ) : (
            <ul className="grid grid-cols-2 gap-2">
              {item.photos.map((photo) => (
                <li key={photo} className="flex aspect-[4/3] min-w-0 flex-col items-center justify-center gap-1 rounded-md border border-line bg-muted p-1 text-center text-fg-subtle">
                  <Icon icon={ImageIcon} size={20} />
                  <span className="max-w-full truncate text-caption">{photo}</span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
      {appointment ? <RescheduleDialog item={item} today={today} open={rescheduling} onOpenChange={setRescheduling} /> : null}
    </>
  );
}

function RescheduleDialog({
  item,
  today,
  open,
  onOpenChange,
}: {
  item: Intervention;
  today: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const show = useFlash((state) => state.show);
  const reschedule = useRescheduleIntervention();
  const earliest = addDays(today, 1);
  const form = useForm<RescheduleInput>({
    resolver: zodResolver(
      rescheduleInputSchema.refine((value) => value.date >= earliest, { path: ['date'], error: `Choisissez une date à partir du ${formatDate(earliest)}.` }),
    ),
    defaultValues: { id: item.id, date: item.appointment?.date ?? earliest, slot: SLOTS.find((slot) => slot === item.appointment?.slot) ?? SLOTS[0] },
  });
  const { register, handleSubmit, formState, control, setValue } = form;
  const slotValue = useWatch({ control, name: 'slot' });
  const submit = handleSubmit((values) => {
    reschedule.mutate(values, {
      onSuccess: () => {
        onOpenChange(false);
        show({ tone: 'success', title: 'Rendez-vous modifié', detail: `Nouveau créneau : ${formatWeekdayDate(values.date)}, ${values.slot}.`, path: `/interventions/${item.id}` });
      },
    });
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Modifier le rendez-vous" description="Proposez un nouveau créneau : l’intervenant et votre gestionnaire sont prévenus.">
        <form onSubmit={(event) => { void submit(event); }} noValidate className="flex flex-col gap-3 p-4">
          <TextField label="Nouvelle date" placeholder="JJ/MM/AAAA" type="date" min={earliest} {...register('date')} error={formState.errors.date?.message} data-autofocus />
          <Select
            label="Créneau"
            placeholder="9 h à 12 h"
            value={slotValue}
            options={SLOTS.map((slot) => ({ value: slot, label: slot }))}
            onValueChange={(value) => {
              const slot = SLOTS.find((candidate) => candidate === value);
              if (slot) setValue('slot', slot, { shouldValidate: true });
            }}
            error={formState.errors.slot?.message}
          />
          {reschedule.isError ? (
            <p role="alert" className="text-body text-fg-danger">
              {reschedule.error.message}
            </p>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2">
            <DialogClose asChild>
              <Button variant="ghost">Annuler</Button>
            </DialogClose>
            <Button type="submit" loading={reschedule.isPending}>
              Enregistrer le créneau
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
