'use client';

import { useState } from 'react';
import { Alert, Button, Dialog, DialogClose, DialogContent, Select, Switch, Textarea, TextField } from '@eguardimmo/ui';
import { formatDate } from '../dates';
import { formatMoneyInput } from '../money';
import { moneyText } from '../forms';
import { CommandAlert, FilePicker, MoneyField } from '../parts';
import type { Automatisation, LigneBancaire } from '../schemas';
import { parseBankLines } from './parse';
import type { BankInputLine } from './parse';

const MAX_TEXT_BYTES = 1024 * 1024;

interface BaseProps {
  open: boolean;
  pending: boolean;
  error: Error | null;
  onClose: () => void;
}

function Actions({ pending, label }: { pending: boolean; label: string }) {
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <DialogClose asChild>
        <Button variant="ghost">Annuler</Button>
      </DialogClose>
      <Button type="submit" loading={pending}>
        {label}
      </Button>
    </div>
  );
}

function closeHandler(onClose: () => void) {
  return (next: boolean) => {
    if (!next) onClose();
  };
}

export function ImportBankDialog({ open, pending, error, onClose, comptes, onSubmit }: BaseProps & { comptes: readonly string[]; onSubmit: (values: { compte: string; lignes: BankInputLine[] }) => void }) {
  const [compte, setCompte] = useState(comptes[0] ?? '');
  const [text, setText] = useState('');
  const [problems, setProblems] = useState<string[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const loadFile = (file: File) => {
    if (!/\.(csv|txt)$/i.test(file.name)) {
      setFileError('Format non pris en charge : CSV ou texte uniquement.');
      return;
    }
    if (file.size > MAX_TEXT_BYTES) {
      setFileError('Fichier trop volumineux : 1 Mo au maximum.');
      return;
    }
    setFileError(null);
    void file.text().then(setText);
  };
  return (
    <Dialog open={open} onOpenChange={closeHandler(onClose)}>
      <DialogContent title="Nouvel import" description="Collez ou chargez le relevé : une ligne par opération. Rien n’est enregistré avant votre validation." className="max-w-[600px]">
        <form
          noValidate
          className="flex flex-col gap-3 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (compte.trim() === '') {
              setProblems(['Indiquez le compte bancaire.']);
              return;
            }
            const parsed = parseBankLines(text);
            setProblems(parsed.errors);
            if (parsed.errors.length === 0) onSubmit({ compte: compte.trim(), lignes: parsed.lignes });
          }}
        >
          <CommandAlert error={error} />
          <TextField label="Compte" placeholder="Compte principal" value={compte} onChange={(event) => { setCompte(event.target.value); }} />
          <Textarea label="Relevé" placeholder={'12/11/2026;VIR KOFFI ADJOVI NOV;850,00\n10/11/2026;PRLV EDF;-96,00'} hint="Colonnes séparées par « ; » : date, libellé, montant (négatif pour un débit). Les doublons sont ignorés." rows={6} value={text} onChange={(event) => { setText(event.target.value); }} />
          <div className="flex flex-wrap items-center gap-2">
            <FilePicker label="Charger un fichier CSV" accept=".csv,.txt,text/csv,text/plain" onPick={loadFile} />
            {fileError ? <span className="text-caption text-fg-danger">{fileError}</span> : null}
          </div>
          {problems.length > 0 ? (
            <Alert tone="danger" title="Import impossible">
              <ul className="list-disc pl-4">
                {problems.slice(0, 5).map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            </Alert>
          ) : null}
          <Actions pending={pending} label="Importer" />
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ChooseEntryDialog({
  open,
  pending,
  error,
  onClose,
  ligne,
  entries,
  onSubmit,
}: BaseProps & { ligne: LigneBancaire; entries: readonly { value: string; label: string; description: string }[]; onSubmit: (echeanceId: string) => void }) {
  const [choice, setChoice] = useState('');
  const [message, setMessage] = useState<string | undefined>();
  return (
    <Dialog open={open} onOpenChange={closeHandler(onClose)}>
      <DialogContent title="Choisir une écriture" description={`${ligne.libelle}, ${formatMoneyInput(ligne.montant)} € reçus le ${formatDate(ligne.date)}.`} className="max-w-[520px]">
        <form
          noValidate
          className="flex flex-col gap-3 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!choice) {
              setMessage('Choisissez une échéance.');
              return;
            }
            setMessage(undefined);
            onSubmit(choice);
          }}
        >
          <CommandAlert error={error} />
          <Select label="Échéance à régler" placeholder="Choisir une échéance" searchable options={entries} value={choice} onValueChange={setChoice} error={message} />
          <Actions pending={pending} label="Rapprocher" />
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function SplitDialog({
  open,
  pending,
  error,
  onClose,
  ligne,
  money,
  onSubmit,
}: BaseProps & { ligne: LigneBancaire; money: (minor: number) => string; onSubmit: (premierePart: number) => void }) {
  const [part, setPart] = useState('');
  const [message, setMessage] = useState<string | undefined>();
  const sign = ligne.montant < 0 ? -1 : 1;
  const parsed = moneyText('Première part').safeParse(part);
  const rest = parsed.success && parsed.data < Math.abs(ligne.montant) ? Math.abs(ligne.montant) - parsed.data : null;
  return (
    <Dialog open={open} onOpenChange={closeHandler(onClose)}>
      <DialogContent title="Diviser l’opération" description={`${ligne.libelle}, ${money(ligne.montant)} : répartissez le montant en deux parts.`} className="max-w-[460px]">
        <form
          noValidate
          className="flex flex-col gap-3 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!parsed.success) {
              setMessage(parsed.error.issues[0]?.message);
              return;
            }
            if (rest === null) {
              setMessage('La première part doit être inférieure au montant de l’opération.');
              return;
            }
            setMessage(undefined);
            onSubmit(sign * parsed.data);
          }}
        >
          <CommandAlert error={error} />
          <MoneyField label="Première part, €" value={part} onChange={setPart} error={message} placeholder="500" />
          <MoneyField label="Seconde part, €" value={rest === null ? '' : formatMoneyInput(rest)} readOnly placeholder="350" />
          <Actions pending={pending} label="Diviser" />
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AutomationsDialog({
  open,
  onClose,
  automatisations,
  pending,
  error,
  onToggle,
}: Pick<BaseProps, 'open' | 'onClose' | 'pending' | 'error'> & { automatisations: readonly Automatisation[]; onToggle: (id: string, active: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={closeHandler(onClose)}>
      <DialogContent title="Automatisations" description="Règles appliquées aux opérations importées. Elles proposent, vous validez toujours." className="max-w-[560px]">
        <div className="flex flex-col gap-3 p-4">
          <CommandAlert error={error} />
          <ul className="flex flex-col">
            {automatisations.map((auto) => (
              <li key={auto.id} className="border-t border-line py-2 first:border-t-0">
                <Switch label={auto.libelle} checked={auto.active} disabled={pending} onCheckedChange={(active) => { onToggle(auto.id, active); }} />
              </li>
            ))}
          </ul>
          <div className="flex justify-end">
            <DialogClose asChild>
              <Button>Terminé</Button>
            </DialogClose>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
