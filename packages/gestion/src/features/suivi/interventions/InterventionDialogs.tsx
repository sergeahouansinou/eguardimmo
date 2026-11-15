'use client';

import { useState } from 'react';
import type { ReactNode, SyntheticEvent } from 'react';
import { Alert, Button, Dialog, DialogClose, DialogContent, Select, TextField, Textarea } from '@eguardimmo/ui';
import { DEMO_TODAY } from '../../outils/kit';
import { euroInput, parseEuros } from '../../locataires/kit/money';
import { tenantOf } from '../shared/biens';
import { NONE } from '../shared/schemas';
import { tenantMessage } from './logic';
import { quoteInputSchema } from './schemas';
import type { Intervention, QuoteInput } from './schemas';

interface DialogShellProps {
  item: Intervention | null;
  pending: boolean;
  error: string | null;
  onClose: () => void;
}

function Shell({ item, title, onClose, children }: Pick<DialogShellProps, 'item' | 'onClose'> & { title: string; children: (item: Intervention) => ReactNode }) {
  return (
    <Dialog open={item !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      {item ? (
        <DialogContent title={title} description={item.subject} className="max-w-md">
          {children(item)}
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

function Footer({ pending, label, disabled = false }: { pending: boolean; label: string; disabled?: boolean }) {
  return (
    <div className="flex justify-end gap-2">
      <DialogClose asChild>
        <Button variant="secondary">Annuler</Button>
      </DialogClose>
      <Button type="submit" loading={pending} disabled={disabled}>{label}</Button>
    </div>
  );
}

export function AssignDialog({ options, onSubmit, ...shell }: DialogShellProps & { options: readonly string[]; onSubmit: (intervenant: string | null) => void }) {
  return (
    <Shell item={shell.item} title="Assigner un intervenant" onClose={shell.onClose}>
      {(item) => <AssignForm key={item.id} item={item} options={options} pending={shell.pending} error={shell.error} onSubmit={onSubmit} />}
    </Shell>
  );
}

function AssignForm({ item, options, pending, error, onSubmit }: { item: Intervention; options: readonly string[]; pending: boolean; error: string | null; onSubmit: (intervenant: string | null) => void }) {
  const [value, setValue] = useState(item.intervenant ?? NONE);
  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    event.stopPropagation();
    onSubmit(value === NONE ? null : value);
  };
  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-3 p-4">
      {error ? <Alert tone="danger" title="L’assignation n’a pas abouti">{error}</Alert> : null}
      <Select
        label="Intervenant"
        placeholder="Choisir un artisan"
        options={[{ value: NONE, label: 'À assigner' }, ...options.map((name) => ({ value: name, label: name }))]}
        value={value}
        onValueChange={setValue}
      />
      <Footer pending={pending} label="Assigner" />
    </form>
  );
}

export function NotifyDialog({ onSubmit, ...shell }: DialogShellProps & { onSubmit: (message: string) => void }) {
  return (
    <Shell item={shell.item} title="Prévenir le locataire" onClose={shell.onClose}>
      {(item) => <NotifyForm key={item.id} item={item} pending={shell.pending} error={shell.error} onSubmit={onSubmit} />}
    </Shell>
  );
}

function NotifyForm({ item, pending, error, onSubmit }: { item: Intervention; pending: boolean; error: string | null; onSubmit: (message: string) => void }) {
  const tenant = tenantOf(item.bienId);
  const [message, setMessage] = useState(tenant ? tenantMessage(item, tenant) : '');
  const [problem, setProblem] = useState<string | undefined>();
  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (message.trim() === '') {
      setProblem('Rédigez le message à envoyer.');
      return;
    }
    setProblem(undefined);
    onSubmit(message);
  };
  if (!tenant) {
    return (
      <div className="flex flex-col gap-3 p-4">
        <Alert tone="warning" title="Aucun locataire en place">Ce bien n’a pas de locataire : il n’y a personne à prévenir.</Alert>
        <div className="flex justify-end">
          <DialogClose asChild>
            <Button variant="secondary">Fermer</Button>
          </DialogClose>
        </div>
      </div>
    );
  }
  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-3 p-4">
      {error ? <Alert tone="danger" title="Le message n’a pas été envoyé">{error}</Alert> : null}
      <p className="text-body text-fg-muted">Destinataire : <b className="text-fg">{tenant}</b>. L’envoi est simulé et consigné dans l’historique.</p>
      <Textarea label="Message" placeholder="Bonjour, une intervention est prévue dans votre logement." rows={8} value={message} error={problem} onChange={(event) => { setMessage(event.target.value); }} />
      <Footer pending={pending} label="Envoyer le message" />
    </form>
  );
}

export function QuoteDialog({ onSubmit, ...shell }: DialogShellProps & { onSubmit: (quote: QuoteInput) => void }) {
  return (
    <Shell item={shell.item} title="Enregistrer un devis" onClose={shell.onClose}>
      {(item) => <QuoteForm key={item.id} item={item} pending={shell.pending} error={shell.error} onSubmit={onSubmit} />}
    </Shell>
  );
}

function QuoteForm({ item, pending, error, onSubmit }: { item: Intervention; pending: boolean; error: string | null; onSubmit: (quote: QuoteInput) => void }) {
  const [amount, setAmount] = useState(item.quote ? euroInput(item.quote.amount) : '');
  const [receivedOn, setReceivedOn] = useState(item.quote?.receivedOn ?? DEMO_TODAY);
  const [errors, setErrors] = useState<{ amount?: string; receivedOn?: string }>({});
  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const valid = /^\d+([.,]\d{1,2})?$/.test(amount.trim());
    const parsed = quoteInputSchema.safeParse({ amount: valid ? parseEuros(amount) : undefined, receivedOn });
    if (!parsed.success) {
      setErrors({
        amount: valid ? parsed.error.issues.find((issue) => issue.path[0] === 'amount')?.message : 'Indiquez un montant, par exemple 180 ou 180,50.',
        receivedOn: parsed.error.issues.find((issue) => issue.path[0] === 'receivedOn')?.message,
      });
      return;
    }
    setErrors({});
    onSubmit(parsed.data);
  };
  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-3 p-4">
      {error ? <Alert tone="danger" title="Le devis n’a pas été enregistré">{error}</Alert> : null}
      <TextField label="Montant TTC (€) *" placeholder="180" inputMode="decimal" value={amount} error={errors.amount} onChange={(event) => { setAmount(event.target.value); }} />
      <TextField label="Reçu le *" type="date" placeholder="AAAA-MM-JJ" value={receivedOn} error={errors.receivedOn} onChange={(event) => { setReceivedOn(event.target.value); }} />
      <Footer pending={pending} label="Enregistrer le devis" />
    </form>
  );
}
