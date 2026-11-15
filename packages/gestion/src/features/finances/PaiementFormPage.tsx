'use client';

import { useRef, useState } from 'react';
import { Alert, Button, Card, CardTitle, Select, Switch, Textarea } from '@eguardimmo/ui';
import { z } from 'zod';
import { echeanceEtat } from './derive';
import { dateText, fieldErrors, moneyText } from './forms';
import { MODE_LABELS, options } from './labels';
import { formatMoneyInput } from './money';
import { CommandAlert, DateField, FINANCES_ROUTES, MoneyField, NotFoundBlock, PageHeader, QueryGate, useExec, useMoney } from './parts';
import type { ScreenProps } from './parts';
import { defaultEcheance, openByBail, outcomeAfter } from './payments';
import { newRequestKey, useFinances } from './queries';
import { paymentModeSchema } from './schemas';
import type { FinancesData, PaymentMode } from './schemas';

const schema = z.object({
  bailId: z.string().min(1, 'Choisissez un locataire.'),
  echeanceId: z.string().min(1, 'Choisissez l’échéance à régler.'),
  montant: moneyText('Montant reçu'),
  date: dateText('Date du paiement'),
  mode: paymentModeSchema,
  note: z.string().max(500, 'La note est limitée à 500 caractères.'),
});

export function PaiementFormPage({ Link, navigate, echeanceId = null }: ScreenProps & { echeanceId?: string | null }) {
  const query = useFinances();
  return (
    <>
      <PageHeader
        Link={Link}
        crumbs={[{ label: 'Finances', href: FINANCES_ROUTES.operations }, { label: 'Transactions', href: FINANCES_ROUTES.operations }, { label: 'Nouveau paiement' }]}
        title="Enregistrer un paiement"
        description="Le paiement est rattaché à un bail et à une échéance."
      />
      <QueryGate query={query} errorTitle="Les échéances n’ont pas pu être chargées">
        {(data) => {
          const initial = defaultEcheance(data, echeanceId);
          if (initial.missing) return <NotFoundBlock Link={Link} title="Échéance introuvable" backHref={FINANCES_ROUTES.operations} backLabel="Retour aux finances" />;
          return <PaiementForm data={data} navigate={navigate} Link={Link} initialId={initial.echeance?.id ?? ''} />;
        }}
      </QueryGate>
    </>
  );
}

function PaiementForm({ data, navigate, initialId }: ScreenProps & { data: FinancesData; initialId: string }) {
  const money = useMoney(data.currency);
  const exec = useExec({ navigate });
  const requestKey = useRef(newRequestKey());
  const tenants = openByBail(data);
  const start = data.echeances.find((item) => item.id === initialId);
  const [bailId, setBailId] = useState(start?.bailId ?? '');
  const [echeanceId, setEcheanceId] = useState(initialId);
  const [montant, setMontant] = useState(start ? formatMoneyInput(start.montant - start.paye) : '');
  const [date, setDate] = useState(data.today);
  const [mode, setMode] = useState<PaymentMode>('virement');
  const [note, setNote] = useState('');
  const [nonComptabilise, setNonComptabilise] = useState(false);
  const [mention, setMention] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const current = tenants.find((option) => option.bail.id === bailId);
  const echeance = current?.echeances.find((item) => item.id === echeanceId) ?? null;
  const parsedMontant = moneyText('Montant').safeParse(montant);
  const after = outcomeAfter(echeance, parsedMontant.success ? parsedMontant.data : 0);

  const chooseBail = (id: string) => {
    setBailId(id);
    const first = tenants.find((option) => option.bail.id === id)?.echeances[0];
    setEcheanceId(first?.id ?? '');
    setMontant(first ? formatMoneyInput(first.montant - first.paye) : '');
  };
  const chooseEcheance = (id: string) => {
    setEcheanceId(id);
    const found = current?.echeances.find((item) => item.id === id);
    if (found) setMontant(formatMoneyInput(found.montant - found.paye));
  };

  const submit = () => {
    const parsed = schema.safeParse({ bailId, echeanceId, montant, date, mode, note });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    exec.run(
      {
        type: 'recordPayment',
        bailId: parsed.data.bailId,
        echeanceId: parsed.data.echeanceId,
        montant: parsed.data.montant,
        date: parsed.data.date,
        mode: parsed.data.mode,
        nature: 'echeance',
        reference: '',
        note: parsed.data.note,
        comptabilise: !nonComptabilise,
        mentionQuittance: mention,
        envoyerRecu: false,
      },
      { requestKey: requestKey.current, redirect: 'result' },
    );
  };

  if (tenants.length === 0) {
    return <Alert tone="success" title="Aucune échéance à encaisser">Toutes les échéances appelées sont soldées.</Alert>;
  }

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
          <CardTitle as="h2">Paiement</CardTitle>
          <Select
            label="Locataire *"
            placeholder="Choisir un locataire"
            searchable
            options={tenants.map((option) => ({ value: option.bail.id, label: option.bail.locataire, description: `${option.bail.unite}, ${option.bail.immeuble}` }))}
            value={bailId}
            onValueChange={chooseBail}
            error={errors.bailId}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <MoneyField label="Montant reçu, €" value={montant} onChange={setMontant} error={errors.montant} />
            <DateField label="Date du paiement" value={date} onChange={setDate} error={errors.date} />
          </div>
          <Select label="Mode de paiement" placeholder="Choisir un mode" options={options(MODE_LABELS)} value={mode} onValueChange={(value) => { setMode(paymentModeSchema.parse(value)); }} />
          <Select
            label="Affecter à"
            placeholder="Choisir une échéance"
            options={(current?.echeances ?? []).map((item) => ({ value: item.id, label: `${item.libelle}, ${money(item.montant - item.paye)}` }))}
            value={echeanceId}
            onValueChange={chooseEcheance}
            error={errors.echeanceId}
          />
          <Textarea label="Note" placeholder="Virement reçu le 13/11." value={note} error={errors.note} onChange={(event) => { setNote(event.target.value); }} />
        </Card>
        <aside className="flex min-w-0 flex-col gap-3">
          <Card>
            <CardTitle as="h2">Après enregistrement</CardTitle>
            {echeance ? (
              <Alert tone={after.reste === 0 ? 'success' : 'warning'}>
                {nonComptabilise
                  ? 'Ce montant ne sera pas comptabilisé : le reste dû ne change pas.'
                  : after.credit > 0
                    ? `Trop-perçu de ${money(after.credit)}, à reporter sur la prochaine échéance.`
                    : `Le reste dû sera de ${money(after.reste)}.`}
              </Alert>
            ) : (
              <p className="text-body text-fg-subtle">Choisissez une échéance pour voir le reste dû.</p>
            )}
            {echeance ? <p className="text-caption text-fg-subtle">État actuel : {etatLabel(echeanceEtat(echeance, data.today))}</p> : null}
            <Switch label="Montant non comptabilisé (annulé ou théorique)" checked={nonComptabilise} onCheckedChange={setNonComptabilise} />
            <Switch label="Mentionner sur la quittance" checked={mention} onCheckedChange={setMention} />
          </Card>
        </aside>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={() => { navigate(FINANCES_ROUTES.operations); }}>
          Annuler
        </Button>
        <Button type="submit" loading={exec.pending}>
          Enregistrer le paiement
        </Button>
      </div>
    </form>
  );
}

function etatLabel(etat: ReturnType<typeof echeanceEtat>): string {
  const labels: Record<ReturnType<typeof echeanceEtat>, string> = {
    retard: 'en retard',
    partiel: 'partiellement réglée',
    trop_percu: 'trop perçu',
    solde: 'soldée',
    a_venir: 'à venir',
    annulee: 'annulée',
    irrecouvrable: 'irrécouvrable',
  };
  return labels[etat];
}
