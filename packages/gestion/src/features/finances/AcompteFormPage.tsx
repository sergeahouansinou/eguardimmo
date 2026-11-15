'use client';

import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Alert, Badge, Button, Card, CardTitle, SegmentedControl, Select, Switch, Textarea, TextField } from '@eguardimmo/ui';
import { z } from 'zod';
import { resteDu } from './derive';
import { dateText, fieldErrors, moneyText } from './forms';
import { MODE_LABELS, NATURE_LABELS, options } from './labels';
import { CommandAlert, DateField, FINANCES_ROUTES, MoneyField, NotFoundBlock, PageHeader, QueryGate, useExec, useMoney } from './parts';
import type { ScreenProps } from './parts';
import { newRequestKey, useFinances } from './queries';
import { paymentModeSchema, paymentNatureSchema } from './schemas';
import type { FinancesData, PaymentMode, PaymentNature } from './schemas';

const NONE = 'aucune';
const schema = z.object({
  bailId: z.string().min(1, 'Choisissez un locataire et un bail.'),
  montant: moneyText('Montant reçu'),
  date: dateText('Date du paiement'),
  mode: paymentModeSchema,
  reference: z.string().max(60, 'La référence est limitée à 60 caractères.'),
  note: z.string().max(500, 'La note est limitée à 500 caractères.'),
});

const NATURE_HINTS: { nature: PaymentNature; title: string; caption: string }[] = [
  { nature: 'echeance', title: 'Paiement d’échéance', caption: 'Quittance si soldée' },
  { nature: 'acompte_loyer', title: 'Acompte sur loyer', caption: 'Reçu, quittance au solde' },
  { nature: 'acompte_depot', title: 'Dépôt de garantie', caption: 'Reçu, attestation au solde' },
  { nature: 'autre', title: 'Autre', caption: 'Reçu libre, libellé choisi' },
];

export function AcompteFormPage({ Link, navigate, bailId = null }: ScreenProps & { bailId?: string | null }) {
  const query = useFinances();
  return (
    <>
      <PageHeader
        Link={Link}
        crumbs={[{ label: 'Finances', href: FINANCES_ROUTES.operations }, { label: 'Transactions', href: FINANCES_ROUTES.operations }, { label: 'Nouvel acompte' }]}
        title="Enregistrer un acompte"
        description="Un acompte, un paiement partiel ou une avance sur le dépôt de garantie donne un reçu. La quittance suit au solde."
      />
      <QueryGate query={query} errorTitle="Les baux n’ont pas pu être chargés">
        {(data) =>
          bailId && !data.baux.some((bail) => bail.id === bailId) ? (
            <NotFoundBlock Link={Link} title="Bail introuvable" backHref={FINANCES_ROUTES.operations} backLabel="Retour aux finances" />
          ) : (
            <AcompteForm data={data} navigate={navigate} Link={Link} initialBailId={bailId} />
          )
        }
      </QueryGate>
    </>
  );
}

function AcompteForm({ data, navigate, initialBailId }: ScreenProps & { data: FinancesData; initialBailId: string | null }) {
  const money = useMoney(data.currency);
  const exec = useExec({ navigate });
  const requestKey = useRef(newRequestKey());
  const [nature, setNature] = useState<PaymentNature>('acompte_loyer');
  const [bailId, setBailId] = useState(initialBailId ?? '');
  const [montant, setMontant] = useState('');
  const [date, setDate] = useState(data.today);
  const [mode, setMode] = useState<PaymentMode>('virement');
  const [reference, setReference] = useState('');
  const [echeanceId, setEcheanceId] = useState('');
  const [note, setNote] = useState('');
  const [sendReceipt, setSendReceipt] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const open = data.echeances.filter((item) => item.bailId === bailId && item.statut === 'active' && resteDu(item) > 0).sort((a, b) => a.echeance.localeCompare(b.echeance));
  const imputable = nature === 'echeance' || nature === 'acompte_loyer';
  const target = imputable ? open.find((item) => item.id === echeanceId) ?? open[0] ?? null : null;
  const parsed = moneyText('Montant').safeParse(montant);
  const amount = parsed.success ? parsed.data : 0;
  const resteApres = target ? target.montant - target.paye - amount : 0;
  const credit = Math.max(0, -resteApres);
  const older = target ? open.filter((item) => item.echeance < target.echeance).reduce((total, item) => total + resteDu(item), 0) : 0;
  const needsReceipt = nature === 'acompte_depot' || nature === 'autre' || resteApres > 0;
  const nextReceipt = `RC-${data.today.slice(0, 4)}-${String(data.sequences.RC + 1).padStart(4, '0')}`;

  const submit = () => {
    const result = schema.safeParse({ bailId, montant, date, mode, reference, note });
    if (!result.success) {
      setErrors(fieldErrors(result.error));
      return;
    }
    setErrors({});
    exec.run(
      {
        type: 'recordPayment',
        bailId: result.data.bailId,
        echeanceId: target?.id ?? null,
        montant: result.data.montant,
        date: result.data.date,
        mode: result.data.mode,
        nature,
        reference: result.data.reference,
        note: result.data.note,
        comptabilise: true,
        mentionQuittance: true,
        envoyerRecu: sendReceipt,
      },
      { requestKey: requestKey.current, redirect: 'result' },
    );
  };

  return (
    <form
      noValidate
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <CommandAlert error={exec.error} />
      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card>
          <CardTitle as="h2">Encaissement</CardTitle>
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-caption text-fg-muted">Nature de l’encaissement</span>
            <SegmentedControl label="Nature de l’encaissement" options={options(NATURE_LABELS)} value={nature} onValueChange={(value) => { setNature(paymentNatureSchema.parse(value)); setEcheanceId(''); }} />
          </div>
          <Select
            label="Locataire et bail *"
            placeholder="Choisir un locataire"
            searchable
            options={data.baux.map((bail) => ({ value: bail.id, label: `${bail.locataire}, ${bail.unite}`, description: bail.numero }))}
            value={bailId}
            onValueChange={(value) => { setBailId(value); setEcheanceId(''); }}
            error={errors.bailId}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <MoneyField label="Montant reçu, €" value={montant} onChange={setMontant} error={errors.montant} placeholder="720" />
            <DateField label="Date du paiement" value={date} onChange={setDate} error={errors.date} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select label="Mode de paiement" placeholder="Choisir un mode" options={options(MODE_LABELS)} value={mode} onValueChange={(value) => { setMode(paymentModeSchema.parse(value)); }} />
            <TextField label="Référence du paiement" placeholder="VIR-IY-1112" value={reference} error={errors.reference} onChange={(event) => { setReference(event.target.value); }} />
          </div>
          {imputable ? (
            <Select
              label="Imputer à"
              placeholder={bailId ? 'Aucune échéance impayée' : 'Choisissez d’abord un bail'}
              options={open.length === 0 ? [{ value: NONE, label: 'Aucune échéance impayée' }] : open.map((item) => ({ value: item.id, label: `${item.libelle}, ${money(item.montant)}` }))}
              value={target?.id ?? ''}
              onValueChange={(value) => { setEcheanceId(value === NONE ? '' : value); }}
              disabled={open.length === 0}
            />
          ) : null}
          <Textarea label="Note" placeholder="Virement reçu le 12/11, solde annoncé pour le 20/11." value={note} error={errors.note} onChange={(event) => { setNote(event.target.value); }} />
        </Card>
        <aside className="flex min-w-0 flex-col gap-3">
          <Card>
            <CardTitle as="h2">Après enregistrement</CardTitle>
            {target ? (
              <>
                <Alert tone={resteApres === 0 ? 'success' : 'warning'}>
                  {credit > 0 ? `Crédit de ${money(credit)} à reporter.` : resteApres === 0 ? 'L’échéance sera soldée.' : `Il restera ${money(resteApres)} à régler.`}
                </Alert>
                <dl className="flex flex-col gap-1 text-body">
                  <Line label="Dettes antérieures restantes" value={money(older)} />
                  <Line label={`Reçu sur ${target.libelle.toLowerCase().replace('loyer ', '')}`} value={money(target.paye + amount)} />
                  <Line label="Crédit reporté" value={money(credit)} />
                </dl>
              </>
            ) : (
              <p className="text-body text-fg-subtle">{imputable ? 'Choisissez un bail avec une échéance impayée pour voir l’imputation.' : 'Cet encaissement n’est imputé à aucune échéance.'}</p>
            )}
          </Card>
          <Card>
            <CardTitle as="h2">Documents émis</CardTitle>
            <DocLine title={needsReceipt ? `Reçu d’acompte ${nextReceipt}` : 'Aucun reçu'} caption={needsReceipt ? 'Aperçu du PDF disponible après enregistrement' : 'L’échéance est soldée : une quittance suffit'} badge={needsReceipt ? <Badge tone="success">Émis</Badge> : <Badge>Non émis</Badge>} />
            <DocLine title="Quittance" caption="Émise au solde de l’échéance" badge={<Badge>{target && resteApres <= 0 && amount > 0 ? 'À émettre' : 'Non émise'}</Badge>} />
            <Switch label="Envoyer le reçu au locataire" checked={sendReceipt} onCheckedChange={setSendReceipt} />
          </Card>
        </aside>
      </div>
      <Card>
        <CardTitle as="h2">Selon la nature</CardTitle>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {NATURE_HINTS.map((hint) => (
            <li key={hint.nature} className={`flex flex-col rounded-md border px-3 py-2 ${hint.nature === nature ? 'border-action bg-action-subtle' : 'border-line'}`}>
              <b className="text-body-strong text-fg">{hint.title}</b>
              <span className="text-caption text-fg-subtle">{hint.caption}</span>
            </li>
          ))}
        </ul>
      </Card>
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={() => { navigate(FINANCES_ROUTES.operations); }}>
          Annuler
        </Button>
        <Button type="submit" loading={exec.pending}>
          Enregistrer l’acompte
        </Button>
      </div>
    </form>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-fg-muted">{label}</dt>
      <dd className="font-semibold text-fg tabular-nums">{value}</dd>
    </div>
  );
}

function DocLine({ title, caption, badge }: { title: string; caption: string; badge: ReactNode }) {
  return (
    <div className="flex items-center gap-2 border-t border-line py-2 first:border-t-0">
      <div className="flex min-w-0 flex-1 flex-col">
        <b className="text-body font-medium text-fg">{title}</b>
        <span className="text-caption text-fg-subtle">{caption}</span>
      </div>
      {badge}
    </div>
  );
}

