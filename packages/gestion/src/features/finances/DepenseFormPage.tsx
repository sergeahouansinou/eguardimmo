'use client';

import { useRef, useState } from 'react';
import { Alert, Button, Card, CardTitle, Select, Switch, Textarea, TextField } from '@eguardimmo/ui';
import { z } from 'zod';
import { checkAttachment, dateText, fieldErrors, moneyText } from './forms';
import { EXPENSE_LABELS, options } from './labels';
import { formatMoneyInput } from './money';
import { CommandAlert, DateField, FilePicker, FINANCES_ROUTES, MoneyField, NotFoundBlock, PageHeader, QueryGate, useExec } from './parts';
import type { ScreenProps } from './parts';
import { newRequestKey, useFinances } from './queries';
import { expenseTypeSchema } from './schemas';
import type { Depense, ExpenseType, FinancesData } from './schemas';
import { bienLabel } from './operations/rows';

const OTHER = '__autre__';
const schema = z.object({
  bien: z.string().min(1, 'Choisissez le bien concerné.'),
  type: expenseTypeSchema,
  date: dateText('Date'),
  montant: moneyText('Montant TTC'),
  fournisseur: z.string().trim().min(1, 'Choisissez un fournisseur.'),
  description: z.string().max(500, 'La description est limitée à 500 caractères.'),
  numeroFacture: z.string().max(60, 'Le numéro est limité à 60 caractères.'),
});

const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function DepenseFormPage({ Link, navigate, depenseId = null, ligneBancaireId = null }: ScreenProps & { depenseId?: string | null; ligneBancaireId?: string | null }) {
  const query = useFinances();
  return (
    <>
      <PageHeader
        Link={Link}
        crumbs={[{ label: 'Finances', href: FINANCES_ROUTES.operations }, { label: 'Transactions', href: FINANCES_ROUTES.operations }, { label: depenseId ? 'Modifier la dépense' : 'Nouvelle dépense' }]}
        title={depenseId ? 'Modifier la dépense' : 'Ajouter une dépense'}
        description="Une dépense se rattache à un bien. Elle reste déductible ou non selon son type."
      />
      <QueryGate query={query} errorTitle="Les biens n’ont pas pu être chargés">
        {(data) => {
          const existing = depenseId ? data.depenses.find((item) => item.id === depenseId) : undefined;
          const ligne = ligneBancaireId ? data.lignesBancaires.find((item) => item.id === ligneBancaireId) : undefined;
          if ((depenseId && !existing) || (ligneBancaireId && !ligne)) return <NotFoundBlock Link={Link} title={depenseId ? 'Dépense introuvable' : 'Opération bancaire introuvable'} backHref={FINANCES_ROUTES.operations} backLabel="Retour aux finances" />;
          return <DepenseForm data={data} navigate={navigate} Link={Link} existing={existing} ligneId={ligne?.id ?? null} prefill={ligne ? { date: ligne.date, montant: Math.abs(ligne.montant), libelle: ligne.libelle } : null} />;
        }}
      </QueryGate>
    </>
  );
}

function DepenseForm({ data, navigate, existing, ligneId, prefill }: ScreenProps & { data: FinancesData; existing: Depense | undefined; ligneId: string | null; prefill: { date: string; montant: number; libelle: string } | null }) {
  const exec = useExec({ navigate });
  const requestKey = useRef(newRequestKey());
  const guess = prefill ? data.fournisseurs.find((name) => fold(prefill.libelle).includes(fold(name).split(' ')[0] ?? '')) : undefined;
  const known = existing ? data.fournisseurs.includes(existing.fournisseur) : true;
  const [bien, setBien] = useState(existing?.bien ?? '');
  const [type, setType] = useState<ExpenseType>(existing?.type ?? 'reparation');
  const [date, setDate] = useState(existing?.date ?? prefill?.date ?? data.today);
  const [montant, setMontant] = useState(existing ? formatMoneyInput(existing.montantTtc) : prefill ? formatMoneyInput(prefill.montant) : '');
  const [fournisseur, setFournisseur] = useState(existing ? (known ? existing.fournisseur : OTHER) : (guess ?? ''));
  const [autre, setAutre] = useState(existing && !known ? existing.fournisseur : '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [numeroFacture, setNumeroFacture] = useState(existing?.numeroFacture ?? '');
  const [deductible, setDeductible] = useState(existing?.deductible ?? true);
  const [recuperable, setRecuperable] = useState(existing?.recuperable ?? false);
  const [nonComptabilise, setNonComptabilise] = useState(existing?.nonComptabilise ?? false);
  const [justificatif, setJustificatif] = useState<string | null>(existing?.justificatif ?? null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const biens = [...new Set([...data.baux.map(bienLabel), ...data.depenses.map((item) => item.bien)])].sort((a, b) => a.localeCompare(b, 'fr'));

  const submit = () => {
    const name = fournisseur === OTHER ? autre : fournisseur;
    const parsed = schema.safeParse({ bien, type, date, montant, fournisseur: name, description, numeroFacture });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    exec.run(
      {
        type: 'saveExpense',
        depenseId: existing?.id ?? null,
        bien: parsed.data.bien,
        expenseType: parsed.data.type,
        date: parsed.data.date,
        montantTtc: parsed.data.montant,
        fournisseur: parsed.data.fournisseur,
        description: parsed.data.description,
        numeroFacture: parsed.data.numeroFacture,
        deductible,
        recuperable,
        nonComptabilise,
        justificatif,
        ligneBancaireId: ligneId,
      },
      { requestKey: requestKey.current, redirect: ligneId ? FINANCES_ROUTES.importBancaire : FINANCES_ROUTES.operations },
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
          <CardTitle as="h2">Dépense</CardTitle>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select label="Bien *" placeholder="Choisir un bien" searchable options={biens.map((value) => ({ value, label: value }))} value={bien} onValueChange={setBien} error={errors.bien} />
            <Select label="Type *" placeholder="Choisir un type" options={options(EXPENSE_LABELS)} value={type} onValueChange={(value) => { setType(expenseTypeSchema.parse(value)); }} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <DateField label="Date *" value={date} onChange={setDate} error={errors.date} />
            <MoneyField label="Montant TTC, €" value={montant} onChange={setMontant} error={errors.montant} placeholder="42" />
            <Select
              label="Payé à *"
              placeholder="Choisir un fournisseur"
              searchable
              options={[...data.fournisseurs.map((value) => ({ value, label: value })), { value: OTHER, label: 'Autre fournisseur…' }]}
              value={fournisseur}
              onValueChange={setFournisseur}
              error={fournisseur === OTHER ? undefined : errors.fournisseur}
            />
          </div>
          {fournisseur === OTHER ? <TextField label="Nom du fournisseur *" placeholder="Quincaillerie du Port" value={autre} error={errors.fournisseur} onChange={(event) => { setAutre(event.target.value); }} /> : null}
          <Textarea label="Description" placeholder="Serrure de la porte d’entrée remplacée." value={description} error={errors.description} onChange={(event) => { setDescription(event.target.value); }} />
          <TextField label="Numéro de facture" placeholder="QUI-20261109" value={numeroFacture} error={errors.numeroFacture} onChange={(event) => { setNumeroFacture(event.target.value); }} />
        </Card>
        <aside className="flex min-w-0 flex-col gap-3">
          <Card>
            <CardTitle as="h2">Fiscalité</CardTitle>
            <Switch label="Déductible des revenus fonciers" checked={deductible} onCheckedChange={setDeductible} />
            <Switch label="Récupérable auprès du locataire" checked={recuperable} onCheckedChange={setRecuperable} />
            <Switch label="Montant non comptabilisé (annulé ou théorique)" checked={nonComptabilise} onCheckedChange={setNonComptabilise} />
          </Card>
          <Card>
            <CardTitle as="h2">Justificatif</CardTitle>
            {fileError ? <Alert tone="danger" title="Fichier refusé">{fileError}</Alert> : null}
            <div className="flex flex-col items-center gap-1.5 rounded-lg border border-dashed border-line-control p-4 text-center">
              <b className="text-block-title text-fg-muted">{justificatif ?? 'Joindre la facture'}</b>
              <span className="text-caption text-fg-subtle">PDF ou image, 10 Mo au maximum</span>
              <FilePicker
                label={justificatif ? 'Remplacer le fichier' : 'Choisir un fichier'}
                accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/*"
                onPick={(file) => {
                  const problem = checkAttachment(file);
                  setFileError(problem);
                  if (!problem) setJustificatif(file.name);
                }}
              />
              {justificatif ? (
                <Button variant="link" size="sm" onClick={() => { setJustificatif(null); }}>
                  Retirer le fichier
                </Button>
              ) : null}
            </div>
          </Card>
        </aside>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={() => { navigate(ligneId ? FINANCES_ROUTES.importBancaire : FINANCES_ROUTES.operations); }}>
          Annuler
        </Button>
        <Button type="submit" loading={exec.pending}>
          Enregistrer la dépense
        </Button>
      </div>
    </form>
  );
}
