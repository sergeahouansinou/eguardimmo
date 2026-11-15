'use client';

import { useState } from 'react';
import { Alert, Button, Dialog, DialogClose, DialogContent, Select, Textarea } from '@eguardimmo/ui';
import type { LinkComponent } from '@eguardimmo/ui';
import type { Contact } from '../../suivi/contacts/schemas';
import { addDays, formatDate } from '../dates';
import { fieldErrors } from '../forms';
import { CommandAlert } from '../parts';
import { emailSchema, TRANSMISSION_DUREES } from '../schemas';
import type { Liasse } from '../schemas';
import { formatOctets } from './pieces';
import { transmitFormSchema } from './schemas';

export const NEW_CONTACT_HREF = '/contacts/nouveau';

export interface TransmitValues {
  contact: Contact;
  dureeJours: number;
  message: string;
}

export function TransmitDialog({
  liasse,
  contacts,
  today,
  Link,
  pending,
  error,
  onSubmit,
  onClose,
}: {
  liasse: Liasse;
  contacts: readonly Contact[];
  today: string;
  Link: LinkComponent;
  pending: boolean;
  error: Error | null;
  onSubmit: (values: TransmitValues) => void;
  onClose: () => void;
}) {
  const [contactId, setContactId] = useState(contacts.length === 1 ? (contacts[0]?.id ?? '') : '');
  const [duree, setDuree] = useState('7');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const contact = contacts.find((item) => item.id === contactId);
  const hasEmail = contact ? emailSchema.safeParse(contact.email).success : true;
  const dureeJours = Number(duree);
  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent title="Transmettre au commissaire de justice" description="Le commissaire reçoit par e-mail un lien sécurisé de téléchargement, jamais les pièces elles-mêmes." className="max-w-[520px]">
        <form
          noValidate
          className="flex max-h-[75vh] flex-col gap-3 overflow-y-auto p-4"
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            const parsed = transmitFormSchema.safeParse({ contactId, dureeJours: duree, message });
            if (!parsed.success || !contact) {
              setErrors(parsed.success ? { contactId: 'Choisissez le commissaire de justice.' } : fieldErrors(parsed.error));
              return;
            }
            setErrors({});
            onSubmit({ contact, dureeJours: parsed.data.dureeJours, message: parsed.data.message });
          }}
        >
          <CommandAlert error={error} />
          <Select
            label="Commissaire de justice"
            placeholder="Choisir un contact"
            options={contacts.map((item) => ({ value: item.id, label: item.name, description: item.email === '' ? 'Aucune adresse e-mail' : item.email }))}
            value={contactId}
            error={errors.contactId}
            onValueChange={setContactId}
          />
          <p className="text-caption text-fg-subtle">
            Absent de la liste ?{' '}
            <Button variant="link" size="sm" asChild>
              <Link href={NEW_CONTACT_HREF}>Créer un contact</Link>
            </Button>{' '}
            avec la catégorie « Commissaire de justice ».
          </p>
          {contact && !hasEmail ? (
            <Alert tone="warning" title="Ce contact n’a pas d’adresse e-mail">
              <Button variant="link" size="sm" asChild>
                <Link href={`/contacts/${contact.id}/modifier`}>Compléter sa fiche</Link>
              </Button>{' '}
              pour pouvoir lui envoyer le lien.
            </Alert>
          ) : null}
          <Select
            label="Validité du lien"
            placeholder="Choisir une durée"
            options={TRANSMISSION_DUREES.map((value) => ({ value: String(value), label: `${String(value)} jours` }))}
            value={duree}
            error={errors.dureeJours}
            onValueChange={setDuree}
          />
          <Textarea
            label="Message (facultatif)"
            placeholder="Bonjour Maître, voici le lien vers les pièces du dossier de recouvrement."
            rows={3}
            value={message}
            error={errors.message}
            onChange={(event) => { setMessage(event.target.value); }}
          />
          <dl aria-label="Récapitulatif" className="grid grid-cols-[96px_minmax(0,1fr)] gap-x-2 gap-y-1 rounded-md bg-muted p-3 text-body">
            <dt className="text-fg-subtle">Destinataire</dt>
            <dd className="break-words">{contact ? `${contact.name}${hasEmail ? `, ${contact.email}` : ''}` : '—'}</dd>
            <dt className="text-fg-subtle">Pièces</dt>
            <dd>{liasse.pieces.length} pièces, {formatOctets(liasse.octets)}</dd>
            <dt className="text-fg-subtle">Expiration</dt>
            <dd>Le {formatDate(addDays(today, dureeJours))}</dd>
          </dl>
          <div className="flex flex-wrap justify-end gap-2">
            <DialogClose asChild>
              <Button variant="ghost">Annuler</Button>
            </DialogClose>
            <Button type="submit" loading={pending} disabled={contact !== undefined && !hasEmail}>
              Envoyer le lien
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
