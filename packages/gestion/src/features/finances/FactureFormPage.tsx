'use client';

import { useRef, useState } from 'react';
import { Alert, Button, Card, CardTitle, ConfirmDialog, Select, TextField } from '@eguardimmo/ui';
import { z } from 'zod';
import { nextNumber } from './derive';
import { formatDate } from './dates';
import { dateText, fieldErrors, moneyText } from './forms';
import { formatMoneyInput, percentOf } from './money';
import { CommandAlert, DateField, FINANCES_ROUTES, MoneyField, PageHeader, QueryGate, useExec, useMoney } from './parts';
import type { ScreenProps } from './parts';
import { newRequestKey, useFinances } from './queries';
import type { FinancesData } from './schemas';

const schema = z
  .object({
    locataireId: z.string().min(1, 'Choisissez un destinataire.'),
    date: dateText('Date d’émission'),
    objet: z.string().trim().min(1, 'Indiquez l’objet de la facture.').max(160, 'Objet trop long (160 caractères).'),
    montantHt: moneyText('Montant HT'),
    tva: z.string().trim().regex(/^\d{1,3}$/, 'TVA : nombre entier de 0 à 100.').transform(Number).pipe(z.number().max(100, 'TVA : 100 % au maximum.')),
    echeance: z.union([z.literal(''), z.iso.date('Échéance : date invalide.')]),
  })
  .refine((values) => values.echeance === '' || values.echeance >= values.date, { path: ['echeance'], message: 'L’échéance ne peut pas précéder la date d’émission.' });

function tenantsOf(data: FinancesData) {
  const seen = new Map<string, string>();
  for (const bail of data.baux) seen.set(bail.locataireId, bail.locataire);
  return [...seen].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, 'fr'));
}

export function FactureFormPage({ Link, navigate }: ScreenProps) {
  const query = useFinances();
  return (
    <>
      <PageHeader
        Link={Link}
        crumbs={[{ label: 'Finances', href: FINANCES_ROUTES.operations }, { label: 'Factures', href: FINANCES_ROUTES.factures }, { label: 'Nouvelle facture' }]}
        title="Nouvelle facture"
        description="Le numéro est attribué à l’émission, dans une suite continue. Une facture émise ne se modifie pas."
      />
      <QueryGate query={query} errorTitle="Les locataires n’ont pas pu être chargés">
        {(data) => <FactureForm data={data} navigate={navigate} />}
      </QueryGate>
    </>
  );
}

function FactureForm({ data, navigate }: Pick<ScreenProps, 'navigate'> & { data: FinancesData }) {
  const money = useMoney(data.currency);
  const exec = useExec({ navigate });
  const requestKey = useRef(newRequestKey());
  const [locataireId, setLocataireId] = useState('');
  const [date, setDate] = useState(data.today);
  const [objet, setObjet] = useState('');
  const [montant, setMontant] = useState('');
  const [tva, setTva] = useState('0');
  const [echeance, setEcheance] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState(false);

  const ht = moneyText('HT').safeParse(montant);
  const rate = /^\d{1,3}$/.test(tva.trim()) ? Number(tva) : null;
  const ttc = ht.success && rate !== null && rate <= 100 ? ht.data + percentOf(ht.data, rate) : null;
  const numero = nextNumber(data, 'FA');
  const parsed = schema.safeParse({ locataireId, date, objet, montantHt: montant, tva, echeance });

  const review = () => {
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setConfirming(true);
  };

  const issue = () => {
    if (!parsed.success) return;
    const { tva: tvaPct, echeance: due, ...values } = parsed.data;
    exec.run({ type: 'createInvoice', ...values, tvaPct, echeance: due === '' ? null : due }, { requestKey: requestKey.current, redirect: 'result', onError: () => { setConfirming(false); } });
  };

  const tenant = tenantsOf(data).find((option) => option.value === locataireId);

  return (
    <form
      noValidate
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        review();
      }}
    >
      <CommandAlert error={exec.error} />
      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card>
          <CardTitle as="h2">Facture</CardTitle>
          <Select label="Destinataire *" placeholder="Choisir un locataire" searchable options={tenantsOf(data)} value={locataireId} onValueChange={setLocataireId} error={errors.locataireId} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <DateField label="Date d’émission *" value={date} onChange={setDate} error={errors.date} />
            <DateField label="Échéance de paiement" value={echeance} onChange={setEcheance} error={errors.echeance} />
          </div>
          <TextField label="Objet *" placeholder="Régularisation des charges 2026" value={objet} error={errors.objet} onChange={(event) => { setObjet(event.target.value); }} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <MoneyField label="Montant HT, € *" value={montant} onChange={setMontant} error={errors.montantHt} placeholder="177" />
            <TextField label="TVA, %" inputMode="numeric" placeholder="0" value={tva} error={errors.tva} onChange={(event) => { setTva(event.target.value); }} />
            <MoneyField label="Total TTC, €" value={ttc === null ? '' : formatMoneyInput(ttc)} readOnly placeholder="177" />
          </div>
        </Card>
        <aside className="flex min-w-0 flex-col gap-3">
          <Card>
            <CardTitle as="h2">Numérotation</CardTitle>
            <p className="text-body text-fg-muted">
              Prochain numéro : <b className="text-fg">{numero}</b>. Il ne peut être ni réutilisé ni supprimé.
            </p>
          </Card>
          <Alert tone="info" title="Une facture émise est scellée">
            Pour corriger une erreur, émettez un avoir : la facture d’origine reste consultable.
          </Alert>
        </aside>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={() => { navigate(FINANCES_ROUTES.factures); }}>
          Annuler
        </Button>
        <Button type="submit">Émettre la facture</Button>
      </div>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Émettre la facture ?"
        description={`${numero} : ${ttc === null ? '' : money(ttc)} pour ${tenant?.label ?? 'le destinataire'}, date du ${formatDate(date)}. Une facture émise ne se modifie plus.`}
        confirmLabel="Émettre la facture"
        loading={exec.pending}
        onConfirm={issue}
      />
    </form>
  );
}
