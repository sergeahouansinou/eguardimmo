'use client';

import { Upload } from 'lucide-react';
import { Alert, Button, Card, CardTitle, RadioGroup, Select, TextField } from '@eguardimmo/ui';
import { useState } from 'react';
import type { z } from 'zod';
import { useCreateReservation, useReservations, useUpdateReservation } from './hooks';
import { bauxPaths } from './paths';
import { ReservationImportDialog } from './ReservationImportDialog';
import { RESERVATION_MODES, reservationInputSchema } from './schemas';
import type { Reservation, ReservationMode } from './schemas';
import { useUnits } from '../locataires/hooks';
import { ListLoading, LoadError, NotFoundPanel, PageHeader, errorMessage, noticeAfterNavigation, useGestionNavigation, useNotify } from '../locataires/kit';
import { addDays, formatDateFr, todayIso } from '../locataires/kit/dates';
import { links } from '../locataires/kit/links';
import { euroInput, money, parseEuros } from '../locataires/kit/money';
import { useZodForm } from '../locataires/kit/useZodForm';
import { unitFullLabel } from '../locataires/schemas';

type Values = z.input<typeof reservationInputSchema>;

const asMode = (value: string): ReservationMode => RESERVATION_MODES.find((entry) => entry === value) ?? 'option';

const blank = (unitId: string): Values => ({
  unitId,
  guest: '',
  arrival: '',
  departure: '',
  amount: '',
  deposit: '',
  paid: '0',
  mode: 'option',
  optionUntil: addDays(todayIso(), 7),
});

const fromReservation = (item: Reservation): Values => ({
  unitId: item.unitId,
  guest: item.guest,
  arrival: item.arrival,
  departure: item.departure,
  amount: euroInput(item.amount),
  deposit: euroInput(item.deposit),
  paid: euroInput(item.paid),
  mode: item.status === 'option' ? 'option' : 'confirmee',
  optionUntil: item.optionUntil ?? addDays(item.arrival, -1),
});

export function ReservationFormPage({ id }: { id?: string }) {
  const { search } = useGestionNavigation();
  const reservations = useReservations();
  const crumbs = [{ label: 'Accueil', href: links.home }, { label: 'Baux', href: bauxPaths.list }, { label: 'Réservations', href: bauxPaths.reservations }];
  if (id === undefined) return <ReservationForm initial={blank(search.get('bien') ?? '')} />;
  if (reservations.isError) return (<><PageHeader crumbs={[...crumbs, { label: 'Modifier' }]} title="Modifier la réservation" /><LoadError title="La réservation n’a pas pu être chargée" /></>);
  if (!reservations.data) return (<><PageHeader crumbs={[...crumbs, { label: 'Modifier' }]} title="Modifier la réservation" /><ListLoading label="Chargement de la réservation" /></>);
  const item = reservations.data.find((entry) => entry.id === id);
  if (!item) {
    return (
      <>
        <PageHeader crumbs={[...crumbs, { label: 'Introuvable' }]} title="Réservation introuvable" />
        <NotFoundPanel title="Cette réservation n’existe pas" description="Elle a peut-être été supprimée ou le lien est incorrect." backHref={bauxPaths.reservations} backLabel="Retour aux réservations" />
      </>
    );
  }
  if (item.status === 'annulee') {
    return (
      <>
        <PageHeader crumbs={[...crumbs, { label: item.reference }]} title="Réservation annulée" />
        <NotFoundPanel title="Une réservation annulée ne se modifie pas" description="Dupliquez-la en option pour créer un nouveau séjour." backHref={bauxPaths.reservations} backLabel="Retour aux réservations" />
      </>
    );
  }
  return <ReservationForm item={item} initial={fromReservation(item)} />;
}

function ReservationForm({ item, initial }: { item?: Reservation; initial: Values }) {
  const { push } = useGestionNavigation();
  const notify = useNotify();
  const units = useUnits();
  const reservations = useReservations();
  const create = useCreateReservation();
  const update = useUpdateReservation(item?.id ?? '');
  const [importOpen, setImportOpen] = useState(false);
  const form = useZodForm(reservationInputSchema, initial);
  const editing = item !== undefined;
  const pending = create.isPending || update.isPending;
  const { arrival, departure, unitId } = form.values;
  const validDates = /^\d{4}-\d{2}-\d{2}$/.test(arrival) && /^\d{4}-\d{2}-\d{2}$/.test(departure) && departure > arrival;
  const conflict = validDates
    ? (reservations.data ?? []).find((other) => other.id !== item?.id && other.status !== 'annulee' && other.unitId === unitId && other.arrival < departure && other.departure > arrival)
    : undefined;

  const save = async () => {
    const values = form.submit();
    if (!values) return;
    try {
      const saved = item ? await update.mutateAsync(values) : await create.mutateAsync(values);
      noticeAfterNavigation({ title: editing ? 'Réservation modifiée' : 'Réservation créée', description: saved.reference });
      push(bauxPaths.reservations);
    } catch (error) {
      notify({ tone: 'danger', title: 'Enregistrement impossible', description: errorMessage(error) });
    }
  };

  const bind = (name: 'guest' | 'arrival' | 'departure' | 'amount' | 'deposit' | 'paid' | 'optionUntil') => ({
    value: form.values[name],
    error: form.error(name),
    onChange: (event: { target: { value: string } }) => { form.setValue(name, event.target.value); },
    onBlur: () => { form.touch(name); },
  });

  const amountOk = /^\d+([.,]\d{1,2})?$/.test(form.values.amount.trim());
  const paidOk = /^\d+([.,]\d{1,2})?$/.test(form.values.paid.trim());
  const balance = amountOk && paidOk ? Math.max(0, parseEuros(form.values.amount) - parseEuros(form.values.paid)) : null;

  return (
    <form noValidate className="flex flex-col gap-3" onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <PageHeader
        crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Baux', href: bauxPaths.list }, { label: 'Réservations', href: bauxPaths.reservations }, { label: editing ? item.reference : 'Nouvelle réservation' }]}
        title={editing ? `Modifier la réservation ${item.reference}` : 'Nouvelle réservation'}
        subtitle="Séjour de courte durée en location meublée, avec acompte et dépôt de garantie."
        actions={
          editing ? null : (
            <Button variant="secondary" onClick={() => { setImportOpen(true); }}>
              <Upload size={14} aria-hidden="true" />
              Importer un fichier CSV
            </Button>
          )
        }
      />
      {units.isError || reservations.isError ? <LoadError title="Les données du formulaire n’ont pas pu être chargées" /> : null}
      {units.isPending || reservations.isPending ? <ListLoading label="Chargement du formulaire" /> : null}
      {units.data && reservations.data ? (
        <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col gap-3">
            <Card className="gap-3" role="group" aria-labelledby="rf-sejour">
              <CardTitle as="h2" id="rf-sejour">Séjour</CardTitle>
              <Select
                label="Bien *"
                placeholder="Choisir un bien"
                searchable
                value={form.values.unitId}
                error={form.error('unitId')}
                onValueChange={(value) => { form.setValue('unitId', value); form.touch('unitId'); }}
                options={units.data.map((unit) => ({ value: unit.id, label: unitFullLabel(unit) }))}
              />
              <TextField label="Voyageur *" placeholder="Ex. Anna Kowalski" {...bind('guest')} />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <TextField label="Arrivée *" type="date" placeholder="jj/mm/aaaa" {...bind('arrival')} />
                <TextField label="Départ *" type="date" placeholder="jj/mm/aaaa" {...bind('departure')} />
              </div>
              {conflict ? (
                <Alert tone="warning" title={`Ce bien est déjà réservé du ${formatDateFr(conflict.arrival)} au ${formatDateFr(conflict.departure)} (${conflict.reference}).`}>
                  L’enregistrement sera refusé tant que les dates se chevauchent.
                </Alert>
              ) : null}
            </Card>
            <Card className="gap-3" role="group" aria-labelledby="rf-tarif">
              <CardTitle as="h2" id="rf-tarif">Montants</CardTitle>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <TextField label="Montant du séjour (€) *" inputMode="decimal" placeholder="Ex. 630" {...bind('amount')} />
                <TextField label="Acompte reçu (€) *" inputMode="decimal" placeholder="Ex. 189" {...bind('paid')} />
                <TextField label="Dépôt de garantie (€) *" inputMode="decimal" placeholder="Ex. 300" {...bind('deposit')} />
              </div>
              {balance !== null ? <p className="text-caption text-fg-subtle">{`Solde à percevoir : ${money(balance)}`}</p> : null}
            </Card>
            <Card className="gap-3" role="group" aria-labelledby="rf-statut">
              <CardTitle as="h2" id="rf-statut">Statut</CardTitle>
              <RadioGroup
                label="État de la réservation"
                value={form.values.mode}
                onValueChange={(value) => { form.setValue('mode', asMode(value)); }}
                options={[{ value: 'option', label: 'Option, sans engagement jusqu’à une date' }, { value: 'confirmee', label: 'Confirmée' }]}
              />
              {form.values.mode === 'option' ? <TextField label="Option valable jusqu’au *" type="date" placeholder="jj/mm/aaaa" {...bind('optionUntil')} /> : null}
            </Card>
          </div>
          <aside className="flex min-w-0 flex-col gap-3">
            <Card className="gap-2" role="group" aria-labelledby="rf-aide">
              <CardTitle as="h2" id="rf-aide">À savoir</CardTitle>
              <p className="text-body text-fg-muted">Une option libère le bien à son échéance si elle n’est pas confirmée. Le contrat de location et la confirmation se génèrent depuis la liste.</p>
            </Card>
          </aside>
        </div>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={() => { push(bauxPaths.reservations); }}>Annuler</Button>
        <Button type="submit" loading={pending}>{editing ? 'Enregistrer les modifications' : 'Créer la réservation'}</Button>
      </div>
      <ReservationImportDialog open={importOpen} onOpenChange={setImportOpen} onImported={() => { push(bauxPaths.reservations); }} />
    </form>
  );
}
