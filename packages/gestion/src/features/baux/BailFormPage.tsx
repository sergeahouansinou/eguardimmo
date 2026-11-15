'use client';

import { Alert, Button, Card, CardTitle, Checkbox, RadioGroup, Select, Textarea, TextField } from '@eguardimmo/ui';
import { useState } from 'react';
import type { z } from 'zod';
import { LeaseGate } from './LeaseGate';
import { useCreateLease, useLeases, useUpdateLease } from './hooks';
import { bauxPaths } from './paths';
import { PAYMENT_METHODS, leaseInputSchema, paymentMethodLabel } from './schemas';
import type { Lease } from './schemas';
import { useTenants, useUnits } from '../locataires/hooks';
import { DescriptionList, LinkButton, ListLoading, LoadError, PageHeader, Steps, errorMessage, noticeAfterNavigation, useGestionNavigation, useNotify } from '../locataires/kit';
import { addDays, addMonths, formatDateFr, todayIso } from '../locataires/kit/dates';
import { links } from '../locataires/kit/links';
import { euroInput, money, parseEuros } from '../locataires/kit/money';
import { useZodForm } from '../locataires/kit/useZodForm';
import { locatairesPaths } from '../locataires/paths';
import { tenantNameOf, unitFullLabel } from '../locataires/schemas';

type Values = z.input<typeof leaseInputSchema>;
type Field = keyof Values;

const STEPS = ['Bien', 'Locataires', 'Conditions', 'Récapitulatif'];
const STEP_FIELDS: readonly (readonly Field[])[] = [
  ['unitId'],
  ['tenantIds'],
  ['start', 'durationMonths', 'rent', 'charges', 'deposit', 'dueDay', 'paymentMethod'],
  [],
];
const DURATIONS = [
  { value: '12', label: '12 mois' },
  { value: '24', label: '24 mois' },
  { value: '36', label: '36 mois, 3 ans' },
  { value: '72', label: '72 mois, 6 ans' },
];

const empty = (unitId: string, tenantId: string): Values => ({
  unitId,
  furnished: false,
  start: '',
  durationMonths: '36',
  tenantIds: tenantId === '' ? [] : [tenantId],
  paymentMethod: 'virement',
  note: '',
  rent: '',
  charges: '',
  deposit: '',
  dueDay: '1',
  asDraft: false,
});

const fromLease = (lease: Lease): Values => ({
  unitId: lease.unitId,
  furnished: lease.furnished,
  start: lease.start,
  durationMonths: String(lease.durationMonths),
  tenantIds: lease.tenantIds,
  paymentMethod: lease.paymentMethod,
  note: lease.note,
  rent: lease.rent === 0 ? '' : euroInput(lease.rent),
  charges: euroInput(lease.charges),
  deposit: euroInput(lease.deposit),
  dueDay: String(lease.dueDay),
  asDraft: false,
});

export function BailFormPage({ id }: { id?: string }) {
  const { search } = useGestionNavigation();
  if (id === undefined) return <LeaseForm initial={empty(search.get('bien') ?? '', search.get('locataire') ?? '')} />;
  return <LeaseGate id={id} title="Modifier le bail">{(lease) => (lease.status === 'termine' ? <Closed lease={lease} /> : <LeaseForm lease={lease} initial={fromLease(lease)} />)}</LeaseGate>;
}

function Closed({ lease }: { lease: Lease }) {
  return (
    <>
      <PageHeader crumbs={[{ label: 'Baux', href: bauxPaths.list }, { label: lease.reference, href: bauxPaths.detail(lease.id) }, { label: 'Modifier' }]} title="Bail terminé" />
      <Alert tone="info" title="Un bail terminé ne peut plus être modifié.">
        <div className="mt-1"><LinkButton href={bauxPaths.detail(lease.id)} size="sm">Retour au bail</LinkButton></div>
      </Alert>
    </>
  );
}

function LeaseForm({ lease, initial }: { lease?: Lease; initial: Values }) {
  const { push } = useGestionNavigation();
  const notify = useNotify();
  const units = useUnits();
  const tenants = useTenants();
  const leases = useLeases();
  const create = useCreateLease();
  const update = useUpdateLease(lease?.id ?? '');
  const form = useZodForm(leaseInputSchema, initial);
  const [step, setStep] = useState(0);
  const editing = lease !== undefined;
  const pending = create.isPending || update.isPending;

  const unitList = units.data ?? [];
  const tenantList = (tenants.data ?? []).filter((tenant) => tenant.status !== 'archive');
  const unit = unitList.find((entry) => entry.id === form.values.unitId);
  const parsed = leaseInputSchema.safeParse(form.values);
  const issues = parsed.success ? [] : parsed.error.issues.map((issue) => String(issue.path[0]));
  const blocked = (index: number) => STEP_FIELDS[index]?.some((field) => issues.includes(field)) ?? false;

  const sameUnit = (leases.data ?? []).filter((other) => other.id !== lease?.id && other.unitId === form.values.unitId && (other.status === 'en_cours' || other.status === 'preavis' || other.status === 'a_venir'));
  const start = form.values.start;
  const durationMonths = Number(form.values.durationMonths);
  const end = start !== '' && durationMonths > 0 ? addDays(addMonths(start, durationMonths), -1) : null;
  const conflict = end ? sameUnit.find((other) => other.end >= start && other.start <= end) : undefined;

  const goNext = () => {
    for (const field of STEP_FIELDS[step] ?? []) form.touch(field);
    if (blocked(step)) return;
    setStep((current) => Math.min(STEPS.length - 1, current + 1));
  };

  const save = async (asDraft: boolean) => {
    form.setValue('asDraft', asDraft);
    const values = leaseInputSchema.safeParse({ ...form.values, asDraft });
    if (!values.success) {
      form.submit();
      const first = values.error.issues[0]?.path[0];
      const target = STEP_FIELDS.findIndex((fields) => fields.some((field) => field === first));
      if (target >= 0) setStep(target);
      return;
    }
    try {
      const saved = lease ? await update.mutateAsync(values.data) : await create.mutateAsync(values.data);
      noticeAfterNavigation({ title: asDraft ? 'Brouillon enregistré' : editing ? 'Bail modifié' : 'Bail créé', description: saved.reference });
      push(bauxPaths.detail(saved.id));
    } catch (error) {
      notify({ tone: 'danger', title: 'Enregistrement impossible', description: errorMessage(error) });
    }
  };

  const bind = (name: 'start' | 'rent' | 'charges' | 'deposit' | 'dueDay') => ({
    value: form.values[name],
    error: form.error(name),
    onChange: (event: { target: { value: string } }) => { form.setValue(name, event.target.value); },
    onBlur: () => { form.touch(name); },
  });

  const toggleTenant = (tenantId: string) => {
    const current = form.values.tenantIds;
    form.setValue('tenantIds', current.includes(tenantId) ? current.filter((entry) => entry !== tenantId) : [...current, tenantId]);
    form.touch('tenantIds');
  };

  const rentMinor = /^\d+([.,]\d{1,2})?$/.test(form.values.rent.trim()) ? parseEuros(form.values.rent) : 0;
  const chargesMinor = /^\d+([.,]\d{1,2})?$/.test(form.values.charges.trim()) ? parseEuros(form.values.charges) : 0;

  return (
    <form noValidate className="flex flex-col gap-3" onSubmit={(event) => { event.preventDefault(); if (step < STEPS.length - 1) goNext(); else void save(false); }}>
      <PageHeader
        crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Baux', href: bauxPaths.list }, ...(lease ? [{ label: lease.reference, href: bauxPaths.detail(lease.id) }] : []), { label: editing ? 'Modifier' : 'Nouveau bail' }]}
        title={editing ? `Modifier le bail ${lease.reference}` : 'Nouveau bail'}
        subtitle="Quatre étapes. Vous pouvez enregistrer un brouillon à tout moment."
      />
      <Steps steps={STEPS} current={step} label="Étapes du bail" />
      {units.isError || tenants.isError ? <LoadError title="Les données du formulaire n’ont pas pu être chargées" /> : null}
      {units.isPending || tenants.isPending ? <ListLoading label="Chargement du formulaire" /> : null}

      {units.data && tenants.data ? (
        <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Card className="gap-3" role="group" aria-labelledby="bf-step">
            <CardTitle as="h2" id="bf-step">{`Étape ${String(step + 1)}, ${STEPS[step] ?? ''}`}</CardTitle>
            {step === 0 ? (
              <>
                <Select
                  label="Bien loué *"
                  placeholder="Choisir un bien"
                  searchable
                  value={form.values.unitId}
                  error={form.error('unitId')}
                  onValueChange={(value) => { form.setValue('unitId', value); form.touch('unitId'); }}
                  options={unitList.map((entry) => ({ value: entry.id, label: `${unitFullLabel(entry)}${entry.vacant ? ' (libre)' : ''}` }))}
                />
                <RadioGroup
                  label="Type de location"
                  value={form.values.furnished ? 'meuble' : 'vide'}
                  onValueChange={(value) => { form.setValue('furnished', value === 'meuble'); form.setValue('durationMonths', value === 'meuble' ? '12' : '36'); }}
                  options={[{ value: 'vide', label: 'Location vide, 3 ans' }, { value: 'meuble', label: 'Location meublée, 1 an' }]}
                />
              </>
            ) : null}
            {step === 1 ? (
              <fieldset className="flex flex-col gap-2">
                <legend className="text-body-strong text-fg">Locataires du bail *</legend>
                {tenantList.length === 0 ? <p className="text-body text-fg-subtle">Aucun locataire disponible.</p> : null}
                <ul className="flex flex-col gap-1.5">
                  {tenantList.map((tenant) => (
                    <li key={tenant.id}>
                      <Checkbox label={`${tenantNameOf(tenant)}${tenant.status === 'invite' ? ' (invité)' : ''}`} checked={form.values.tenantIds.includes(tenant.id)} onChange={() => { toggleTenant(tenant.id); }} />
                    </li>
                  ))}
                </ul>
                {form.error('tenantIds') ? <span role="alert" className="text-caption text-fg-danger">{form.error('tenantIds')}</span> : null}
                <div><LinkButton href={locatairesPaths.create} size="sm">Nouveau locataire</LinkButton></div>
              </fieldset>
            ) : null}
            {step === 2 ? (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <TextField label="Début du bail *" type="date" placeholder="jj/mm/aaaa" {...bind('start')} />
                  <Select
                    label="Durée *"
                    placeholder="Choisir une durée"
                    value={form.values.durationMonths}
                    error={form.error('durationMonths')}
                    onValueChange={(value) => { form.setValue('durationMonths', value); }}
                    options={DURATIONS}
                  />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <TextField label="Loyer hors charges (€) *" inputMode="decimal" placeholder="Ex. 850" {...bind('rent')} />
                  <TextField label="Charges (€) *" inputMode="decimal" placeholder="Ex. 80" {...bind('charges')} />
                  <TextField label="Dépôt de garantie (€) *" inputMode="decimal" placeholder="Ex. 850" hint={form.values.furnished ? 'Maximum 2 mois de loyer' : 'Maximum 1 mois de loyer'} {...bind('deposit')} />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <TextField label="Jour d’échéance *" inputMode="numeric" placeholder="Ex. 1" hint="Entre 1 et 28" {...bind('dueDay')} />
                  <Select
                    label="Mode de paiement"
                    placeholder="Choisir un mode"
                    value={form.values.paymentMethod}
                    onValueChange={(value) => { form.setValue('paymentMethod', PAYMENT_METHODS.find((method) => method === value) ?? 'virement'); }}
                    options={PAYMENT_METHODS.map((method) => ({ value: method, label: paymentMethodLabel[method] }))}
                  />
                </div>
                <Textarea label="Note interne" placeholder="Ex. Garant à rencontrer avant la signature" value={form.values.note} onChange={(event) => { form.setValue('note', event.target.value); }} />
              </>
            ) : null}
            {step === 3 ? (
              <DescriptionList
                termWidth="150px"
                items={[
                  { term: 'Bien', detail: unit ? unitFullLabel(unit) : '—' },
                  { term: 'Type', detail: form.values.furnished ? 'Location meublée' : 'Location vide' },
                  { term: 'Locataires', detail: form.values.tenantIds.map((tenantId) => { const tenant = tenantList.find((entry) => entry.id === tenantId); return tenant ? tenantNameOf(tenant) : tenantId; }).join(', ') || '—' },
                  { term: 'Période', detail: end ? `${formatDateFr(start)} → ${formatDateFr(end)}` : '—' },
                  { term: 'Loyer', detail: `${money(rentMinor)} + ${money(chargesMinor)} de charges` },
                  { term: 'Dépôt de garantie', detail: money(/^\d+([.,]\d{1,2})?$/.test(form.values.deposit.trim()) ? parseEuros(form.values.deposit) : 0) },
                  { term: 'Échéance', detail: `Le ${form.values.dueDay} de chaque mois, ${paymentMethodLabel[form.values.paymentMethod].toLowerCase()}` },
                  { term: 'Statut à la création', detail: start !== '' && start > todayIso() ? 'À venir' : 'En cours' },
                ]}
              />
            ) : null}
            {conflict && step >= 2 ? (
              <Alert tone="warning" title={`Ce bien est déjà couvert par le bail ${conflict.reference} sur cette période.`}>
                La création sera refusée si le bail existant est en cours. Ajustez les dates ou résiliez-le d’abord.
              </Alert>
            ) : null}
          </Card>
          <aside className="flex min-w-0 flex-col gap-3">
            <Card className="gap-2" role="group" aria-labelledby="bf-aide">
              <CardTitle as="h2" id="bf-aide">À savoir</CardTitle>
              <p className="text-body text-fg-muted">Le locataire est ajouté à l’échéancier dès la création. Les avis d’échéance sont préparés le mois précédent.</p>
              {sameUnit.length > 0 ? <p className="text-caption text-fg-subtle">{`Baux sur ce bien : ${sameUnit.map((other) => other.reference).join(', ')}.`}</p> : null}
            </Card>
          </aside>
        </div>
      ) : null}

      <div className="flex flex-wrap justify-between gap-2">
        <Button variant="ghost" onClick={() => { push(lease ? bauxPaths.detail(lease.id) : bauxPaths.list); }}>Annuler</Button>
        <div className="flex flex-wrap justify-end gap-2">
          {step > 0 ? <Button variant="secondary" onClick={() => { setStep((current) => current - 1); }}>Précédent</Button> : null}
          {lease && lease.status !== 'brouillon' ? null : <Button variant="secondary" loading={pending} onClick={() => { void save(true); }}>Enregistrer en brouillon</Button>}
          {step < STEPS.length - 1 ? <Button type="submit">Suivant</Button> : <Button type="submit" loading={pending}>{editing ? 'Enregistrer le bail' : 'Créer le bail'}</Button>}
        </div>
      </div>
    </form>
  );
}
