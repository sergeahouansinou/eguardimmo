'use client';

import { useRef, useState } from 'react';
import { Alert, Badge, Button, Card, CardTitle, ConfirmDialog, Select } from '@eguardimmo/ui';
import { z } from 'zod';
import { regularisationSolde } from './derive';
import { formatDate } from './dates';
import { checkAttachment, dateText, fieldErrors, moneyText } from './forms';
import { formatMoneyInput } from './money';
import { CommandAlert, DateField, FilePicker, FINANCES_ROUTES, MoneyField, PageHeader, QueryGate, useExec, useMoney } from './parts';
import type { ScreenProps } from './parts';
import { newRequestKey, useFinances } from './queries';
import type { FinancesData, Regularisation } from './schemas';

const schema = z
  .object({
    bailId: z.string().min(1, 'Choisissez un bail.'),
    debut: dateText('Début de période'),
    fin: dateText('Fin de période'),
    provisions: moneyText('Provisions versées', { allowZero: true }),
    chargesReelles: moneyText('Charges réelles', { allowZero: true }),
  })
  .refine((values) => values.fin > values.debut, { path: ['fin'], message: 'La fin de période doit suivre le début.' });

export function RegularisationPage({ Link, navigate }: ScreenProps) {
  const query = useFinances();
  return (
    <>
      <PageHeader
        Link={Link}
        crumbs={[{ label: 'Finances', href: FINANCES_ROUTES.operations }, { label: 'Régularisation des charges' }]}
        title="Régularisation des charges"
        description="Compare les provisions versées au réel de la période. Le solde part sur l’avis d’échéance suivant."
      />
      <QueryGate query={query} errorTitle="Les baux n’ont pas pu être chargés">
        {(data) => <RegularisationForm data={data} Link={Link} navigate={navigate} />}
      </QueryGate>
    </>
  );
}

function RegularisationForm({ data, Link, navigate }: ScreenProps & { data: FinancesData }) {
  const money = useMoney(data.currency);
  const exec = useExec({ navigate });
  const requestKey = useRef(newRequestKey());
  const [draftId, setDraftId] = useState<string | null>(null);
  const [bailId, setBailId] = useState(data.baux[0]?.id ?? '');
  const [debut, setDebut] = useState('2026-01-01');
  const [fin, setFin] = useState('2026-12-31');
  const [provisions, setProvisions] = useState('1200');
  const [charges, setCharges] = useState('1512');
  const [files, setFiles] = useState<string[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState(false);

  const p = moneyText('Provisions', { allowZero: true }).safeParse(provisions);
  const c = moneyText('Charges', { allowZero: true }).safeParse(charges);
  const solde = p.success && c.success ? regularisationSolde(p.data, c.data) : null;
  const bail = data.baux.find((item) => item.id === bailId);

  const validate = () => {
    const parsed = schema.safeParse({ bailId, debut, fin, provisions, chargesReelles: charges });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return null;
    }
    setErrors({});
    return parsed.data;
  };

  const save = (emettre: boolean) => {
    const values = validate();
    if (!values) return;
    exec.run(
      { type: 'saveRegularisation', regularisationId: draftId, ...values, justificatifs: files, emettre },
      {
        requestKey: emettre ? requestKey.current : undefined,
        redirect: emettre ? 'result' : undefined,
        onError: () => {
          setConfirming(false);
        },
        onDone: (result) => {
          setConfirming(false);
          if (!emettre) setDraftId(result.id);
        },
      },
    );
  };

  const resume = (item: Regularisation) => {
    setDraftId(item.id);
    setBailId(item.bailId);
    setDebut(item.debut);
    setFin(item.fin);
    setProvisions(formatMoneyInput(item.provisions));
    setCharges(formatMoneyInput(item.chargesReelles));
    setFiles(item.justificatifs);
    setErrors({});
  };

  return (
    <>
      <CommandAlert error={exec.error} />
      <form
        noValidate
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          const values = validate();
          if (values) setConfirming(true);
        }}
      >
        <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col gap-3">
            <Card>
              <CardTitle as="h2">Bail et période</CardTitle>
              <Select label="Bail *" placeholder="Choisir un bail" searchable options={data.baux.map((item) => ({ value: item.id, label: `${item.locataire}, ${item.unite}`, description: item.numero }))} value={bailId} onValueChange={setBailId} error={errors.bailId} />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <DateField label="Début de période *" value={debut} onChange={setDebut} error={errors.debut} />
                <DateField label="Fin de période *" value={fin} onChange={setFin} error={errors.fin} />
              </div>
            </Card>
            <Card>
              <CardTitle as="h2">Montants</CardTitle>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <MoneyField label="Provisions versées, €" value={provisions} onChange={setProvisions} error={errors.provisions} hint="Somme des provisions encaissées sur la période." placeholder="1 200" />
                <MoneyField label="Charges réelles, €" value={charges} onChange={setCharges} error={errors.chargesReelles} hint="Total des factures de charges imputables au locataire." placeholder="1 512" />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-caption text-fg-muted">Justificatifs</span>
                {fileError ? <Alert tone="danger" title="Fichier refusé">{fileError}</Alert> : null}
                <div className="flex flex-col items-center gap-1.5 rounded-lg border border-dashed border-line-control p-4 text-center">
                  <b className="text-block-title text-fg-muted">Ajouter les factures</b>
                  <span className="text-caption text-fg-subtle">PDF ou JPG, 10 Mo au maximum</span>
                  <FilePicker
                    label="Choisir des fichiers"
                    accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/*"
                    onPick={(file) => {
                      const problem = checkAttachment(file);
                      setFileError(problem);
                      if (!problem) setFiles((current) => (current.includes(file.name) ? current : [...current, file.name]));
                    }}
                  />
                </div>
                {files.length > 0 ? (
                  <ul className="flex flex-wrap gap-1.5">
                    {files.map((name) => (
                      <li key={name} className="inline-flex items-center gap-1 rounded-sm bg-muted px-2 py-0.5 text-caption text-fg">
                        {name}
                        <button type="button" aria-label={`Retirer ${name}`} className="cursor-pointer text-fg-subtle" onClick={() => { setFiles((current) => current.filter((item) => item !== name)); }}>
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </Card>
          </div>
          <aside className="flex min-w-0 flex-col gap-3">
            <Card>
              <CardTitle as="h2">Solde calculé</CardTitle>
              <dl className="flex flex-col gap-1 text-body">
                <Row label="Provisions versées" value={p.success ? money(p.data) : '—'} />
                <Row label="Charges réelles" value={c.success ? money(c.data) : '—'} />
                <Row label={solde !== null && solde < 0 ? 'Solde à rembourser' : 'Solde à réclamer'} value={solde === null ? '—' : money(Math.abs(solde))} />
              </dl>
              {solde === null ? null : solde > 0 ? (
                <Badge tone="warning" className="self-start">Locataire doit {money(solde)}</Badge>
              ) : solde < 0 ? (
                <Badge tone="info" className="self-start">À rembourser {money(-solde)}</Badge>
              ) : (
                <Badge tone="success" className="self-start">Aucun solde</Badge>
              )}
              <span className="text-caption text-fg-subtle">Un solde négatif est remboursé au locataire.</span>
            </Card>
          </aside>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={() => { navigate(FINANCES_ROUTES.operations); }}>
            Annuler
          </Button>
          <Button variant="secondary" loading={exec.pending && !confirming} onClick={() => { save(false); }}>
            Enregistrer le brouillon
          </Button>
          <Button type="submit">Émettre le décompte</Button>
        </div>
      </form>

      <Card aria-label="Décomptes enregistrés">
        <CardTitle as="h2">Décomptes enregistrés</CardTitle>
        {data.regularisations.length === 0 ? (
          <p className="text-body text-fg-subtle">Aucun décompte pour le moment. Un brouillon enregistré apparaît ici.</p>
        ) : (
          <ul className="flex flex-col">
            {data.regularisations.map((item) => {
              const itemBail = data.baux.find((entry) => entry.id === item.bailId);
              const itemSolde = regularisationSolde(item.provisions, item.chargesReelles);
              return (
                <li key={item.id} className="flex flex-wrap items-center gap-2 border-t border-line py-2 first:border-t-0">
                  <div className="flex min-w-0 flex-1 flex-col">
                    <b className="text-body font-medium text-fg">{itemBail?.locataire}, {itemBail?.unite}</b>
                    <span className="text-caption text-fg-subtle">{formatDate(item.debut)} au {formatDate(item.fin)} · solde {money(itemSolde, true)}</span>
                  </div>
                  <Badge tone={item.statut === 'emise' ? 'success' : 'warning'}>{item.statut === 'emise' ? 'Émis' : 'Brouillon'}</Badge>
                  {item.statut === 'brouillon' ? (
                    <Button variant="link" size="sm" onClick={() => { resume(item); }}>
                      Reprendre
                    </Button>
                  ) : item.factureId ? (
                    <Button variant="link" size="sm" asChild>
                      <Link href={`/finances/factures/${item.factureId}`}>Voir la facture</Link>
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Émettre le décompte ?"
        description={`${bail ? `${bail.locataire}, ${bail.unite}` : ''} : ${solde === null ? '' : solde > 0 ? `le locataire doit ${money(solde)}. Une facture sera émise.` : solde < 0 ? `${money(-solde)} seront à rembourser au locataire.` : 'aucun solde.'} Un décompte émis ne se modifie pas.`}
        confirmLabel="Émettre le décompte"
        loading={exec.pending}
        onConfirm={() => { save(true); }}
      />
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-fg-muted">{label}</dt>
      <dd className="font-semibold text-fg tabular-nums">{value}</dd>
    </div>
  );
}
