'use client';

import { Copy, Download, ShieldCheck } from 'lucide-react';
import { Alert, Badge, Button, Card, CardTitle, IconButton } from '@eguardimmo/ui';
import { useState } from 'react';
import { courriersPaths } from './paths';
import { shortFingerprint, verifyReceiptFingerprint } from './receiptFingerprint';
import type { Receipt, ReceiptEvent } from './schemas';
import { DescriptionList, LinkButton, errorMessage, useNotify } from '../locataires/kit';
import { formatDateFr, monthLabel } from '../locataires/kit/dates';
import { money } from '../locataires/kit/money';

const eventLabel: Record<ReceiptEvent['type'], string> = { emise: 'Émise', envoyee: 'Envoyée', annulee: 'Annulée' };

type Verification = 'none' | 'ok' | 'ko';

export function ReceiptDetailCard({
  receipt,
  tenantName,
  unitLabel,
  stateLabel,
  sending,
  onSend,
  onCancel,
}: {
  receipt: Receipt;
  tenantName: string;
  unitLabel: string;
  stateLabel: string;
  sending: boolean;
  onSend: () => void;
  onCancel: () => void;
}) {
  const notify = useNotify();
  const [verification, setVerification] = useState<{ id: string; result: Verification }>({ id: receipt.id, result: 'none' });
  const result = verification.id === receipt.id ? verification.result : 'none';
  const cancelled = receipt.cancellation !== null;

  const copy = async () => {
    if (!receipt.fingerprint) return;
    try {
      await navigator.clipboard.writeText(receipt.fingerprint);
      notify({ title: 'Empreinte copiée', description: receipt.number ?? '' });
    } catch (error) {
      notify({ tone: 'danger', title: 'Copie impossible', description: errorMessage(error) });
    }
  };

  const verify = async () => {
    setVerification({ id: receipt.id, result: (await verifyReceiptFingerprint(receipt)) ? 'ok' : 'ko' });
  };

  return (
    <Card role="region" aria-label="Détail de la quittance" className="gap-3">
      <CardTitle as="h2">{receipt.number ?? 'Brouillon de quittance'}</CardTitle>
      <div className="flex flex-wrap gap-1">
        <Badge tone={cancelled ? 'danger' : receipt.number ? 'success' : 'warning'}>{cancelled ? 'Annulée' : receipt.number ? 'Scellée' : stateLabel}</Badge>
      </div>
      {receipt.cancellation ? (
        <Alert tone="danger" title={`Annulée le ${formatDateFr(receipt.cancellation.on)}`}>
          {`Motif : ${receipt.cancellation.reason}. Par ${receipt.cancellation.by}.`}
        </Alert>
      ) : null}
      <DescriptionList
        termWidth="100px"
        items={[
          { term: 'Locataire', detail: tenantName },
          { term: 'Bien', detail: unitLabel },
          { term: 'Période', detail: monthLabel(receipt.month) },
          { term: 'Loyer', detail: money(receipt.rent) },
          { term: 'Charges', detail: money(receipt.charges) },
          { term: 'Total', detail: money(receipt.rent + receipt.charges) },
          ...(receipt.outstanding > 0 ? [{ term: 'Reste dû', detail: money(receipt.outstanding) }] : []),
          { term: 'Émise le', detail: formatDateFr(receipt.issuedOn) },
          { term: 'Envoyée le', detail: formatDateFr(receipt.sentOn) },
          ...(receipt.fingerprint
            ? [
                {
                  term: 'Empreinte',
                  detail: (
                    <span className="inline-flex flex-wrap items-center gap-1">
                      <code className="font-mono" aria-label={`Empreinte SHA-256 ${receipt.fingerprint}`}>{shortFingerprint(receipt.fingerprint)}</code>
                      <IconButton label="Copier l’empreinte" icon={Copy} size="xs" onClick={() => { void copy(); }} />
                    </span>
                  ),
                },
              ]
            : []),
        ]}
      />
      <div role="status">
        {result === 'ok' ? <Alert tone="success" title="Empreinte conforme">Le contenu de la quittance correspond à l’empreinte calculée à l’émission.</Alert> : null}
        {result === 'ko' ? <Alert tone="danger" title="Empreinte non conforme">Le contenu de la quittance ne correspond plus à l’empreinte enregistrée.</Alert> : null}
      </div>
      {receipt.history.length > 0 ? (
        <section aria-label="Historique de la quittance" className="flex flex-col gap-1">
          <h3 className="text-body-strong">Historique</h3>
          <ul className="flex flex-col">
            {receipt.history.map((event, index) => (
              <li key={`${event.type}-${event.on}-${String(index)}`} className="flex flex-col border-t border-line py-1 text-body first:border-t-0">
                <span className="text-fg">{`${eventLabel[event.type]} le ${formatDateFr(event.on)}`}</span>
                <span className="text-caption text-fg-subtle">{event.note ? `${event.by}, ${event.note}` : event.by}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {receipt.number ? (
          <>
            <LinkButton href={courriersPaths.quittance(receipt.id)} variant="primary" icon={Download}>Ouvrir le PDF</LinkButton>
            <Button variant="secondary" disabled={!receipt.fingerprint} onClick={() => { void verify(); }}>
              <ShieldCheck size={14} aria-hidden="true" />
              Vérifier l’empreinte
            </Button>
            <Button variant="secondary" loading={sending} disabled={cancelled} onClick={onSend}>Envoyer par e-mail</Button>
            <Button variant="danger" disabled={cancelled} onClick={onCancel}>Annuler la quittance</Button>
          </>
        ) : (
          <p className="text-caption text-fg-subtle">{receipt.outstanding > 0 ? 'La quittance sera émise une fois l’échéance intégralement soldée.' : 'Émettez les quittances soldées pour la générer.'}</p>
        )}
      </div>
    </Card>
  );
}
